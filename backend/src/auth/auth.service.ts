import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { IndustryTemplate, Prisma, TenantPlan, UserRole } from '@velon/database';
import {
  defaultDateFormatForCountry,
  defaultNumberFormatForCountry,
  getCountryByCode,
  getCurrencySymbol,
  isKnownCountryCode,
  isKnownCurrencyCode,
  isPlatformRole,
  JwtPayload,
  normalizeVelonRole,
  saudiRegionName,
  saudiWorkspaceRegistrationErrors,
  VelonRole,
} from '@velon/shared';
import { verifySignupVerificationToken } from '@velon/shared/signup-verification';
import { AuditService } from '../audit/audit.service';
import { SubscriptionService } from '../billing/subscription.service';
import { VelonLogger } from '../common/logger.service';
import type { RequestMeta } from '../common/request-meta.util';
import { signupEmailBlockReason } from '../common/tenant-lifecycle.util';
import { getAuthOtpSecret, getJwtAccessSecret } from '../config/env';
import { EmailLifecycleService } from '../email/email-lifecycle.service';
import { NotificationService } from '../email/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import type { AuthSessionResponse, TokenIssueContext } from './auth.types';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { LoginDto, RefreshDto, SignUpDto } from './dto/login.dto';
import { assertPasswordAllowed } from './password-policy.util';

const REFRESH_DAYS = 7;
const ACCESS_TTL_SEC = 900;

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'workspace'
  );
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
    private readonly log: VelonLogger,
    @Inject(forwardRef(() => SubscriptionService))
    private readonly subscriptions: SubscriptionService,
    private readonly emailLifecycle: EmailLifecycleService,
    private readonly notifications: NotificationService,
  ) {}

  private hashRefresh(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async uniqueSlug(
    tx: Prisma.TransactionClient,
    base: string,
    table: 'tenant' | 'workspace',
  ): Promise<string> {
    let slug = slugify(base);
    for (let i = 0; i < 8; i++) {
      const exists =
        table === 'tenant'
          ? await tx.tenant.findUnique({ where: { slug } })
          : await tx.workspace.findUnique({ where: { slug } });
      if (!exists) return slug;
      slug = slugify(`${base}-${crypto.randomBytes(2).toString('hex')}`);
    }
    throw new ConflictException(
      'Could not allocate a unique workspace slug. Try a different company name.',
    );
  }

  private async issueTokens(
    ctx: TokenIssueContext,
    tx?: Prisma.TransactionClient,
  ): Promise<Omit<AuthSessionResponse, 'route'>> {
    const db = tx ?? this.prisma.client;
    const payload: JwtPayload = {
      sub: ctx.userId,
      email: ctx.email,
      scope: ctx.scope,
      role: ctx.role,
      ...(ctx.scope === 'tenant'
        ? {
            tenantId: ctx.tenantId,
            workspaceId: ctx.workspaceId,
            membershipId: ctx.membershipId,
          }
        : {}),
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: getJwtAccessSecret(),
      expiresIn: ACCESS_TTL_SEC,
    });

    const refreshToken = crypto.randomBytes(48).toString('base64url');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_DAYS);

    await db.refreshToken.create({
      data: {
        userId: ctx.userId,
        tokenHash: this.hashRefresh(refreshToken),
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TTL_SEC,
      role: ctx.role,
      email: ctx.email,
      scope: ctx.scope,
      ...(ctx.scope === 'tenant'
        ? {
            tenantId: ctx.tenantId,
            workspaceId: ctx.workspaceId,
            membershipId: ctx.membershipId,
          }
        : {}),
    };
  }

  private async resolvePlatformContext(user: {
    id: string;
    email: string;
    role: UserRole;
  }): Promise<TokenIssueContext> {
    if (!isPlatformRole(user.role as VelonRole)) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    return {
      scope: 'platform',
      userId: user.id,
      email: user.email,
      role: normalizeVelonRole(user.role) as VelonRole,
    };
  }

  private async resolveTenantContext(user: {
    id: string;
    email: string;
  }): Promise<TokenIssueContext> {
    const membership = await this.prisma.client.tenantMembership.findFirst({
      where: { userId: user.id, isActive: true },
      include: {
        tenant: {
          select: {
            id: true,
            status: true,
            deletedAt: true,
            workspace: {
              select: {
                id: true,
                isActive: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!membership?.tenant.workspace?.isActive) {
      throw new UnauthorizedException('No active workspace found for this account.');
    }

    if (membership.tenant.status === 'SUSPENDED' || membership.tenant.deletedAt) {
      throw new UnauthorizedException(
        'This workspace has been suspended. Contact your administrator.',
      );
    }

    return {
      scope: 'tenant',
      userId: user.id,
      email: user.email,
      role: membership.role as VelonRole,
      tenantId: membership.tenantId,
      workspaceId: membership.tenant.workspace.id,
      membershipId: membership.id,
    };
  }

  private toSessionResponse(tokens: Omit<AuthSessionResponse, 'route'>): AuthSessionResponse {
    return {
      ...tokens,
      route: tokens.scope === 'platform' ? 'admin' : 'app',
    };
  }

  async login(dto: LoginDto, meta?: RequestMeta): Promise<AuthSessionResponse> {
    const email = dto.email.trim().toLowerCase();
    this.log.auth('login.attempt', { email });

    try {
      const user = await this.prisma.client.user.findUnique({ where: { email } });
      if (!user?.isActive) {
        this.log.authFailure('login.failed', { email, reason: 'invalid_credentials' });
        throw new UnauthorizedException('Invalid email or password.');
      }
      if (!user.passwordHash) {
        this.log.authFailure('login.failed', { email, reason: 'missing_password_hash' });
        throw new UnauthorizedException('Invalid email or password.');
      }

      const ok = await bcrypt.compare(dto.password, user.passwordHash);
      if (!ok) {
        this.log.authFailure('login.failed', { email, reason: 'invalid_credentials' });
        throw new UnauthorizedException('Invalid email or password.');
      }

      await this.prisma.client.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      const ctx =
        user.role === UserRole.SUPER_ADMIN || user.role === UserRole.PLATFORM_SUPPORT
          ? await this.resolvePlatformContext(user)
          : await this.resolveTenantContext(user);

      await this.audit.log({
        actorId: user.id,
        tenantId: ctx.scope === 'tenant' ? ctx.tenantId : undefined,
        action: 'auth.login',
        entityType: 'user',
        entityId: user.id,
      });

      const tokens = await this.issueTokens(ctx);
      this.log.auth('login.success', {
        email,
        scope: ctx.scope,
        route: ctx.scope === 'platform' ? 'admin' : 'app',
      });

      void this.sendLoginNotification(user, ctx, meta).catch((err) => {
        this.log.authFailure('login.notification_failed', { email, reason: String(err) });
      });

      return this.toSessionResponse(tokens);
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      this.log.dbFailure('login', err, { email });
      throw err;
    }
  }

  async refresh(dto: RefreshDto): Promise<Omit<AuthSessionResponse, 'route'>> {
    const hash = this.hashRefresh(dto.refreshToken);
    const row = await this.prisma.client.refreshToken.findFirst({
      where: { tokenHash: hash, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    if (!row?.user.isActive) {
      this.log.authFailure('refresh.failed', { reason: 'invalid_token' });
      throw new UnauthorizedException('Invalid refresh token.');
    }

    await this.prisma.client.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });

    const ctx =
      row.user.role === UserRole.SUPER_ADMIN || row.user.role === UserRole.PLATFORM_SUPPORT
        ? await this.resolvePlatformContext(row.user)
        : await this.resolveTenantContext(row.user);

    this.log.auth('refresh.success', { userId: row.user.id, scope: ctx.scope });
    return this.issueTokens(ctx);
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      const hash = this.hashRefresh(refreshToken);
      await this.prisma.client.refreshToken.updateMany({
        where: { userId, tokenHash: hash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.prisma.client.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await this.audit.log({
      actorId: userId,
      action: 'auth.logout',
      entityType: 'user',
      entityId: userId,
    });
    this.log.auth('logout.success', { userId });
    return { ok: true };
  }

  async assertSignupEmailAvailable(email: string): Promise<void> {
    const blockReason = await signupEmailBlockReason(this.prisma.client, email);
    if (blockReason) {
      throw new ConflictException(blockReason);
    }
  }

  async signUp(dto: SignUpDto): Promise<AuthSessionResponse> {
    const companyEmail = dto.companyEmail.trim().toLowerCase();
    const companyName = dto.companyName.trim();
    const fullName = dto.fullName.trim();
    const countryCode = dto.countryCode.trim().toUpperCase();
    const currency = dto.currency.trim().toUpperCase();
    const timezone = dto.timezone.trim();
    let address = dto.address.trim();
    let taxId = dto.taxId?.trim() || null;
    let commercialRegistrationNumber: string | null = null;
    let vatRegistrationNumber: string | null = null;
    let legalNameAr: string | null = dto.legalNameAr?.trim() || null;
    let buildingNumber: string | null = null;
    let streetName: string | null = null;
    let district: string | null = null;
    let city: string | null = null;
    let postalCode: string | null = null;
    let additionalNumber: string | null = null;
    let region: string | null = null;

    if (countryCode === 'SA') {
      const errors = saudiWorkspaceRegistrationErrors({
        commercialRegistrationNumber: dto.commercialRegistrationNumber,
        vatRegistered: dto.vatRegistered,
        vatRegistrationNumber: dto.taxId,
        buildingNumber: dto.buildingNumber,
        streetName: dto.streetName,
        district: dto.district,
        city: dto.city,
        postalCode: dto.postalCode,
        additionalNumber: dto.additionalNumber,
        region: dto.region,
      });
      if (errors.length > 0) throw new BadRequestException(errors);
      commercialRegistrationNumber = dto.commercialRegistrationNumber?.trim() || null;
      vatRegistrationNumber = dto.vatRegistered ? (dto.taxId?.trim() ?? null) : taxId;
      taxId = vatRegistrationNumber;
      buildingNumber = dto.buildingNumber!.trim();
      streetName = dto.streetName!.trim();
      district = dto.district!.trim();
      city = dto.city!.trim();
      postalCode = dto.postalCode!.trim();
      additionalNumber = dto.additionalNumber!.trim();
      region = saudiRegionName(dto.region) ?? dto.region!.trim();
      address = [
        `${buildingNumber} ${streetName}`,
        district,
        city,
        postalCode,
        additionalNumber,
        region,
      ].join(', ');
    }
    const phone = dto.companyPhone.trim();

    if (!isKnownCountryCode(countryCode)) {
      throw new BadRequestException('Country is required and must be a valid country code.');
    }
    if (!isKnownCurrencyCode(currency)) {
      throw new BadRequestException('Currency is required and must be a valid 3-letter code.');
    }

    const countryMeta = getCountryByCode(countryCode);
    const countryName = dto.country?.trim() || countryMeta?.label || countryCode;
    const currencySymbol = getCurrencySymbol(currency);
    const dateFormat = defaultDateFormatForCountry(countryCode);
    const numberFormat = defaultNumberFormatForCountry(countryCode);

    this.log.auth('signup.attempt', { email: companyEmail, companyName, countryCode, currency });

    const otpValid = verifySignupVerificationToken(
      getAuthOtpSecret(),
      dto.verificationToken,
      companyEmail,
      companyName,
    );
    if (!otpValid) {
      this.log.authFailure('signup.failed', {
        email: companyEmail,
        reason: 'invalid_verification_token',
      });
      throw new BadRequestException(
        'Email verification expired or invalid. Complete OTP verification and try again.',
      );
    }

    const blockReason = await signupEmailBlockReason(this.prisma.client, companyEmail);
    if (blockReason) {
      this.log.authFailure('signup.failed', { email: companyEmail, reason: 'email_taken' });
      throw new ConflictException(blockReason);
    }

    const existingUser = await this.prisma.client.user.findUnique({
      where: { email: companyEmail },
    });
    try {
      await assertPasswordAllowed(dto.password);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid password.');
    }
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const plan = dto.plan ?? TenantPlan.STARTER;
    const storageCapGb =
      plan === TenantPlan.ENTERPRISE ? 500 : plan === TenantPlan.GROWTH ? 120 : 20;
    const renewal = new Date();
    renewal.setDate(renewal.getDate() + 30);

    try {
      const result = await this.prisma.client.$transaction(async (tx) => {
        const tenantSlug = await this.uniqueSlug(tx, companyName, 'tenant');
        const workspaceSlug = await this.uniqueSlug(tx, companyName, 'workspace');

        const user = existingUser
          ? await tx.user.update({
              where: { id: existingUser.id },
              data: { passwordHash, name: fullName, isActive: true },
            })
          : await tx.user.create({
              data: {
                email: companyEmail,
                passwordHash,
                name: fullName,
                role: UserRole.USER,
                isActive: true,
              },
            });

        const tenant = await tx.tenant.create({
          data: {
            name: companyName,
            slug: tenantSlug,
            tenantCode: `TNT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
            country: countryName,
            plan,
            industryTemplate: dto.industry as IndustryTemplate,
            storageCapGb,
            renewalDate: renewal,
          },
        });

        await tx.companyProfile.create({
          data: {
            tenantId: tenant.id,
            legalName: companyName,
            legalNameAr,
            email: companyEmail,
            phone,
            country: countryName,
            industry: dto.industry as IndustryTemplate,
            address,
            taxId,
            commercialRegistrationNumber,
            vatRegistrationNumber,
            buildingNumber,
            streetName,
            district,
            city,
            postalCode,
            additionalNumber,
            region,
          },
        });

        const workspace = await tx.workspace.create({
          data: {
            tenantId: tenant.id,
            name: companyName,
            slug: workspaceSlug,
            timezone,
            countryCode,
            currency,
            currencySymbol,
            dateFormat,
            numberFormat,
          },
        });

        const membership = await tx.tenantMembership.create({
          data: {
            userId: user.id,
            tenantId: tenant.id,
            role: UserRole.TENANT_OWNER,
            isActive: true,
          },
        });

        const tokens = await this.issueTokens(
          {
            scope: 'tenant',
            userId: user.id,
            email: user.email,
            role: UserRole.TENANT_OWNER as VelonRole,
            tenantId: tenant.id,
            workspaceId: workspace.id,
            membershipId: membership.id,
          },
          tx,
        );

        return { user, tenant, workspace, membership, tokens };
      });

      await this.redis.bumpRevision();
      try {
        const sub = await this.subscriptions.ensureForTenant(result.tenant.id, {
          plan,
          trialEndsAt: renewal,
          currentPeriodEnd: renewal,
        });
        void this.emailLifecycle.notifyTrialStarted(result.tenant.id, sub.id, sub.plan);
      } catch (err) {
        this.log.dbFailure('subscription.provision', err, { tenantId: result.tenant.id });
      }

      void this.emailLifecycle.notifySignup(result).catch((err) => {
        this.log.authFailure('signup.email_trigger', { reason: String(err) });
      });
      await this.audit.log({
        actorId: result.user.id,
        tenantId: result.tenant.id,
        action: 'tenant.signup',
        entityType: 'tenant',
        entityId: result.tenant.id,
        metadata: {
          email: companyEmail,
          workspaceId: result.workspace.id,
          membershipRole: UserRole.TENANT_OWNER,
          plan,
        },
      });

      this.log.auth('signup.success', {
        email: companyEmail,
        tenantId: result.tenant.id,
        workspaceId: result.workspace.id,
        plan,
      });

      return this.toSessionResponse(result.tokens);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.log.authFailure('signup.failed', { email: companyEmail, reason: 'unique_constraint' });
        throw new ConflictException('A workspace with this company name or email already exists.');
      }
      this.log.dbFailure('signup', err, { email: companyEmail });
      if (process.env.NODE_ENV !== 'production' && err instanceof Error) {
        throw new BadRequestException(`Signup failed: ${err.message}`);
      }
      throw new BadRequestException(
        'Could not create workspace. Check database connectivity and try again.',
      );
    }
  }

  /** Issue tenant session after invitation accept or membership provisioning. */
  async issueTenantSessionFromMembership(input: {
    userId: string;
    email: string;
    membershipId: string;
    tenantId: string;
    workspaceId: string;
    role: VelonRole;
  }): Promise<AuthSessionResponse> {
    const tokens = await this.issueTokens({
      scope: 'tenant',
      userId: input.userId,
      email: input.email,
      role: input.role,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      membershipId: input.membershipId,
    });
    return this.toSessionResponse(tokens);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.client.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive || !user.passwordHash) {
      throw new UnauthorizedException('Invalid current password.');
    }

    const currentOk = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!currentOk) {
      throw new UnauthorizedException('Invalid current password.');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from the current password.');
    }

    try {
      await assertPasswordAllowed(dto.newPassword);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid password.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.client.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.prisma.client.refreshToken.deleteMany({ where: { userId } });

    await this.audit.log({
      actorId: userId,
      action: 'auth.password_changed',
      entityType: 'user',
      entityId: userId,
    });

    const membership = await this.prisma.client.tenantMembership.findFirst({
      where: { userId, isActive: true },
      include: { tenant: { include: { workspace: true } } },
      orderBy: { createdAt: 'asc' },
    });

    void this.notifications
      .notifyPasswordChanged({
        userId: user.id,
        email: user.email,
        userName: user.name ?? user.email,
        tenantId: membership?.tenantId ?? null,
        workspaceName:
          membership?.tenant.workspace?.name ?? membership?.tenant.name ?? 'Velon ERP Platform',
      })
      .catch(() => undefined);

    return { ok: true as const };
  }

  private async sendLoginNotification(
    user: { id: string; email: string; name: string | null },
    ctx: TokenIssueContext,
    meta?: RequestMeta,
  ) {
    let workspaceName = 'Velon ERP Platform';
    let tenantId: string | null = null;

    if (ctx.scope === 'tenant') {
      tenantId = ctx.tenantId ?? null;
      const workspace = await this.prisma.client.workspace.findFirst({
        where: { id: ctx.workspaceId, tenantId: ctx.tenantId },
        select: { name: true },
      });
      workspaceName = workspace?.name ?? 'your workspace';
    }

    await this.notifications.notifyLogin({
      userId: user.id,
      email: user.email,
      userName: user.name ?? user.email,
      tenantId,
      workspaceName,
      meta,
    });
  }
}
