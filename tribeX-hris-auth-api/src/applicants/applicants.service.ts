// src/applicants/applicants.service.ts

import {
  Injectable,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SupabaseService } from '../supabase/supabase.service';
import { MailService } from '../mail/mail.service';
import { CreateApplicantDto } from './dto/create-applicant.dto';
import { ApplicantLoginDto } from './dto/applicant-login.dto';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'node:crypto';

function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

@Injectable()
export class ApplicantsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: CreateApplicantDto, companyId?: string) {
    const supabase = this.supabaseService.getClient();

    // 1. Check for duplicate email
    const { data: existing } = await supabase
      .from('applicant_profile')
      .select('applicant_id, status')
      .eq('email', dto.email)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'unverified') {
        // Account exists but was never verified — silently resend the link
        // so the user doesn't get stuck. Surface a friendly message.
        await this.resendVerification(dto.email);
        throw new ConflictException(
          'UNVERIFIED_RESENT: This email is already registered but the address was never verified. ' +
          'We\'ve sent a fresh verification link — please check your inbox.',
        );
      }
      throw new ConflictException('An account with this email already exists.');
    }

    // 2. Hash the password
    const password_hash = await bcrypt.hash(dto.password, 12);

    // 3. Generate unique IDs
    const applicant_id = crypto.randomUUID();
    const applicant_code = `APP-${Math.floor(1000000 + Math.random() * 9000000)}`;

    // 4. Insert the applicant
    const { error: insertError } = await supabase
      .from('applicant_profile')
      .insert({
        applicant_id,
        applicant_code,
        first_name: dto.first_name,
        last_name: dto.last_name,
        email: dto.email,
        phone_number: dto.phone_number ?? null,
        password_hash,               // hashed — never store plaintext
        role: 'Applicant',           // always hardcoded, never from request
        status: 'unverified',        // always hardcoded, verified after email click
        company_id: companyId ?? null,
        created_at: new Date().toISOString(),
      });

    if (insertError) throw new InternalServerErrorException('Could not create your account. Please try again.');

    // 5. Generate email verification token (raw → email, hashed → DB)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error: tokenError } = await supabase
      .from('email_verifications')
      .insert({
        applicant_id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

    if (tokenError) {
      // Rollback: remove the applicant we just created so the user can retry cleanly
      await supabase.from('applicant_profile').delete().eq('applicant_id', applicant_id);
      throw new InternalServerErrorException('Could not complete registration. Please try again.');
    }

    // 6. Send verification email
    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
    const verifyLink = `${appUrl}/applicant/verify-email?token=${rawToken}`;

    try {
      await this.mailService.sendVerificationEmail(dto.email, verifyLink);
    } catch {
      // Rollback: remove both records so the user can retry with a fresh token
      await supabase.from('email_verifications').delete().eq('applicant_id', applicant_id);
      await supabase.from('applicant_profile').delete().eq('applicant_id', applicant_id);
      throw new InternalServerErrorException(
        'We could not send a verification email to that address. Please check the email and try again.',
      );
    }

    return {
      applicant_id,
      applicant_code,
      email: dto.email,
      first_name: dto.first_name,
      last_name: dto.last_name,
      message: 'Account created. Please check your email to verify your address.',
    };
  }

  async verifyEmail(token: string) {
    if (!token) throw new BadRequestException('Verification token is required');

    const supabase = this.supabaseService.getClient();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const { data: record, error } = await supabase
      .from('email_verifications')
      .select('verification_id, applicant_id, expires_at, used_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (error || !record) throw new UnauthorizedException('Invalid or expired verification link');
    if (record.used_at) throw new UnauthorizedException('This verification link has already been used');
    if (new Date(record.expires_at) <= new Date()) throw new UnauthorizedException('This verification link has expired');

    await supabase
      .from('email_verifications')
      .update({ used_at: new Date().toISOString() })
      .eq('verification_id', record.verification_id);

    await supabase
      .from('applicant_profile')
      .update({ status: 'active' })
      .eq('applicant_id', record.applicant_id);

    return { message: 'Email verified successfully. You can now sign in.' };
  }

  async login(dto: ApplicantLoginDto) {
    const supabase = this.supabaseService.getClient();

    // 1. Find applicant by email
    const { data: applicant, error } = await supabase
      .from('applicant_profile')
      .select('applicant_id, email, password_hash, first_name, last_name, phone_number, status, company_id')
      .eq('email', dto.email)
      .maybeSingle();

    if (error || !applicant) throw new UnauthorizedException('No account found with that email address.');

    // 2. Block accounts that have been fully converted to employees
    if (applicant.status === 'converted_employee') {
      throw new UnauthorizedException('CONVERTED_EMPLOYEE: Your applicant account has been activated as an employee. Please log in through the employee portal instead.');
    }

    // Retroactive conversion check: if a user_profile exists with this email,
    // the applicant was approved before the status update was in place — self-heal.
    if (applicant.status === 'active' || applicant.status === 'onboarding') {
      const { data: employeeProfile } = await supabase
        .from('user_profile')
        .select('user_id')
        .eq('email', applicant.email)
        .maybeSingle();
      if (employeeProfile) {
        await supabase
          .from('applicant_profile')
          .update({ status: 'converted_employee' })
          .eq('applicant_id', applicant.applicant_id);
        throw new UnauthorizedException('CONVERTED_EMPLOYEE: Your applicant account has been activated as an employee. Please log in through the employee portal instead.');
      }
    }

    // 3. Block unverified accounts
    if (applicant.status === 'unverified') {
      throw new UnauthorizedException('Please verify your email before signing in.');
    }

    // 3. Check password
    const isMatch = await bcrypt.compare(dto.password, applicant.password_hash);
    if (!isMatch) throw new UnauthorizedException('Incorrect password. Please try again.');

    // 4. Issue tokens
    const access_token = await this.jwtService.signAsync(
      {
        type: 'access',
        sub_userid: applicant.applicant_id,
        role_name: 'Applicant',
        company_id: applicant.company_id ?? null,
        first_name: applicant.first_name,
        last_name: applicant.last_name,
        phone_number: applicant.phone_number ?? null,
      },
      { expiresIn: '8h' },
    );

    const refresh_token = await this.jwtService.signAsync(
      { type: 'refresh', sub_userid: applicant.applicant_id },
      { expiresIn: '7d' },
    );

    const decoded: any = this.jwtService.decode(refresh_token);
    await supabase.from('applicant_refresh_session').insert({
      applicant_id: applicant.applicant_id,
      token_hash: sha256(refresh_token),
      expires_at: new Date(decoded.exp * 1000).toISOString(),
    });

    return { access_token, refresh_token };
  }

  async refresh(refreshToken: string) {
    const supabase = this.supabaseService.getClient();

    let decoded: any;
    try {
      decoded = await this.jwtService.verifyAsync(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (decoded.type !== 'refresh') throw new UnauthorizedException('Invalid refresh token type');

    const token_hash = sha256(refreshToken);

    const { data: session, error } = await supabase
      .from('applicant_refresh_session')
      .select('expires_at, revoked_at')
      .eq('applicant_id', decoded.sub_userid)
      .eq('token_hash', token_hash)
      .maybeSingle();

    if (error || !session) throw new UnauthorizedException('Session not found');
    if (session.revoked_at) throw new UnauthorizedException('Session revoked');
    if (new Date(session.expires_at) <= new Date()) throw new UnauthorizedException('Session expired');

    // Fetch fresh applicant data
    const { data: applicant, error: appErr } = await supabase
      .from('applicant_profile')
      .select('applicant_id, first_name, last_name, role, company_id, status')
      .eq('applicant_id', decoded.sub_userid)
      .maybeSingle();

    if (appErr || !applicant) throw new UnauthorizedException('Applicant not found');
    if (applicant.status === 'converted_employee') throw new UnauthorizedException('CONVERTED_EMPLOYEE: Your applicant account has been activated as an employee. Please log in through the employee portal instead.');
    if (applicant.status === 'inactive') throw new UnauthorizedException('Account deactivated');

    const access_token = await this.jwtService.signAsync(
      {
        type: 'access',
        sub_userid: applicant.applicant_id,
        role_name: applicant.role,
        first_name: applicant.first_name,
        last_name: applicant.last_name,
        company_id: applicant.company_id ?? null,
      },
      { expiresIn: '15m' },
    );

    return { access_token };
  }

  async resendVerification(email: string) {
    if (!email) throw new BadRequestException('Email is required');

    const supabase = this.supabaseService.getClient();

    // 1. Find applicant by email
    const { data: applicant } = await supabase
      .from('applicant_profile')
      .select('applicant_id, email, status')
      .eq('email', email)
      .maybeSingle();

    if (!applicant) throw new BadRequestException('No account found with that email address.');
    if (applicant.status !== 'unverified') throw new BadRequestException('This account is already verified.');

    // 2. Invalidate all existing unused tokens so old links no longer work
    await supabase
      .from('email_verifications')
      .update({ used_at: new Date().toISOString() })
      .eq('applicant_id', applicant.applicant_id)
      .is('used_at', null);

    // 3. Generate new token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error: tokenError } = await supabase
      .from('email_verifications')
      .insert({
        applicant_id: applicant.applicant_id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

    if (tokenError) throw new InternalServerErrorException('Could not generate a new verification link. Please try again.');

    // 4. Send new verification email
    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
    const verifyLink = `${appUrl}/applicant/verify-email?token=${rawToken}`;

    try {
      await this.mailService.sendVerificationEmail(email, verifyLink);
    } catch {
      throw new InternalServerErrorException('We could not send the verification email. Please try again.');
    }

    return { message: 'A new verification email has been sent. Please check your inbox.' };
  }

  async getMe(applicantId: string) {
    const supabase = this.supabaseService.getClient();

    // Try progressively simpler SELECTs — columns may not exist yet pre-migration
    const selectCols = [
      'applicant_id, first_name, middle_name, last_name, email, phone_number, personal_email, date_of_birth, place_of_birth, nationality, civil_status, complete_address, applicant_code, avatar_url, resume_url, resume_name, resume_uploaded_at',
      'applicant_id, first_name, middle_name, last_name, email, phone_number, personal_email, date_of_birth, place_of_birth, nationality, civil_status, complete_address, applicant_code, avatar_url',
      'applicant_id, first_name, last_name, email, phone_number, applicant_code',
    ];

    let profile: Record<string, any> | null = null;

    for (const cols of selectCols) {
      const { data, error } = await (supabase as any)
        .from('applicant_profile')
        .select(cols)
        .eq('applicant_id', applicantId)
        .maybeSingle();
      if (!error && data) {
        profile = data as Record<string, any>;
        break;
      }
    }

    if (!profile) throw new NotFoundException('Profile not found');

    // resume_url is stored as a file path — generate a fresh 7-day signed URL on every fetch
    if (profile['resume_url'] && !profile['resume_url'].startsWith('https://')) {
      const { data: urlData } = await supabase.storage
        .from('applicant-resumes')
        .createSignedUrl(profile['resume_url'], 60 * 60 * 24 * 7);
      if (urlData?.signedUrl) {
        profile['resume_url'] = urlData.signedUrl;
      }
    }

    return profile;
  }

  async uploadResume(applicantId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded.');

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only PDF, DOC, and DOCX are allowed.');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('File is too large. Maximum size is 5MB.');
    }

    const supabase = this.supabaseService.getClient();

    const filePath = `${applicantId}/${Date.now()}_${file.originalname}`;
    const { error: uploadErr } = await supabase.storage
      .from('applicant-resumes')
      .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: true });

    if (uploadErr) throw new BadRequestException(`Upload failed: ${uploadErr.message}`);

    // Store the file PATH (not a signed URL) so the reference never expires.
    // A fresh signed URL is generated on every getMe() call.
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('applicant_profile')
      .update({ resume_url: filePath, resume_name: file.originalname, resume_uploaded_at: now })
      .eq('applicant_id', applicantId);

    if (updateError) throw new InternalServerErrorException('Failed to save resume metadata.');

    // Generate a signed URL to return immediately to the caller
    const { data: urlData } = await supabase.storage
      .from('applicant-resumes')
      .createSignedUrl(filePath, 60 * 60 * 24 * 7);

    return {
      resume_url: urlData?.signedUrl ?? filePath,
      resume_name: file.originalname,
      resume_uploaded_at: now,
    };
  }

  async deleteResume(applicantId: string) {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('applicant_profile')
      .update({ resume_url: null, resume_name: null, resume_uploaded_at: null })
      .eq('applicant_id', applicantId);
    if (error) throw new InternalServerErrorException('Failed to delete resume.');
    return { message: 'Resume deleted' };
  }

  async updateMe(applicantId: string, body: {
    first_name?: string;
    middle_name?: string;
    last_name?: string;
    phone_number?: string;
    personal_email?: string;
    date_of_birth?: string;
    place_of_birth?: string;
    nationality?: string;
    civil_status?: string;
    complete_address?: string;
    avatar_url?: string;
  }) {
    const allowed = ['first_name','middle_name','last_name','phone_number','personal_email','date_of_birth','place_of_birth','nationality','civil_status','complete_address','avatar_url'];
    const patch: Record<string,any> = {};
    for (const key of allowed) {
      if (body[key as keyof typeof body] !== undefined) patch[key] = body[key as keyof typeof body];
    }
    if (Object.keys(patch).length === 0) return { message: 'Nothing to update' };

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('applicant_profile')
      .update(patch)
      .eq('applicant_id', applicantId)
      .select('applicant_id, first_name, middle_name, last_name, email, phone_number, personal_email, date_of_birth, place_of_birth, nationality, civil_status, complete_address, avatar_url, resume_url, resume_name, resume_uploaded_at')
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to update profile');
    return data;
  }

  async logout(refreshToken: string, accessToken?: string) {
    const supabase = this.supabaseService.getClient();

    let decoded: any;
    try {
      decoded = await this.jwtService.verifyAsync(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await supabase
      .from('applicant_refresh_session')
      .update({ revoked_at: new Date().toISOString() })
      .eq('applicant_id', decoded.sub_userid)
      .eq('token_hash', sha256(refreshToken));

    if (accessToken) {
      try {
        const accessDecoded: any = await this.jwtService.verifyAsync(accessToken);
        if (accessDecoded?.exp) {
          await supabase.from('token_blacklist').insert({
            token_hash: sha256(accessToken),
            expires_at: new Date(accessDecoded.exp * 1000).toISOString(),
          });
        }
      } catch { /* best-effort */ }
    }
  }
}
