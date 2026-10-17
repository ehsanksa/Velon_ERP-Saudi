import { normalizeVelonRole, VelonRole } from './velon-role';

export const API_VERSION = 'v1';

export { VELON_CONTACT_ADDRESS, VELON_CONTACT_EMAIL, VELON_CONTACT_PHONE } from './velon-contact';

export {
  EMAIL_EVENT_TYPES,
  EMAIL_TEMPLATE_KEYS,
  MARKETING_TEMPLATE_KEYS,
  SECURITY_TEMPLATE_KEYS,
  TRANSACTIONAL_TEMPLATE_KEYS,
  type EmailEventType,
  type EmailLogStatus,
  type EmailMergeContext,
  type EmailTemplateCategory,
  type EmailTemplateKey,
} from './email-types';

export {
  COUNTRY_CATALOG,
  CURRENCY_SYMBOLS,
  DATE_FORMAT_OPTIONS,
  NUMBER_FORMAT_OPTIONS,
  TIMEZONE_OPTIONS,
  defaultDateFormatForCountry,
  defaultNumberFormatForCountry,
  numberFormatForLanguage,
  defaultTimezoneForCountry,
  formatCurrencyLabel,
  formatHijriDate,
  formatWorkspaceMoney,
  getCountryByCode,
  getCountryDefaultCurrency,
  getCurrencySymbol,
  isKnownCountryCode,
  isKnownCurrencyCode,
  type CountryCode,
  type WorkspaceMoneyFormat,
} from './localization';

export { VelonRole, normalizeVelonRole } from './velon-role';

export type AuthScope = 'platform' | 'tenant';

export const ROLE_PERMISSIONS: Record<VelonRole, string[]> = {
  [VelonRole.SUPER_ADMIN]: ['*'],
  [VelonRole.PLATFORM_SUPPORT]: [
    'tenants:read',
    'tenants:update',
    'users:read',
    'audit:read',
    'notifications:read',
  ],
  [VelonRole.TENANT_OWNER]: [
    'workspace:*',
    'tenant:read',
    'tenant:update',
    'users:read',
    'users:invite',
    'users:manage',
    'departments:*',
    'seats:read',
    'billing:*',
    'audit:read',
    'crm:*',
    'inventory:*',
    'procurement:*',
    'sales:*',
    'hr:*',
  ],
  [VelonRole.TENANT_ADMIN]: [
    'workspace:*',
    'tenant:read',
    'tenant:update',
    'users:read',
    'users:invite',
    'users:manage',
    'departments:*',
    'seats:read',
    'billing:*',
    'audit:read',
    'crm:*',
    'inventory:*',
    'procurement:*',
    'sales:*',
    'hr:*',
  ],
  [VelonRole.DEPARTMENT_ADMIN]: [
    'workspace:read',
    'workspace:write:department',
    'users:read:department',
    'crm:read',
    'crm:write',
    'inventory:read',
    'inventory:write',
    'procurement:read',
    'procurement:write',
    'sales:*',
    'hr:read',
    'hr:write',
  ],
  [VelonRole.USER]: [
    'workspace:read',
    'workspace:write:limited',
    'crm:read',
    'inventory:read',
    'procurement:read',
    'sales:read',
    'hr:read',
  ],
  [VelonRole.TENANT_USER]: [
    'workspace:read',
    'workspace:write:limited',
    'crm:read',
    'inventory:read',
    'procurement:read',
    'sales:read',
    'hr:read',
  ],
};

export function isPlatformRole(role: VelonRole | string): boolean {
  const r = normalizeVelonRole(role);
  return r === VelonRole.SUPER_ADMIN || r === VelonRole.PLATFORM_SUPPORT;
}

export function isTenantRole(role: VelonRole | string): boolean {
  const r = normalizeVelonRole(role);
  return (
    r === VelonRole.TENANT_OWNER ||
    r === VelonRole.TENANT_ADMIN ||
    r === VelonRole.DEPARTMENT_ADMIN ||
    r === VelonRole.USER ||
    r === VelonRole.TENANT_USER
  );
}

export function roleHasPermission(role: VelonRole, permission: string): boolean {
  const normalized = normalizeVelonRole(role);
  const perms = ROLE_PERMISSIONS[normalized] ?? [];
  if (perms.includes('*')) return true;
  return perms.some(
    (p) => p === permission || (p.endsWith(':*') && permission.startsWith(p.slice(0, -1))),
  );
}

export type JwtPayload = {
  sub: string;
  email: string;
  scope: AuthScope;
  role: VelonRole;
  tenantId?: string;
  workspaceId?: string;
  membershipId?: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

/** Server-only — import from `@velon/shared/signup-verification` in API code. */

export {
  SEAT_LIMITS,
  seatLimitForPlan,
  isUnlimitedSeats,
  seatsRemaining,
  canAddSeat,
} from './seats';

export { PLAN_CATALOG, planCatalogEntry, type PlanCatalogEntry } from './plans';

export {
  isSaudiBilling,
  planRegionalPricesFromDefinition,
  resolvePlanPrice,
  type PlanRegionalPrices,
  type PricingRegion,
  type ResolvedPlanPrice,
} from './plan-pricing';

export { SAUDI_EDITION } from './saudi-edition';

export {
  SAUDI_REGIONS,
  saudiRegionName,
  saudiWorkspaceRegistrationErrors,
  validateSaudiCompanyIdentifiers,
  type SaudiCompanyIdentifiers,
  type SaudiWorkspaceRegistration,
} from './saudi-address';

export {
  SAUDI_STANDARD_VAT_RULES,
  SAUDI_VAT_STANDARD_RATE_SOURCE,
  VAT_TREATMENTS,
  resolveLineVat,
  standardVatRateOn,
  type ResolvedLineVat,
  type VatRateRule,
  type VatTreatment,
} from './saudi-vat';

export {
  assessZatcaPhase1Readiness,
  buildZatcaTlvBase64,
  type ZatcaInvoiceQrInput,
  type ZatcaReadiness,
} from './zatca-qr';

export {
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULES,
  evaluatePasswordRules,
  isPasswordStrong,
  passwordStrengthMessage,
  type PasswordRuleId,
  type PasswordRuleStatus,
} from './password-policy';

export {
  PAYMENT_PROVIDERS,
  TRIAL_DAYS_DEFAULT,
  ANNUAL_BILLING_MONTHS,
  BILLING_PORTAL_PATH_PREFIXES,
  yearlyPriceFromMonthly,
  mrrForPlan,
  normalizeApiPath,
  isBillingPortalPath,
  subscriptionAllowsWorkspaceAccess,
  subscriptionAllowsBillingPortal,
  mapSubscriptionStatusToTenantStatus,
  type BillingInterval,
  type SubscriptionBillingStatus,
  type PaymentProviderId,
} from './billing';

export {
  WORKSPACE_SIDEBAR_LABELS,
  classifyDashboardLoaderError,
  isWorkspaceNavItemActive,
  normalizeWorkspacePath,
  workspaceNavHasDuplicateCrm,
  type DashboardErrorKind,
} from './workspace-navigation';

export {
  WORKSPACE_ROLE_PRESETS,
  backendRoleToPresetLabel,
  rolePresetById,
  type RolePreset,
  type RolePresetId,
} from './role-presets';

export { isAdminNavItemActive } from './admin-navigation';

export {
  DEMO_SEED_SOURCES,
  canSeedDemoTenants,
  inferDemoSeedSourceFromEmail,
  inferDemoSeedSourceFromTenantName,
  isDemoSeedSource,
  type DemoSeedSource,
} from './seed-guards';

export {
  isProductionPlatformUser,
  isProductionTenant,
  productionPlatformUserWhere,
  productionTenantWhere,
} from './production-data';

export {
  DEFAULT_WORKSPACE_PUBLIC_DOMAIN,
  resolveWorkspacePublicDomain,
  tenantWorkspaceHost,
} from './workspace-host';

export { TENANT_STATUS_COLUMN_HELP, TENANT_STATUS_DESCRIPTIONS } from './tenant-status-help';

export {
  SETTINGS_PATHS,
  SETTINGS_USER_TABS,
  WORKSPACE_ADMIN_SECTIONS,
  canManageWorkspaceBilling,
  canManageWorkspaceSettings,
  parseSettingsUserTab,
  parseWorkspaceAdminSection,
  settingsBillingSearch,
  workspaceAdminSearch,
  type SettingsUserTab,
  type WorkspaceAdminSection,
} from './settings-routes';

export {
  canReadCrm,
  canWriteCrmRecords,
  canManageCrmCustomers,
  canWriteCrmNotes,
  canWriteCrmActivities,
  canManageCrmActivities,
} from './crm-permissions';

export { canReadHr, canWriteHr } from './hr-permissions';

export { canReadInventory, canManageInventory } from './inventory-permissions';

export {
  canReadProcurement,
  canManageProcurement,
  canApproveProcurement,
} from './procurement-permissions';

export { canReadSales, canWriteSales } from './sales-permissions';

export {
  calculateInvoiceLine,
  calculateInvoiceTotals,
  resolvePaymentStatus,
  shouldDeductStock,
  type CalculatedInvoiceLine,
  type CalculatedInvoiceTotals,
  type InvoiceLineInput,
  type InvoiceTotalsInput,
} from './invoice-calculation';
