import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { TenantContextInterceptor } from '../common/tenant-context.interceptor';
import { HrQiwaController } from './hr-qiwa.controller';
import { HrQiwaContractRepository, HrQiwaEstablishmentRepository } from './hr-qiwa.repositories';
import { HrQiwaService } from './hr-qiwa.service';
import { HrController } from './hr.controller';
import { HR_REPOSITORIES } from './hr.repositories';
import { HrService } from './hr.service';
import { PayslipPdfService } from './payslip-pdf.service';

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [HrController, HrQiwaController],
  providers: [
    HrService,
    HrQiwaService,
    HrQiwaEstablishmentRepository,
    HrQiwaContractRepository,
    PayslipPdfService,
    ...HR_REPOSITORIES,
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
  ],
  exports: [HrService],
})
export class HrModule {}
