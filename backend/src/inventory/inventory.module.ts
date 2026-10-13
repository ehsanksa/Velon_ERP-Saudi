import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { TenantContextInterceptor } from '../common/tenant-context.interceptor';
import { EmailModule } from '../email/email.module';
import { InventoryBatchService } from './inventory-batch.service';
import { InventoryImportService } from './inventory-import.service';
import { INVENTORY_VARIANT_REPOSITORIES } from './inventory-variants.repositories';
import { InventoryVariantsService } from './inventory-variants.service';
import { InventoryController } from './inventory.controller';
import { INVENTORY_REPOSITORIES } from './inventory.repositories';
import { InventoryService } from './inventory.service';

@Module({
  imports: [AuditModule, AuthModule, EmailModule],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    InventoryImportService,
    InventoryBatchService,
    InventoryVariantsService,
    ...INVENTORY_REPOSITORIES,
    ...INVENTORY_VARIANT_REPOSITORIES,
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
  ],
  exports: [
    InventoryService,
    InventoryImportService,
    InventoryVariantsService,
    InventoryBatchService,
  ],
})
export class InventoryModule {}
