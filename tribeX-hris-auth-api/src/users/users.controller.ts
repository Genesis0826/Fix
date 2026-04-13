import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  HttpCode,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateChangeRequestDto } from './dto/create-change-request.dto';
import { ReviewChangeRequestDto } from './dto/review-change-request.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

// Role names must match exactly what is stored in the `role` table
const HR_AND_ABOVE = [
  'Admin',
  'System Admin',
  'HR Officer',
  'HR Recruiter',
  'HR Interviewer',
  'Manager',
];
const ADMIN_ONLY = ['Admin', 'System Admin'];
const SYSTEM_ADMIN_ONLY = ['System Admin'];

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('company/me')
  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  getMyCompany(@Req() req: any) {
    return this.usersService.getCompanyInfo(req.user.company_id);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  findAll(@Req() req: any) {
    return this.usersService.findAll(req.user.company_id);
  }

  @Get('roles')
  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  getRoles(@Req() req: any) {
    return this.usersService.getRoles(req.user.company_id);
  }

  @UseGuards(RolesGuard)
  @Roles(...ADMIN_ONLY)
  @Post('departments')
  async createDepartment(
    @Body('department_name') name: string,
    @Req() req: any,
  ) {
    if (!name?.trim())
      throw new BadRequestException('Department name is required.');
    return this.usersService.createDepartment(name.trim(), req.user.company_id, req.user.sub_userid);
  }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  stats(@Req() req: any) {
    return this.usersService.stats(req.user.company_id);
  }

  @Get('departments')
  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  getDepartments(@Req() req: any) {
    return this.usersService.getDepartments(req.user.company_id);
  }

  @UseGuards(RolesGuard)
  @Roles(...ADMIN_ONLY)
  @Patch('departments/:id')
  async renameDepartment(
    @Param('id') id: string,
    @Body('department_name') name: string,
    @Req() req: any,
  ) {
    if (!name?.trim())
      throw new BadRequestException('Department name is required.');
    return this.usersService.renameDepartment(id, name.trim(), req.user.company_id, req.user.sub_userid);
  }

  @UseGuards(RolesGuard)
  @Roles(...ADMIN_ONLY)
  @Delete('departments/:id')
  async deleteDepartment(@Param('id') id: string, @Req() req: any) {
    return this.usersService.deleteDepartment(id, req.user.company_id, req.user.sub_userid);
  }

  @Get('companies')
  @UseGuards(RolesGuard)
  @Roles(...ADMIN_ONLY)
  getCompanies(@Req() req: any) {
    return this.usersService.getCompanies(req.user.company_id);
  }

  @Get('hr-lifecycle/permissions')
  @UseGuards(RolesGuard)
  @Roles(...SYSTEM_ADMIN_ONLY)
  getLifecyclePermissions(@Req() req: any) {
    return this.usersService.getLifecyclePermissions(req.user.company_id);
  }

  @Put('hr-lifecycle/permissions')
  @UseGuards(RolesGuard)
  @Roles(...SYSTEM_ADMIN_ONLY)
  saveLifecyclePermissions(@Body() modules: unknown, @Req() req: any) {
    if (!Array.isArray(modules)) {
      throw new BadRequestException('Request body must be an array.');
    }

    return this.usersService.saveLifecyclePermissions(
      modules,
      req.user.company_id,
      req.user.sub_userid,
    );
  }

  // ---- Profile Change Requests ----
  // NOTE: these exact-path routes are declared before ':id' so NestJS priority routing applies

  @Post('me/change-requests')
  submitChangeRequest(@Req() req: any, @Body() dto: CreateChangeRequestDto) {
    return this.usersService.submitChangeRequest(req.user.sub_userid, req.user.company_id, dto);
  }

  @Get('me/change-requests')
  getMyChangeRequests(@Req() req: any) {
    return this.usersService.getMyChangeRequests(req.user.sub_userid);
  }

  @Get('change-requests')
  @UseGuards(RolesGuard)
  @Roles('HR Officer', 'HR Recruiter', 'Admin', 'System Admin')
  getChangeRequests(@Req() req: any, @Query('status') status?: string) {
    return this.usersService.getChangeRequestsForCompany(req.user.company_id, status);
  }

  @Patch('change-requests/:requestId')
  @UseGuards(RolesGuard)
  @Roles('HR Officer', 'HR Recruiter', 'Admin', 'System Admin')
  reviewChangeRequest(
    @Param('requestId') requestId: string,
    @Req() req: any,
    @Body() dto: ReviewChangeRequestDto,
  ) {
    return this.usersService.reviewChangeRequest(requestId, req.user.sub_userid, req.user.company_id, dto);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.usersService.findOne(id, req.user.company_id);
  }

  @UseGuards(RolesGuard)
  @Roles(...ADMIN_ONLY)
  @Post()
  create(@Body() createUserDto: CreateUserDto, @Req() req: any) {
    const companyId = createUserDto.company_id ?? req.user.company_id;
    if (!companyId)
      throw new BadRequestException('Your account has no company assignment.');
    return this.usersService.create(
      createUserDto,
      companyId,
      req.user.sub_userid,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: any,
  ) {
    return this.usersService.update(
      id,
      updateUserDto,
      req.user.company_id,
      req.user.sub_userid,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.usersService.remove(
      id,
      req.user.company_id,
      req.user.sub_userid,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @Patch(':id/assign-email')
  async assignCompanyEmail(
    @Param('id') id: string,
    @Body('email') email: string,
    @Req() req: any,
  ) {
    if (!email?.trim()) throw new BadRequestException('email is required');
    return this.usersService.assignCompanyEmail(id, email.trim().toLowerCase(), req.user.company_id, req.user.sub_userid);
  }

  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @Patch(':id/resend-invite')
  async resendInvite(@Param('id') id: string, @Req() req: any) {
    return this.usersService.resendInvite(
      id,
      req.user.company_id ?? '',
      req.user.sub_userid,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @Patch(':id/reactivate')
  async reactivate(@Param('id') id: string, @Req() req: any) {
    return this.usersService.reactivate(
      id,
      req.user.company_id,
      req.user.sub_userid,
    );
  }

  @Get('me')
  @HttpCode(200)
  getMe(@Req() req: any) {
    return this.usersService.getMe(req.user.sub_userid);
  }

  @Patch('me')
  @HttpCode(200)
  updateMe(@Req() req: any, @Body() body: any) {
    return this.usersService.updateMe(req.user.sub_userid, body);
  }

  // ---- Employee Documents ----

  @Get('me/documents')
  getMyDocuments(@Req() req: any) {
    return this.usersService.getMyDocuments(req.user.sub_userid);
  }

  @Post('me/documents')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadEmployeeDocument(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body('document_type') docType: string,
  ) {
    if (!docType) throw new BadRequestException('document_type is required.');
    return this.usersService.uploadEmployeeDocument(req.user.sub_userid, docType, file);
  }

  @Delete('me/documents/:id')
  deleteEmployeeDocument(@Req() req: any, @Param('id') id: string) {
    return this.usersService.deleteEmployeeDocument(req.user.sub_userid, id);
  }

  @Get('documents/pending')
  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  getPendingDocuments(@Req() req: any) {
    return this.usersService.getPendingEmployeeDocuments(req.user.company_id);
  }

  @Patch('documents/:id/approve')
  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  approveDocument(@Param('id') id: string, @Req() req: any) {
    return this.usersService.approveEmployeeDocument(id, req.user.sub_userid);
  }

  @Patch('documents/:id/reject')
  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  rejectDocument(
    @Param('id') id: string,
    @Req() req: any,
    @Body('hr_notes') hrNotes: string,
  ) {
    if (!hrNotes) throw new BadRequestException('hr_notes is required when rejecting.');
    return this.usersService.rejectEmployeeDocument(id, req.user.sub_userid, hrNotes);
  }
}
