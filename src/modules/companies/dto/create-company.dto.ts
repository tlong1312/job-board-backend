import { IsNotEmpty, IsNumber, IsString, MaxLength, IsUrl, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCompanyDto {
  @ApiProperty({ example: 1, description: 'ID của chủ sở hữu công ty (phải là employer)' })
  @IsNotEmpty({ message: 'ownerId không được để trống' })
  @IsNumber({}, { message: 'ownerId phải là dạng số' })
  ownerId: number;

  @ApiProperty({ example: 'Công ty Cổ phần Công nghệ ABC', description: 'Tên công ty (tối đa 200 ký tự)' })
  @IsNotEmpty({ message: 'Tên công ty không được để trống' })
  @IsString({ message: 'Tên công ty phải là chuỗi ký tự' })
  @MaxLength(200, { message: 'Tên công ty tối đa không quá 200 ký tự' })
  name: string;

  @ApiPropertyOptional({ example: 'Chuyên cung cấp giải pháp phần mềm doanh nghiệp', description: 'Mô tả công ty' })
  @IsOptional()
  @IsString({ message: 'Mô tả phải là chuỗi ký tự' })
  description?: string;

  @ApiPropertyOptional({ example: 'https://abc-tech.com', description: 'Website chính thức của công ty (định dạng URL hợp lệ)' })
  @IsOptional()
  @IsUrl({}, { message: 'Website phải là một đường dẫn URL hợp lệ' })
  website?: string;

  @ApiPropertyOptional({ example: 'Tầng 5, Tòa nhà Innovation, Quận 1, TP.HCM', description: 'Địa chỉ công ty (tối đa 255 ký tự)' })
  @IsOptional()
  @IsString({ message: 'Địa chỉ phải là chuỗi ký tự' })
  @MaxLength(255, { message: 'Địa chỉ tối đa không quá 255 ký tự' })
  address?: string;

  @ApiProperty({ description: 'Tỉnh / Thành phố', required: false })
  @IsString({ message: 'Tỉnh/Thành phố phải là chuỗi' })
  @IsOptional()
  province?: string;

  @ApiProperty({ description: 'Phường / Xã', required: false })
  @IsString({ message: 'Phường/Xã phải là chuỗi' })
  @IsOptional()
  ward?: string;
  
  @ApiPropertyOptional({ example: '/uploads/logos/abc-logo.png', description: 'Đường dẫn lưu logo công ty' })
  @IsOptional()
  @IsString({ message: 'Logo path phải là chuỗi ký tự' })
  logoPath?: string;
}