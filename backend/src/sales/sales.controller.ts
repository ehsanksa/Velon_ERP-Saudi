import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
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
  CreateSalesInvoiceDto,
  InvoiceProductSearchDto,
  InvoiceQueryDto,
  RecordInvoicePaymentDto,
  SendInvoiceEmailDto,
  UpdateSalesInvoiceDto,
} from './dto/invoice.dto';
import { InvoiceService } from './invoice.service';
import { SalesService } from './sales.service';

function reqMeta(req: Request) {
  return {
    ip: req.ip,
    ua: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  };
}

@ApiTags('sales')
@Controller('sales')
@RequirePortalScope('tenant')
@UseGuards(JwtAuthGuard, PortalScopeGuard, TenantScopeGuard, RolesGuard, PermissionGuard)
@RequirePermission('sales:read', 'sales:*')
@Roles(UserRole.TENANT_OWNER, UserRole.TENANT_ADMIN, UserRole.DEPARTMENT_ADMIN, UserRole.USER)
@ApiBearerAuth()
export class SalesController {
  constructor(
    private readonly sales: SalesService,
    private readonly invoices: InvoiceService,
  ) {}

  @Get('orders')
  listOrders(@CurrentUser() user: AuthenticatedUser) {
    return this.sales.listOrders(user);
  }

  @Get('orders/:id')
  getOrder(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.sales.getOrder(user, id);
  }

  @Post('orders/from-quotation/:quotationId')
  @RequirePermission('sales:write', 'sales:*')
  createFromQuotation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('quotationId') quotationId: string,
    @Req() req: Request,
  ) {
    return this.sales.createFromQuotation(user, quotationId, reqMeta(req));
  }

  @Get('invoices/bootstrap')
  invoiceBootstrap(@CurrentUser() user: AuthenticatedUser) {
    return this.invoices.bootstrap(user);
  }

  @Get('invoices/products')
  searchInvoiceProducts(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: InvoiceProductSearchDto,
  ) {
    return this.invoices.searchProducts(user, query);
  }

  @Get('invoices')
  listInvoices(@CurrentUser() user: AuthenticatedUser, @Query() query: InvoiceQueryDto) {
    return this.invoices.list(user, query);
  }

  @Get('invoices/:id')
  getInvoice(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.invoices.getById(user, id);
  }

  @Get('invoices/:id/pdf')
  @Header('Content-Type', 'application/pdf')
  async downloadInvoicePdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const invoice = await this.invoices.getById(user, id);
    const buffer = await this.invoices.getPdfBuffer(user, id);
    res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.pdf"`);
    return new StreamableFile(buffer);
  }

  @Post('invoices')
  @RequirePermission('sales:write', 'sales:*')
  createInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSalesInvoiceDto,
    @Req() req: Request,
  ) {
    return this.invoices.create(user, dto, reqMeta(req));
  }

  @Patch('invoices/:id')
  @RequirePermission('sales:write', 'sales:*')
  updateInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSalesInvoiceDto,
    @Req() req: Request,
  ) {
    return this.invoices.update(user, id, dto, reqMeta(req));
  }

  @Post('invoices/:id/payments')
  @RequirePermission('sales:write', 'sales:*')
  recordPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RecordInvoicePaymentDto,
    @Req() req: Request,
  ) {
    return this.invoices.recordPayment(user, id, dto, reqMeta(req));
  }

  @Post('invoices/:id/cancel')
  @RequirePermission('sales:write', 'sales:*')
  cancelInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.invoices.cancel(user, id, reqMeta(req));
  }

  @Post('invoices/:id/void')
  @RequirePermission('sales:write', 'sales:*')
  voidInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.invoices.voidInvoice(user, id, reqMeta(req));
  }

  @Post('invoices/:id/duplicate')
  @RequirePermission('sales:write', 'sales:*')
  duplicateInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.invoices.duplicate(user, id, reqMeta(req));
  }

  @Post('invoices/:id/email')
  @RequirePermission('sales:write', 'sales:*')
  emailInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SendInvoiceEmailDto,
  ) {
    return this.invoices.sendEmail(user, id, dto);
  }

  @Delete('invoices/:id')
  @RequirePermission('sales:write', 'sales:*')
  deleteInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.invoices.remove(user, id, reqMeta(req));
  }
}
