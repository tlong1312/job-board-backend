import { IsInt, IsNotEmpty, IsString, Max, IsIn, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateResumeDto {
  @ApiProperty({ description: 'ID của ứng viên' })
  @IsInt()
  @IsNotEmpty()
  userId: number;

  @ApiProperty({ description: 'Tên file CV' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({ description: 'Loại file CV' })
  @IsString()
  @IsIn([
    'application/pdf', 
    'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ], { message: 'Chỉ chấp nhận file PDF hoặc Word (DOC/DOCX)' })
  mimeType: string;

  @ApiProperty({ description: 'Kích thước file (Byte)' })
  @IsInt()
  @Max(5242880, { message: 'Kích thước file không được vượt quá 5MB' })
  fileSize: number;

  @ApiProperty({ description: 'Đặt làm CV mặc định', required: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}