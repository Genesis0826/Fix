import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { TimePunchDto } from './dto/time-punch.dto';
import { ReportAbsenceDto } from './dto/report-absence.dto';

type AttendanceLogType = 'time-in' | 'time-out' | 'break-start' | 'break-end' | 'absence';
type ClockType = 'ON-TIME' | 'LATE' | 'EARLY' | 'OVERTIME';

type TimeLogRow = {
  log_id: string;
  employee_id: string | null;
  schedule_id: string | null;
  log_type: AttendanceLogType;
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
  ip_address: string | null;
  is_mock_location: boolean;
  clock_type?: ClockType | null;
  status?: string | null;
  log_status: string | null;
  absence_reason?: string | null;
  absence_notes?: string | null;
};

type ScheduleRow = {
  sched_id: string;
  employee_id: string;
  workdays: string | string[] | null;
  start_time: string | null;
  end_time: string | null;
  break_start?: string | null;
  break_end?: string | null;
  is_nightshift: boolean | null;
};

function getIp(req?: any): string | null {
  if (!req) return null;
  const xf = req.headers?.['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || null;
}

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    date: start.toISOString().split('T')[0],
  };
}

@Injectable()
export class TimekeepingService {
  private readonly logger = new Logger(TimekeepingService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private async getEmployeeId(userId: string): Promise<string | null> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('user_profile')
      .select('employee_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data?.employee_id ?? null;
  }

  private getTodayWorkdayCode(date = new Date()): string {
    const day = date.getDay();
    const map = ['SUN', 'MON', 'TUES', 'WED', 'THURS', 'FRI', 'SAT'];
    return map[day];
  }

  private normalizeWorkdays(
    workdays: string | string[] | null | undefined,
  ): string[] {
    if (!workdays) return [];

    if (Array.isArray(workdays)) {
      return workdays.map((d) => String(d).trim().toUpperCase());
    }

    return String(workdays)
      .split(',')
      .map((d) => d.trim().toUpperCase())
      .filter(Boolean);
  }

  private isScheduledForToday(
    workdays: string | string[] | null | undefined,
    date = new Date(),
  ): boolean {
    const todayCode = this.getTodayWorkdayCode(date);
    const normalized = this.normalizeWorkdays(workdays);

    return normalized.includes(todayCode);
  }

  private parseScheduleTime(
    baseDate: Date,
    rawTime: string | null | undefined,
  ): Date | null {
    if (!rawTime) return null;

    const timeStr = String(rawTime).trim();

    const fullDate = new Date(timeStr);
    if (!Number.isNaN(fullDate.getTime()) && timeStr.includes('T')) {
      return fullDate;
    }

    const militaryMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(timeStr);
    if (militaryMatch) {
      const [, hh, mm, ss] = militaryMatch;
      const d = new Date(baseDate);
      d.setHours(Number(hh), Number(mm), Number(ss ?? 0), 0);
      return d;
    }

    const ampmMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i.exec(timeStr);
    if (ampmMatch) {
      let [, hh, mm, ss, ampm] = ampmMatch;
      let hour = Number(hh);

      if (ampm.toUpperCase() === 'AM') {
        if (hour === 12) hour = 0;
      } else if (hour !== 12) {
        hour += 12;
      }

      const d = new Date(baseDate);
      d.setHours(hour, Number(mm), Number(ss ?? 0), 0);
      return d;
    }

    return null;
  }

  private buildScheduleWindow(schedule: ScheduleRow, now = new Date()) {
    const baseDate = new Date(now);

    const shiftStart = this.parseScheduleTime(baseDate, schedule.start_time);
    const shiftEnd = this.parseScheduleTime(baseDate, schedule.end_time);

    if (!shiftStart || !shiftEnd) {
      throw new BadRequestException(
        'Employee schedule has invalid start/end time.',
      );
    }

    if (schedule.is_nightshift && shiftEnd <= shiftStart) {
      shiftEnd.setDate(shiftEnd.getDate() + 1);
    }

    return { shiftStart, shiftEnd };
  }

  private computeClockTypeForTimeIn(
    now: Date,
    schedule: ScheduleRow,
  ): ClockType {
    const { shiftStart } = this.buildScheduleWindow(schedule, now);

    if (now.getTime() > shiftStart.getTime()) return 'LATE';
    return 'ON-TIME';
  }

  private computeClockTypeForTimeOut(
    now: Date,
    schedule: ScheduleRow,
  ): ClockType {
    const { shiftEnd } = this.buildScheduleWindow(schedule, now);

    if (now.getTime() < shiftEnd.getTime()) return 'EARLY';
    if (now.getTime() > shiftEnd.getTime()) return 'OVERTIME';
    return 'ON-TIME';
  }

  private async getScheduleForEmployee(
    employeeId: string,
  ): Promise<ScheduleRow | null> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('schedules')
      .select(
        'sched_id, employee_id, workdays, start_time, end_time, break_start, break_end, is_nightshift',
      )
      .eq('employee_id', employeeId)
      .maybeSingle<ScheduleRow>();

    if (error) throw new Error(error.message);

    return data ?? null;
  }

  private async getScheduleForToday(employeeId: string): Promise<ScheduleRow | null> {
    const schedule = await this.getScheduleForEmployee(employeeId);
    if (!schedule) return null;
    if (!this.isScheduledForToday(schedule.workdays)) return null;
    return schedule;
  }

  private async getLatestLogForToday(
    employeeId: string,
  ): Promise<TimeLogRow | null> {
    const supabase = this.supabaseService.getClient();
    const { start, end } = todayRange();

    const { data, error } = await supabase
      .from('attendance_time_logs')
      .select(
        'log_id, employee_id, schedule_id, log_type, timestamp, latitude, longitude, ip_address, is_mock_location, clock_type, status, log_status',
      )
      .eq('employee_id', employeeId)
      .gte('timestamp', start)
      .lte('timestamp', end)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle<TimeLogRow>();

    if (error) {
      this.logger.error(
        `DB error while reading latest log for employee ${employeeId}`,
        error,
      );
      throw new Error(error.message);
    }

    return data ?? null;
  }

  async timeIn(userId: string, dto: TimePunchDto, req?: any) {
    const supabase = this.supabaseService.getClient();
    const { date: today } = todayRange();

    const employeeId = await this.getEmployeeId(userId);
    if (!employeeId) {
      throw new BadRequestException(
        'Employee profile not found. Cannot record time-in.',
      );
    }

    const [schedule, existing] = await Promise.all([
      this.getScheduleForToday(employeeId),
      this.getLatestLogForToday(employeeId),
    ]);

    if (existing?.log_type === 'absence') {
      throw new BadRequestException(
        'You have reported an absence for today. Clock-in is not allowed.',
      );
    }

    if (existing?.log_type === 'time-in') {
      throw new BadRequestException(
        'You have already timed in today. Please time out before timing in again.',
      );
    }

    if (existing?.log_type === 'time-out') {
      throw new BadRequestException(
        'You have already completed your attendance for today. Multiple shifts per day are not allowed.',
      );
    }

    const nowDate = new Date();
    const now = nowDate.toISOString();
    const log_id = crypto.randomUUID();
    const clockType = schedule ? this.computeClockTypeForTimeIn(nowDate, schedule) : null;

    const { error: insertError } = await supabase
      .from('attendance_time_logs')
      .insert({
        log_id,
        employee_id: employeeId,
        schedule_id: schedule?.sched_id ?? null,
        log_type: 'time-in',
        timestamp: now,
        latitude: dto.latitude,
        longitude: dto.longitude,
        ip_address: getIp(req),
        is_mock_location: false,
        clock_type: clockType,
        status: 'PRESENT',
        log_status: 'PENDING',
      });

    if (insertError) {
      this.logger.error(
        `Failed to insert time-in for employee: ${employeeId}`,
        insertError,
      );
      throw new Error(insertError.message);
    }

    this.logger.log(`time-in recorded — employee: ${employeeId} at ${now}`);

    return {
      log_id,
      employee_id: employeeId,
      schedule_id: schedule?.sched_id ?? null,
      log_type: 'time-in',
      clock_type: clockType,
      status: 'PRESENT',
      log_status: 'PENDING',
      timestamp: now,
      latitude: dto.latitude,
      longitude: dto.longitude,
      date: today,
    };
  }

  async timeOut(userId: string, dto: TimePunchDto, req?: any) {
    const supabase = this.supabaseService.getClient();
    const { date: today } = todayRange();

    const employeeId = await this.getEmployeeId(userId);
    if (!employeeId) {
      throw new BadRequestException(
        'Employee profile not found. Cannot record time-out.',
      );
    }

    const [schedule, lastPunch] = await Promise.all([
      this.getScheduleForToday(employeeId),
      this.getLatestLogForToday(employeeId),
    ]);

    if (!lastPunch) {
      throw new BadRequestException(
        'You have not timed in today. Please time in first.',
      );
    }

    if (lastPunch.log_type === 'absence') {
      throw new BadRequestException(
        'You have reported an absence for today. Clock-out is not allowed.',
      );
    }

    if (lastPunch.log_type === 'time-out') {
      throw new BadRequestException(
        'You have already timed out. Please time in again before timing out.',
      );
    }

    const nowDate = new Date();
    const now = nowDate.toISOString();
    const log_id = crypto.randomUUID();
    const clockType = schedule ? this.computeClockTypeForTimeOut(nowDate, schedule) : null;

    const { error: insertError } = await supabase
      .from('attendance_time_logs')
      .insert({
        log_id,
        employee_id: employeeId,
        schedule_id: schedule?.sched_id ?? null,
        log_type: 'time-out',
        timestamp: now,
        latitude: dto.latitude,
        longitude: dto.longitude,
        ip_address: getIp(req),
        is_mock_location: false,
        clock_type: clockType,
        status: 'PRESENT',
        log_status: 'PENDING',
      });

    if (insertError) {
      this.logger.error(
        `Failed to insert time-out for employee: ${employeeId}`,
        insertError,
      );
      throw new Error(insertError.message);
    }

    this.logger.log(`time-out recorded — employee: ${employeeId} at ${now}`);

    return {
      log_id,
      employee_id: employeeId,
      schedule_id: schedule?.sched_id ?? null,
      log_type: 'time-out',
      clock_type: clockType,
      status: 'PRESENT',
      log_status: 'PENDING',
      timestamp: now,
      latitude: dto.latitude,
      longitude: dto.longitude,
      date: today,
    };
  }

  async getMyStatus(userId: string) {
    const supabase = this.supabaseService.getClient();
    const { start, end, date: today } = todayRange();

    const employeeId = await this.getEmployeeId(userId);
    if (!employeeId) {
      return {
        date: today,
        current_status: null,
        time_in: null,
        time_out: null,
        schedule: null,
      };
    }

    const schedule = await this.getScheduleForEmployee(employeeId).catch(
      () => null,
    );

    const { data, error } = await supabase
      .from('attendance_time_logs')
      .select(
        'log_id, schedule_id, log_type, timestamp, latitude, longitude, ip_address, clock_type, status, log_status',
      )
      .eq('employee_id', employeeId)
      .gte('timestamp', start)
      .lte('timestamp', end)
      .order('timestamp', { ascending: true });

    if (error) throw new Error(error.message);

    const logs = data ?? [];
    const lastPunch = logs.at(-1);

    return {
      date: today,
      current_status: lastPunch?.log_type ?? null,
      time_in: logs.find((l) => l.log_type === 'time-in') ?? null,
      time_out: logs.find((l) => l.log_type === 'time-out') ?? null,
      schedule: schedule
        ? {
            sched_id: schedule.sched_id,
            workdays: schedule.workdays,
            start_time: schedule.start_time,
            end_time: schedule.end_time,
            is_nightshift: schedule.is_nightshift,
          }
        : null,
    };
  }

  async getMyTimesheet(userId: string, from?: string, to?: string) {
    const supabase = this.supabaseService.getClient();

    const employeeId = await this.getEmployeeId(userId);
    if (!employeeId) return [];

    let query = supabase
      .from('attendance_time_logs')
      .select(
        'log_id, schedule_id, log_type, timestamp, latitude, longitude, ip_address, clock_type, status, log_status, absence_reason, absence_notes',
      )
      .eq('employee_id', employeeId)
      .order('timestamp', { ascending: false });

    if (from) query = query.gte('timestamp', `${from}T00:00:00.000Z`);
    if (to) query = query.lte('timestamp', `${to}T23:59:59.999Z`);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return this.groupByDate(data ?? []);
  }

  async getEmployeeUsers(companyId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: roles } = await supabase
      .from('role')
      .select('role_id')
      .eq('role_name', 'Employee')
      .eq('company_id', companyId);

    const roleIds = (roles ?? []).map((r) => r.role_id);
    if (!roleIds.length) return [];

    const { data, error } = await supabase
      .from('user_profile')
      .select('user_id, employee_id, first_name, last_name')
      .eq('company_id', companyId)
      .not('employee_id', 'is', null)
      .in('role_id', roleIds);

    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async getAllTimesheets(companyId: string, from?: string, to?: string) {
    const supabase = this.supabaseService.getClient();
    const employees = await this.getEmployeeUsers(companyId);

    const employeeIds = employees.map((row) => row.employee_id).filter(Boolean);

    if (employeeIds.length === 0) return [];

    let query = supabase
      .from('attendance_time_logs')
      .select(`
        log_id,
        employee_id,
        schedule_id,
        log_type,
        timestamp,
        latitude,
        longitude,
        ip_address,
        is_mock_location,
        clock_type,
        status,
        log_status,
        absence_reason,
        absence_notes
      `)
      .in('employee_id', employeeIds)
      .order('timestamp', { ascending: false });

    if (from) query = query.gte('timestamp', `${from}T00:00:00.000Z`);
    if (to) query = query.lte('timestamp', `${to}T23:59:59.999Z`);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return data ?? [];
  }

  async getEmployeeDetail(
    targetUserId: string,
    date: string,
    companyId: string,
  ) {
    const supabase = this.supabaseService.getClient();

    const { data: targetUser, error: userError } = await supabase
      .from('user_profile')
      .select('user_id, first_name, last_name, employee_id, company_id')
      .eq('user_id', targetUserId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (userError) throw new Error(userError.message);
    if (!targetUser)
      throw new NotFoundException('Employee not found in your company');
    if (!targetUser.employee_id)
      throw new NotFoundException('Employee ID not assigned yet');

    const schedule = await this.getScheduleForEmployee(
      targetUser.employee_id,
    ).catch(() => null);

    const { data: logs, error: logsError } = await supabase
      .from('attendance_time_logs')
      .select(`
        log_id,
        employee_id,
        schedule_id,
        log_type,
        timestamp,
        latitude,
        longitude,
        ip_address,
        is_mock_location,
        clock_type,
        status,
        log_status
      `)
      .eq('employee_id', targetUser.employee_id)
      .gte('timestamp', `${date}T00:00:00.000Z`)
      .lte('timestamp', `${date}T23:59:59.999Z`)
      .order('timestamp', { ascending: true });

    if (logsError) throw new Error(logsError.message);

    return {
      user_id: targetUser.user_id,
      employee_id: targetUser.employee_id,
      first_name: targetUser.first_name,
      last_name: targetUser.last_name,
      date,
      schedule: schedule
        ? {
            sched_id: schedule.sched_id,
            workdays: schedule.workdays,
            start_time: schedule.start_time,
            end_time: schedule.end_time,
            break_start: schedule.break_start,
            break_end: schedule.break_end,
            is_nightshift: schedule.is_nightshift,
          }
        : null,
      punches: logs ?? [],
    };
  }

  async reportAbsence(userId: string, dto: ReportAbsenceDto) {
    const supabase = this.supabaseService.getClient();
    const { date: today, start, end } = todayRange();

    const employeeId = await this.getEmployeeId(userId);
    if (!employeeId) {
      throw new BadRequestException('Employee profile not found. Cannot report absence.');
    }

    const { data: existing } = await supabase
      .from('attendance_time_logs')
      .select('log_id, log_type')
      .eq('employee_id', employeeId)
      .gte('timestamp', start)
      .lte('timestamp', end)
      .limit(1)
      .maybeSingle();

    if (existing?.log_type === 'time-in' || existing?.log_type === 'time-out') {
      throw new BadRequestException('Cannot report absence after clocking in.');
    }
    if (existing?.log_type === 'absence') {
      throw new BadRequestException('Absence already reported for today.');
    }

    const log_id = crypto.randomUUID();
    const now = new Date().toISOString();

    const { error } = await supabase.from('attendance_time_logs').insert({
      log_id,
      employee_id: employeeId,
      log_type: 'absence',
      timestamp: now,
      absence_reason: dto.reason,
      absence_notes: dto.notes ?? null,
      status: 'ABSENT',
      log_status: 'PENDING',
      is_mock_location: false,
    });

    if (error) throw new Error(error.message);

    this.logger.log(`Absence reported — employee: ${employeeId}, reason: ${dto.reason}`);
    return { log_id, date: today, reason: dto.reason, notes: dto.notes ?? null };
  }

  private groupByDate(logs: any[]) {
    const grouped: Record<
      string,
      {
        date: string;
        time_in: any;
        time_out: any;
        absence: any;
        all_logs: any[];
      }
    > = {};

    for (const log of logs) {
      const logDate = log.timestamp.split('T')[0];

      if (!grouped[logDate]) {
        grouped[logDate] = {
          date: logDate,
          time_in: null,
          time_out: null,
          absence: null,
          all_logs: [],
        };
      }

      grouped[logDate].all_logs.push(log);

      if (log.log_type === 'time-in' && !grouped[logDate].time_in) {
        grouped[logDate].time_in = log;
      }
      if (log.log_type === 'time-out') {
        grouped[logDate].time_out = log;
      }
      if (log.log_type === 'absence') {
        grouped[logDate].absence = log;
      }
    }

    return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
  }
}
