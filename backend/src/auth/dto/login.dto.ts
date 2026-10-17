import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { IndustryTemplate, TenantPlan } from '@velon/database';
import { VELON_CONTACT_EMAIL } from '@velon/shared';
import { IsVelonPassword } from '../validators/is-velon-password.decorator';

export class LoginDto {
  @ApiProperty({ example: VELON_CONTACT_EMAIL })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}

export class SignUpDto {
  @ApiProperty({ description: 'Legal company name' })
  @IsString()
  @MinLength(2)
  companyName!: string;

  @ApiProperty({ description: 'Company contact email (also used for login)' })
  @IsEmail()
  companyEmail!: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  companyPhone!: string;

  @ApiProperty({ description: 'ISO 3166-1 alpha-2 country code' })
  @IsString()
  @MinLength(2)
  countryCode!: string;

  @ApiProperty({ description: 'ISO 4217 currency code', example: 'SAR' })
  @IsString()
  @MinLength(3)
  @Matches(/^[A-Za-z]{3}$/, { message: 'Currency must be a 3-letter ISO code' })
  currency!: string;

  @ApiProperty({ example: 'Asia/Riyadh' })
  @IsString()
  @MinLength(3)
  timezone!: string;

  @ApiProperty({ description: 'Registered business address' })
  @IsString()
  @MinLength(5)
  address!: string;

  @ApiPropertyOptional({ description: 'Tax / VAT registration number' })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional({ description: 'Arabic registered name' })
  @IsOptional()
  @IsString()
  legalNameAr?: string;

  @ApiPropertyOptional({
    description: 'Commercial Registration number, when the business holds one',
  })
  @IsOptional()
  @IsString()
  commercialRegistrationNumber?: string;

  @ApiPropertyOptional({ description: 'True when the business is registered for VAT' })
  @IsOptional()
  @IsBoolean()
  vatRegistered?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  buildingNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  streetName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  additionalNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  region?: string;

  /** @deprecated Use countryCode — kept for backward-compatible clients */
  @ApiPropertyOptional({ description: 'Country display name (optional if countryCode is set)' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  country?: string;

  @ApiProperty({ enum: IndustryTemplate })
  @IsEnum(IndustryTemplate)
  industry!: IndustryTemplate;

  @ApiPropertyOptional({
    enum: TenantPlan,
    description: 'Subscription plan for the trial workspace (defaults to STARTER)',
    default: TenantPlan.STARTER,
  })
  @IsOptional()
  @IsEnum(TenantPlan)
  plan?: TenantPlan;

  @ApiProperty({ description: 'Full name of the account owner' })
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiProperty({
    description: 'Password — minimum 8 characters with uppercase, lowercase, number, and symbol',
  })
  @IsString()
  @MinLength(8)
  @IsVelonPassword()
  password!: string;

  @ApiProperty({ description: 'HMAC token issued after email OTP verification' })
  @IsString()
  @MinLength(16)
  verificationToken!: string;
}

export class RequestSignupOtpDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  companyName!: string;
}

export class VerifySignupOtpDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ description: '6-digit verification code' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit OTP' })
  code!: string;
}
