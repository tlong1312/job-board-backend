import {
  ApiProperty,
  ApiPropertyOptional,
} from "@nestjs/swagger";

import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class CreateApplicationDto {
  @ApiProperty({
    example: 1,
    description: "Id tin tuyển dụng muốn ứng tuyển",
  })
  @IsInt()
  @Min(1)
  jobId: number;

  @ApiPropertyOptional({
    example: 1,
    description: "Id CV dùng để ứng tuyển",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  resumeId?: number;

  @ApiPropertyOptional({
    example:
      "Tôi mong muốn được ứng tuyển vào vị trí này và có kinh nghiệm phù hợp với yêu cầu công việc.",
    description: "Thư giới thiệu của ứng viên",
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  coverLetter?: string;
}