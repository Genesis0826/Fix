import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';

function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

@Injectable()
export class ApplicantJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    const authHeader: string | undefined =
      req.headers['authorization'] || req.headers['Authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid Authorization header format');
    }

    try {
      const decoded = this.jwtService.verify(token);

      if (decoded.type !== 'access') {
        throw new UnauthorizedException('Access token required');
      }

      if (decoded.role_name !== 'Applicant') {
        throw new UnauthorizedException('Applicant access only');
      }

      const supabase = this.supabaseService.getClient();

      const { data: blacklisted } = await supabase
        .from('token_blacklist')
        .select('token_hash')
        .eq('token_hash', sha256(token))
        .maybeSingle();
      if (blacklisted) throw new UnauthorizedException('Token has been revoked');

      const { data: applicant } = await supabase
        .from('applicant_profile')
        .select('status, email')
        .eq('applicant_id', decoded.sub_userid)
        .maybeSingle();
      if (!applicant || applicant.status === 'converted_employee' || applicant.status === 'inactive') {
        throw new UnauthorizedException('Account not active');
      }
      // 'active' and 'onboarding' are both allowed through
      if (applicant.status !== 'active' && applicant.status !== 'onboarding') {
        throw new UnauthorizedException('Account not active');
      }

      // Retroactively detect conversion: if a user_profile exists with this email,
      // the applicant has been promoted to employee — block and mark converted_employee.
      if (applicant.email) {
        const { data: employeeProfile } = await supabase
          .from('user_profile')
          .select('user_id')
          .eq('email', applicant.email)
          .maybeSingle();
        if (employeeProfile) {
          await supabase
            .from('applicant_profile')
            .update({ status: 'converted_employee' })
            .eq('applicant_id', decoded.sub_userid);
          throw new UnauthorizedException('Account has been converted to an employee account');
        }
      }

      req.user = decoded;
      return true;
    } catch (err) {
      throw new UnauthorizedException(
        err instanceof UnauthorizedException ? err.message : 'Invalid token',
      );
    }
  }
}
