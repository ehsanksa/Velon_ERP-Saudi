import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  InventoryAbcClass,
  InventoryItemType,
  InventoryProductStatus,
  InventoryUom,
  InventoryVelocity,
} from '@velon/database';

export class CreateInventoryCategoryDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentId?: string;
}

export class UpdateInventoryCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentId?: string;
}

export class ProductVariantOptionValueDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  attributeName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  value!: string;
}

export class ProductVariantAttributeInputDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  values!: string[];
}

export class ProductVariantInputDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  sku!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  salePrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  minStock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderLevel?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageDataUrl?: string;

  @ApiPropertyOptional({ enum: InventoryProductStatus })
  @IsOptional()
  @IsEnum(InventoryProductStatus)
  status?: InventoryProductStatus;

  @ApiPropertyOptional({ type: [ProductVariantOptionValueDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantOptionValueDto)
  optionValues?: ProductVariantOptionValueDto[];
}

export class ProductVariantsPayloadDto {
  @ApiProperty()
  @IsBoolean()
  hasVariants!: boolean;

  @ApiPropertyOptional({ type: [ProductVariantAttributeInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantAttributeInputDto)
  attributes?: ProductVariantAttributeInputDto[];

  @ApiPropertyOptional({ type: [ProductVariantInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantInputDto)
  variants?: ProductVariantInputDto[];
}

export class CreateInventoryProductDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ enum: InventoryItemType })
  @IsOptional()
  @IsEnum(InventoryItemType)
  itemType?: InventoryItemType;

  @ApiPropertyOptional({ enum: InventoryUom })
  @IsOptional()
  @IsEnum(InventoryUom)
  uom?: InventoryUom;

  @ApiPropertyOptional({ enum: InventoryProductStatus })
  @IsOptional()
  @IsEnum(InventoryProductStatus)
  status?: InventoryProductStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageDataUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  unitPrice?: number;

  @ApiPropertyOptional({ enum: InventoryAbcClass })
  @IsOptional()
  @IsEnum(InventoryAbcClass)
  abcClass?: InventoryAbcClass;

  @ApiPropertyOptional({ enum: InventoryVelocity })
  @IsOptional()
  @IsEnum(InventoryVelocity)
  velocity?: InventoryVelocity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  batchTracked?: boolean;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD — required when batchTracked and quantity > 0' })
  @IsOptional()
  @IsString()
  mfgDate?: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD — required when batchTracked and quantity > 0' })
  @IsOptional()
  @IsString()
  expiryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  variantParent?: string;

  /** Workspace UI: warehouse/site name for initial stock */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  site?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  safetyStock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderPoint?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasVariants?: boolean;

  @ApiPropertyOptional({ type: ProductVariantsPayloadDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductVariantsPayloadDto)
  variants?: ProductVariantsPayloadDto;
}

export class UpdateInventoryProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ enum: InventoryItemType })
  @IsOptional()
  @IsEnum(InventoryItemType)
  itemType?: InventoryItemType;

  @ApiPropertyOptional({ enum: InventoryUom })
  @IsOptional()
  @IsEnum(InventoryUom)
  uom?: InventoryUom;

  @ApiPropertyOptional({ enum: InventoryProductStatus })
  @IsOptional()
  @IsEnum(InventoryProductStatus)
  status?: InventoryProductStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageDataUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  unitPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional({ enum: InventoryAbcClass })
  @IsOptional()
  @IsEnum(InventoryAbcClass)
  abcClass?: InventoryAbcClass;

  @ApiPropertyOptional({ enum: InventoryVelocity })
  @IsOptional()
  @IsEnum(InventoryVelocity)
  velocity?: InventoryVelocity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  batchTracked?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  variantParent?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasVariants?: boolean;

  @ApiPropertyOptional({ type: ProductVariantsPayloadDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductVariantsPayloadDto)
  variants?: ProductVariantsPayloadDto;
}

export class CreateInventoryWarehouseDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managerName?: string;
}

export class UpdateInventoryWarehouseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  managerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AdjustInventoryStockDto {
  @ApiProperty()
  @IsString()
  productId!: string;

  @ApiProperty()
  @IsString()
  warehouseId!: string;

  @ApiPropertyOptional({
    description: 'Required when the product has variants. Stock is kept per variant.',
  })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty()
  @IsInt()
  delta!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'YYYY-MM-DD — required for positive delta on batch-tracked products',
  })
  @IsOptional()
  @IsString()
  mfgDate?: string;

  @ApiPropertyOptional({
    description: 'YYYY-MM-DD — required for positive delta on batch-tracked products',
  })
  @IsOptional()
  @IsString()
  expiryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;
}

export class ReceiveInventoryStockDto {
  @ApiProperty()
  @IsString()
  productId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({ description: 'Warehouse name. Used when warehouseId is omitted.' })
  @IsOptional()
  @IsString()
  site?: string;

  @ApiProperty({ description: 'Quantity to add. Existing on-hand is increased, not replaced.' })
  @IsInt()
  @Min(0)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  minStock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderLevel?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mfgDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expiryDate?: string;
}

export class TransferInventoryStockDto {
  @ApiProperty()
  @IsString()
  productId!: string;

  @ApiProperty()
  @IsString()
  fromWarehouseId!: string;

  @ApiProperty()
  @IsString()
  toWarehouseId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class UpdateStockLevelsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  minStock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderLevel?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  safetyStock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderPoint?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  site?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  unitPrice?: number;

  @ApiPropertyOptional({ enum: InventoryAbcClass })
  @IsOptional()
  @IsEnum(InventoryAbcClass)
  abcClass?: InventoryAbcClass;

  @ApiPropertyOptional({ enum: InventoryVelocity })
  @IsOptional()
  @IsEnum(InventoryVelocity)
  velocity?: InventoryVelocity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  batchTracked?: boolean;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD — required when batchTracked and quantity > 0' })
  @IsOptional()
  @IsString()
  mfgDate?: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD — required when batchTracked and quantity > 0' })
  @IsOptional()
  @IsString()
  expiryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  variantParent?: string;
}
