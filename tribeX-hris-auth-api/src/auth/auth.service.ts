import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { LoginDto } from '../auth/dto/login.dto';
import { MailService } from '../mail/mail.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';

type UserRow = {
  user_id: string;
  company_id: string;
  role_id: number;
  email: string;
  username: string | null;
  employee_id: string | null;
  password_hash: string | null;
  first_name: string | null;
  last_name: string | null;
  start_date: string | null;
  account_status: string | null;
};

function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function getIp(req?: any): string | null {
  if (!req) return null;
  const xf = req.headers?.['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || null;
}

function getBrowser(req?: any): string | null {
  if (!req) return null;
  return req.headers?.['user-agent'] || null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
  ) {}

  // Fire-and-forget incident log — written directly to avoid circular dep with AuditModule
  private async writeIncidentLog(
    action: string,
    severity: 'WARNING' | 'ERROR' | 'CRITICAL',
    options?: { userId?: string; companyId?: string; ipAddress?: string },
  ) {
    try {
      await this.supabaseService.getClient().from('admin_audit_logs').insert({
        action,
        performed_by: options?.userId ?? null,
        company_id: options?.companyId ?? null,
        target_user_id: null,
        severity,
        ip_address: options?.ipAddress ?? null,
      });
    } catch {
      // never breaks main flow
    }
  }

  private logDevLink(label: string, recipient: string, link: string) {
    if (this.config.get<string>('NODE_ENV') === 'production') return;

    console.log('==========================================');
    console.log(`DEV MODE - ${label}`);
    console.log(`Recipient: ${recipient}`);
    console.log(link);
    console.log('==========================================');
  }

  private async issueFreshUserInvite(userId: string) {
    const supabase = this.supabaseService.getClient();

    await supabase
      .from('user_invites')
      .delete()
      .eq('user_id', userId)
      .is('used_at', null);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const { error: inviteError } = await supabase.from('user_invites').insert({
      invite_id: crypto.randomUUID(),
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    if (inviteError) {
      throw new Error(inviteError.message);
    }

    const appUrl =
      this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
    return `${appUrl}/set-password?token=${rawToken}`;
  }

  private async resendActivationInvite(user: UserRow) {
    const inviteLink = await this.issueFreshUserInvite(user.user_id);
    this.logDevLink('activation link', user.email, inviteLink);

    try {
      await this.mailService.sendInvite(user.email, inviteLink);
    } catch (error) {
      this.logger.error(
        `Failed to resend activation email to ${user.email}`,
        error,
      );
      void this.writeIncidentLog(
        `EMAIL: Failed to send activation invite to ${user.email}`,
        'ERROR',
        { userId: user.user_id },
      );
      throw error;
    }
  }

  async requestPasswordReset(dto: ForgotPasswordDto) {
    const supabase = this.supabaseService.getClient();
    const email = dto.email.trim().toLowerCase();

    const { data: user, error } = await supabase
      .from('user_profile')
      .select(
        'user_id, company_id, role_id, password_hash, email, username, first_name, last_name, start_date, account_status',
      )
      .eq('email', email)
      .maybeSingle<UserRow>();

    if (error) {
      this.logger.error(`DB error during forgot-password for: ${email}`, error);
      return {
        message:
          'If an account exists for that email, a reset link has been sent.',
      };
    }

    if (!user || user.account_status === 'Inactive') {
      return {
        message:
          'If an account exists for that email, a reset link has been sent.',
      };
    }

    try {
      const resetLink = await this.issueFreshUserInvite(user.user_id);
      this.logDevLink('password reset link', user.email, resetLink);
      await this.mailService.sendPasswordResetEmail(user.email, resetLink);
    } catch (resetError) {
      this.logger.error(
        `Failed to process forgot-password for ${email}`,
        resetError,
      );
      void this.writeIncidentLog(
        `EMAIL: Failed to send password reset email to ${email}`,
        'ERROR',
        { userId: user.user_id },
      );
    }

    return {
      message:
        'If an account exists for that email, a reset link has been sent.',
    };
  }

  async login(loginDto: LoginDto, req?: any) {
    const supabase = this.supabaseService.getClient();
    const { identifier, password } = loginDto;
    const rememberMe = !!loginDto.rememberMe;

    if (!/^[a-zA-Z0-9._@-]+$/.test(identifier)) {
      throw new UnauthorizedException('Invalid identifier format');
    }

    const { data: user, error } = await supabase
      .from('user_profile')
      .select(
        'user_id, company_id, role_id, password_hash, email, username, first_name, last_name, start_date, account_status',
      )
      .or(`email.eq.${identifier},username.eq.${identifier}`)
      .maybeSingle<UserRow>();

    if (error) {
      this.logger.error(`DB error during login for: ${identifier}`, error);
      throw new UnauthorizedException('Login failed');
    }
    if (!user) throw new UnauthorizedException('No account found with that email or username.');

    if (user.account_status === 'Inactive') {
      void this.writeIncidentLog(
        `SECURITY: Login blocked for ${user.email} — account deactivated`,
        'WARNING',
        { userId: user.user_id, companyId: user.company_id, ipAddress: getIp(req) ?? undefined },
      );
      throw new UnauthorizedException('Your account has been deactivated. Please contact your administrator.');
    }

    if (!user.password_hash) throw new UnauthorizedException('No password set');

    // Block login if today is before the employee's start date
    if (user.start_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = new Date(user.start_date);
      startDate.setHours(0, 0, 0, 0);
      if (today < startDate) {
        void this.writeIncidentLog(
          `SECURITY: Login blocked for ${user.email} — account not yet active (start date: ${startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })})`,
          'WARNING',
          { userId: user.user_id, companyId: user.company_id, ipAddress: getIp(req) ?? undefined },
        );
        throw new UnauthorizedException(
          `Your account is not active yet. Your start date is ${startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.`,
        );
      }
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      await Promise.all([
        supabase.from('login_history').insert({
          login_id: crypto.randomUUID(),
          role_id: String(user.role_id),
          user_id: user.user_id,
          ip_address: getIp(req),
          browser_info: getBrowser(req),
          status: 'FAILED',
        }),
        this.writeIncidentLog(
          `SECURITY: Failed login attempt for ${user.email} — incorrect password`,
          'WARNING',
          { userId: user.user_id, companyId: user.company_id, ipAddress: getIp(req) ?? undefined },
        ),
      ]);
      throw new UnauthorizedException('Incorrect password. Please try again.');
    }

    // Fetch role + company in parallel — neither depends on the other
    const [
      { data: roleRow, error: roleError },
      { data: companydb, error: companyError },
    ] = await Promise.all([
      supabase.from('role').select('role_name').eq('role_id', user.role_id).single(),
      supabase.from('company').select('company_name').eq('company_id', user.company_id).single(),
    ]);

    if (roleError || !roleRow) throw new UnauthorizedException('Role not found');
    if (companyError || !companydb) throw new UnauthorizedException('Company not found');

    const login_id = crypto.randomUUID();
    const session_id = crypto.randomUUID();

    const accessPayload = {
      type: 'access',
      sub_userid: user.user_id,
      company_id: user.company_id,
      role_id: user.role_id,
      role_name: roleRow.role_name,
      company_name: companydb.company_name,
      first_name: user.first_name,
      last_name: user.last_name,
    };

    const [access_token, refresh_token] = await Promise.all([
      this.jwtService.signAsync(accessPayload, { expiresIn: '15m' }),
      this.jwtService.signAsync(
        { type: 'refresh', sub_userid: user.user_id, role_id: user.role_id, login_id, session_id },
        { expiresIn: rememberMe ? '30d' : '7d' },
      ),
    ]);

    const decoded: any = this.jwtService.decode(refresh_token);
    const expires_at = new Date(decoded.exp * 1000).toISOString();
    const token_hash = sha256(refresh_token);

    // Fire login_history + refresh_session inserts in parallel — neither blocks the response
    await Promise.all([
      supabase.from('login_history').insert({
        login_id,
        role_id: String(user.role_id),
        user_id: user.user_id,
        ip_address: getIp(req),
        browser_info: getBrowser(req),
        status: 'SUCCESS',
      }),
      supabase.from('refresh_session').insert({
        user_id: user.user_id,
        token_hash,
        expires_at,
      }),
    ]);

    return { access_token, refresh_token };
  }

  async logout(refreshToken: string, req?: any, accessToken?: string) {
    const supabase = this.supabaseService.getClient();

    let decoded: any;
    try {
      decoded = await this.jwtService.verifyAsync(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const token_hash = sha256(refreshToken);

    await supabase
      .from('refresh_session')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', decoded.sub_userid)
      .eq('token_hash', token_hash);

    // Blacklist the access token so it cannot be used after logout.
    // verifyAsync (not decode) is used so that unsigned/tampered strings cannot
    // pollute the blacklist table with junk rows.
    if (accessToken) {
      try {
        const accessDecoded: any =
          await this.jwtService.verifyAsync(accessToken);
        if (accessDecoded?.exp) {
          await supabase.from('token_blacklist').insert({
            token_hash: sha256(accessToken),
            expires_at: new Date(accessDecoded.exp * 1000).toISOString(),
          });
        }
      } catch {
        /* best-effort: ignore if access token is already invalid */
      }
    }

    await supabase.from('logout_history').insert({
      logout_id: crypto.randomUUID(),
      login_id: decoded.login_id ?? null,
      role_id: decoded.role_id == null ? null : String(decoded.role_id),
      user_id: decoded.sub_userid ?? null,
      session_id: decoded.session_id ?? token_hash,
      ip_address: getIp(req),
      browser_info: getBrowser(req),
    });

    const { data: user, error } = await supabase
      .from('user_profile')
      .select('username')
      .eq('user_id', decoded.sub_userid)
      .single();

    if (error || !user) throw new UnauthorizedException('User not found');

    return { message: 'Logged out', username: user.username };
  }

  async refresh(refreshToken: string) {
    const supabase = this.supabaseService.getClient();

    let decoded: any;
    try {
      decoded = await this.jwtService.verifyAsync(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (decoded.type !== 'refresh')
      throw new UnauthorizedException('Invalid refresh token type');

    const userId = decoded.sub_userid;
    const token_hash = sha256(refreshToken);

    const { data: session, error } = await supabase
      .from('refresh_session')
      .select('expires_at, revoked_at')
      .eq('user_id', userId)
      .eq('token_hash', token_hash)
      .maybeSingle();

    if (error || !session) throw new UnauthorizedException('Session not found');
    if (session.revoked_at) throw new UnauthorizedException('Session revoked');
    if (new Date(session.expires_at) <= new Date())
      throw new UnauthorizedException('Session expired');

    const { data: user, error: userErr } = await supabase
      .from('user_profile')
      .select(
        'user_id, company_id, role_id, first_name, last_name, account_status',
      )
      .eq('user_id', userId)
      .single();

    if (userErr || !user) throw new UnauthorizedException('User not found');
    if (user.account_status === 'Inactive')
      throw new UnauthorizedException('Account deactivated');

    const { data: roleRow, error: roleErr } = await supabase
      .from('role')
      .select('role_name')
      .eq('role_id', user.role_id)
      .single();

    if (roleErr || !roleRow)
      throw new UnauthorizedException('Role not found');

    const { data: companydb, error: companyErr } = await supabase
      .from('company')
      .select('company_name')
      .eq('company_id', user.company_id)
      .single();

    if (companyErr || !companydb)
      throw new UnauthorizedException('Company not found');

    // ✅ first_name and last_name included in refresh too
    const accessPayload = {
      type: 'access',
      sub_userid: user.user_id,
      company_id: user.company_id,
      role_id: user.role_id,
      role_name: roleRow.role_name,
      company_name: companydb.company_name,
      first_name: user.first_name,
      last_name: user.last_name,
    };

    const access_token = await this.jwtService.signAsync(accessPayload, {
      expiresIn: '15m',
    });

    return { access_token };
  }

  async me(accessToken: string) {
    try {
      const decoded: any = await this.jwtService.verifyAsync(accessToken);
      if (decoded.type !== 'access')
        throw new UnauthorizedException('Invalid token type');
      const supabase = this.supabaseService.getClient();

      // Reject blacklisted (logged-out) access tokens
      const { data: blacklisted } = await supabase
        .from('token_blacklist')
        .select('token_hash')
        .eq('token_hash', sha256(accessToken))
        .maybeSingle();
      if (blacklisted)
        throw new UnauthorizedException('Token has been revoked');

      const userId = decoded.sub_userid;
      if (!userId) throw new UnauthorizedException('Invalid token payload');

      const { data: user, error } = await supabase
        .from('user_profile')
        .select(
          'user_id, email, username, employee_id, company_id, role_id, account_status',
        )
        .eq('user_id', userId)
        .maybeSingle<UserRow>();

      if (error || !user) throw new UnauthorizedException('User not found');
      if (user.account_status === 'Inactive')
        throw new UnauthorizedException('Account deactivated');

      return {
        user_id: user.user_id,
        email: user.email,
        username: user.username,
        employee_id: user.employee_id,
        company_id: user.company_id,
        role_id: user.role_id,
        role_name: decoded.role_name,
      };
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async setPassword(token: string, password: string) {
    const supabase = this.supabaseService.getClient();
    const tokenHash = sha256(token);

    // Find the invite — must exist, not used, not expired
    const { data: invite, error: inviteError } = await supabase
      .from('user_invites')
      .select('invite_id, user_id, expires_at, used_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (inviteError || !invite)
      throw new UnauthorizedException('Invalid or expired invite link');
    if (invite.used_at)
      throw new UnauthorizedException('This invite link has already been used');
    if (new Date(invite.expires_at) <= new Date())
      throw new UnauthorizedException('This invite link has expired');

    // Hash the new password
    const password_hash = await bcrypt.hash(password, 12);

    // Set the password and activate the account
    const { error: updateError } = await supabase
      .from('user_profile')
      .update({ password_hash, account_status: 'Active' })
      .eq('user_id', invite.user_id);

    if (updateError) throw new Error(updateError.message);

    // Mark the invite as used so it can't be reused
    await supabase
      .from('user_invites')
      .update({ used_at: new Date().toISOString() })
      .eq('invite_id', invite.invite_id);

    return { message: 'Password set successfully. You can now log in.' };
  }
}
