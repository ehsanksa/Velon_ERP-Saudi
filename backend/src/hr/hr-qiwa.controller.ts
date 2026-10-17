import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@velon/database';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePortalScope } from '../auth/decorators/portal-scope.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { PortalScopeGuard } from '../auth/guards/portal-scope.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import {
  CreateHrQiwaContractDto,
  HrQiwaContractQueryDto,
  HrQiwaEmployeeResponseDto,
  HrQiwaExecutionNumberDto,
  HrQiwaTerminateDto,
  RecordHrQiwaNitaqatDto,
  UpdateHrQiwaContractDto,
  UpsertHrQiwaEstablishmentDto,
} from './dto/hr-qiwa.dto';
import { HrQiwaService } from './hr-qiwa.service';

@ApiTags('hr')
@Controller('hr/qiwa')
@RequirePortalScope('tenant')
@UseGuards(JwtAuthGuard, PortalScopeGuard, TenantScopeGuard, RolesGuard, PermissionGuard)
@RequirePermission('hr:read', 'hr:*')
@Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.DEPARTMENT_ADMIN, UserRole.USER)
@ApiBearerAuth()
export class HrQiwaController {
  constructor(private readonly qiwa: HrQiwaService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthenticatedUser) {
    return this.qiwa.overview(user);
  }

  @Post('establishment')
  @RequirePermission('hr:write', 'hr:*')
  saveEstablishment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertHrQiwaEstablishmentDto,
  ) {
    return this.qiwa.saveEstablishment(user, dto);
  }

  @Post('establishment/nitaqat')
  @RequirePermission('hr:write', 'hr:*')
  recordNitaqat(@CurrentUser() user: AuthenticatedUser, @Body() dto: RecordHrQiwaNitaqatDto) {
    return this.qiwa.recordNitaqat(user, dto);
  }

  @Get('contracts')
  listContracts(@CurrentUser() user: AuthenticatedUser, @Query() query: HrQiwaContractQueryDto) {
    return this.qiwa.listContracts(user, query);
  }

  @Post('contracts')
  @RequirePermission('hr:write', 'hr:*')
  createContract(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateHrQiwaContractDto) {
    return this.qiwa.createContract(user, dto);
  }

  @Get('contracts/:id')
  getContract(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.qiwa.getContract(user, id);
  }

  @Patch('contracts/:id')
  @RequirePermission('hr:write', 'hr:*')
  updateContract(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateHrQiwaContractDto,
  ) {
    return this.qiwa.updateContract(user, id, dto);
  }

  @Post('contracts/:id/validate')
  @RequirePermission('hr:write', 'hr:*')
  validateContract(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.qiwa.validateContract(user, id);
  }

  @Post('contracts/:id/send')
  @RequirePermission('hr:write', 'hr:*')
  sendToEmployee(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.qiwa.sendToEmployee(user, id);
  }

  @Post('contracts/:id/employee-response')
  @RequirePermission('hr:write', 'hr:*')
  recordEmployeeResponse(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: HrQiwaEmployeeResponseDto,
  ) {
    return this.qiwa.recordEmployeeResponse(user, id, dto);
  }

  @Post('contracts/:id/execution-number')
  @RequirePermission('hr:write', 'hr:*')
  recordExecutionNumber(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: HrQiwaExecutionNumberDto,
  ) {
    return this.qiwa.recordExecutionNumber(user, id, dto);
  }

  @Post('contracts/:id/request-update')
  @RequirePermission('hr:write', 'hr:*')
  requestUpdate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateHrQiwaContractDto,
  ) {
    return this.qiwa.requestUpdate(user, id, dto);
  }

  @Post('contracts/:id/terminate')
  @RequirePermission('hr:write', 'hr:*')
  terminate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: HrQiwaTerminateDto,
  ) {
    return this.qiwa.terminate(user, id, dto);
  }

  @Post('contracts/:id/expire')
  @RequirePermission('hr:write', 'hr:*')
  expire(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.qiwa.expire(user, id);
  }

  @Delete('contracts/:id')
  @RequirePermission('hr:write', 'hr:*')
  deleteContract(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.qiwa.deleteContract(user, id);
  }
}
