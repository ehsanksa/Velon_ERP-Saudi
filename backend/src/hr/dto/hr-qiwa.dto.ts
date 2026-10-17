import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  QiwaContractStatus,
  QiwaContractType,
  QiwaEstablishmentStatus,
  QiwaIdentityType,
  QiwaNitaqatBand,
  QiwaWageBasis,
} from '@velon/database';

export class UpsertHrQiwaEstablishmentDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nameEn!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4)
  laborOfficeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  sequenceNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  commercialRegistrationNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  unifiedNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  economicActivity?: string;

  @ApiPropertyOptional({ enum: QiwaEstablishmentStatus })
  @IsOptional()
  @IsEnum(QiwaEstablishmentStatus)
  status?: QiwaEstablishmentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class RecordHrQiwaNitaqatDto {
  @ApiProperty({ enum: QiwaNitaqatBand })
  @IsEnum(QiwaNitaqatBand)
  nitaqatBand!: QiwaNitaqatBand;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  saudiCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  nonSaudiCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  saudizationPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  saudizationCertificateExpiresAt?: string;
}

export class CreateHrQiwaContractDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  employeeId!: string;

  @ApiProperty({ enum: QiwaContractType })
  @IsEnum(QiwaContractType)
  contractType!: QiwaContractType;

  @ApiProperty({ enum: QiwaIdentityType })
  @IsEnum(QiwaIdentityType)
  identityType!: QiwaIdentityType;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(10)
  nationalId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  employeeNameEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  employeeNameAr?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nationality!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  occupationTitle!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  jobTitle?: string;

  @ApiProperty()
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(180)
  probationDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(24)
  dailyHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(80)
  weeklyHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  workLocation?: string;

  @ApiPropertyOptional({ enum: QiwaWageBasis })
  @IsOptional()
  @IsEnum(QiwaWageBasis)
  wageBasis?: QiwaWageBasis;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basicWage!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  housingAllowance?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  transportAllowance?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  otherAllowances?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  noticePeriodDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  additionalTerms?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  gosiRegistered?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  listedOnQiwa?: boolean;
}

export class UpdateHrQiwaContractDto {
  @ApiPropertyOptional({ enum: QiwaContractType })
  @IsOptional()
  @IsEnum(QiwaContractType)
  contractType?: QiwaContractType;

  @ApiPropertyOptional({ enum: QiwaIdentityType })
  @IsOptional()
  @IsEnum(QiwaIdentityType)
  identityType?: QiwaIdentityType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(10)
  nationalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  employeeNameEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  employeeNameAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nationality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  occupationTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  jobTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(180)
  probationDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(24)
  dailyHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(80)
  weeklyHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  workLocation?: string;

  @ApiPropertyOptional({ enum: QiwaWageBasis })
  @IsOptional()
  @IsEnum(QiwaWageBasis)
  wageBasis?: QiwaWageBasis;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basicWage?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  housingAllowance?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  transportAllowance?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  otherAllowances?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  noticePeriodDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  additionalTerms?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  gosiRegistered?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  listedOnQiwa?: boolean;
}

export class HrQiwaContractQueryDto {
  @ApiPropertyOptional({ enum: QiwaContractStatus })
  @IsOptional()
  @IsEnum(QiwaContractStatus)
  status?: QiwaContractStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeId?: string;
}

export class HrQiwaEmployeeResponseDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED', 'AMENDMENT'] })
  @IsIn(['APPROVED', 'REJECTED', 'AMENDMENT'])
  decision!: 'APPROVED' | 'REJECTED' | 'AMENDMENT';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  qiwaContractNumber?: string;
}

export class HrQiwaExecutionNumberDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  executionNumber!: string;
}

export class HrQiwaTerminateDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  terminatedOn?: string;
}
