import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class RequestPayloadDto {
  @IsIn(['purchase', 'travel', 'access', 'other'])
  category!: 'purchase' | 'travel' | 'access' | 'other';

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amountEur?: number;

  @IsOptional()
  @IsDateString()
  neededBy?: string;
}

export class CreateRequestDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @ValidateNested()
  @Type(() => RequestPayloadDto)
  payload!: RequestPayloadDto;
}
