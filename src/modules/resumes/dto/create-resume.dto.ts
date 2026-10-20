import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateResumeDto {
  userId: number;

  @ApiProperty({ description: 'Đặt làm CV mặc định', required: false, default: false })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}