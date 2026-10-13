import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/** One catalog row from a CSV/Excel template (flat product or service). */
export class InventoryImportRowDto {
  @ApiPropertyOptional({
    description: 'Unique SKU / Service ID. Auto-generated if empty on create.',
  })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiProperty({ description: 'Display name (required).' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({
    description: 'PRODUCT (stockable) or SERVICE (non-inventory). Defaults to PRODUCT.',
  })
  @IsOptional()
  @IsString()
  itemType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Existing category name (exact match) or new name if allowed.',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'EACH | KG | LITER | BOX | CARTON' })
  @IsOptional()
  @IsString()
  uom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unitPrice?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  costPrice?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional({ description: 'ACTIVE | INACTIVE | DISCONTINUED' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Warehouse name for opening stock (products only).' })
  @IsOptional()
  @IsString()
  warehouse?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  quantity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reorderPoint?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  safetyStock?: string;

  @ApiPropertyOptional({ description: 'true/false/yes/no — products only' })
  @IsOptional()
  @IsString()
  batchTracked?: string;
}

export class InventoryImportOptionsDto {
  @ApiPropertyOptional({
    description: 'Create categories that do not exist yet (default false).',
  })
  @IsOptional()
  @IsBoolean()
  createMissingCategories?: boolean;

  @ApiPropertyOptional({
    description:
      'Update existing catalog rows matched by SKU (default false → error on duplicate).',
  })
  @IsOptional()
  @IsBoolean()
  updateExisting?: boolean;

  @ApiPropertyOptional({
    description:
      'Create as INACTIVE so a manager can approve before sell/stock use (data governance gate).',
  })
  @IsOptional()
  @IsBoolean()
  stageForApproval?: boolean;

  @ApiPropertyOptional({
    description: 'Create warehouses named in the file when missing (default false).',
  })
  @IsOptional()
  @IsBoolean()
  createMissingWarehouses?: boolean;
}

export class InventoryImportRequestDto {
  @ApiProperty({ type: [InventoryImportRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => InventoryImportRowDto)
  rows!: InventoryImportRowDto[];

  @ApiPropertyOptional({ type: InventoryImportOptionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => InventoryImportOptionsDto)
  options?: InventoryImportOptionsDto;
}
