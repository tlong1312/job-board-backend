import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from "class-validator";
import {
  JOB_LEVELS,
  JOB_STATUSES,
  JOB_TYPES,
  type JobLevel,
  type JobStatus,
  type JobType,
} from "../entities/job.entity";

export class CreateJobDto {
  @ApiProperty({ example: 1, description: "Id công ty đăng tin" })
  @IsInt({ message: "companyId phải là số nguyên" })
  @Min(1, { message: "companyId phải lớn hơn 0" })
  companyId: number;

  @ApiProperty({
    example: 2,
    description: "Id người đăng tin (nhà tuyển dụng). Tạm nhận từ body",
  })
  @IsInt({ message: "createdBy phải là số nguyên" })
  @Min(1, { message: "createdBy phải lớn hơn 0" })
  createdBy: number;

  @ApiProperty({
    example: "Backend Intern (NestJS)",
    description: "Tiêu đề tin tuyển dụng",
    maxLength: 150,
  })
  @IsString({ message: "Tiêu đề phải là chuỗi" })
  @IsNotEmpty({ message: "Tiêu đề không được để trống" })
  @MaxLength(150, { message: "Tiêu đề tối đa 150 ký tự" })
  title: string;

  @ApiPropertyOptional({
    example: "Tham gia xây dựng API cho hệ thống Job Board",
    description: "Mô tả công việc",
  })
  @IsOptional()
  @IsString({ message: "Mô tả phải là chuỗi" })
  description?: string;

  @ApiPropertyOptional({
    example: "Hà Nội",
    description: "Địa điểm làm việc",
    maxLength: 150,
  })
  @IsOptional()
  @IsString({ message: "Địa điểm phải là chuỗi" })
  @MaxLength(150, { message: "Địa điểm tối đa 150 ký tự" })
  location?: string;

  @ApiPropertyOptional({
    enum: JOB_TYPES,
    default: "full_time",
    description: "Hình thức làm việc",
  })
  @IsOptional()
  @IsIn(JOB_TYPES, {
    message: `jobType phải là một trong: ${JOB_TYPES.join(", ")}`,
  })
  jobType?: JobType;

  @ApiPropertyOptional({ enum: JOB_LEVELS, description: "Cấp bậc" })
  @IsOptional()
  @IsIn(JOB_LEVELS, {
    message: `level phải là một trong: ${JOB_LEVELS.join(", ")}`,
  })
  level?: JobLevel;

  @ApiPropertyOptional({
    example: 5000000,
    description: "Lương tối thiểu",
    minimum: 0,
  })
  @IsOptional()
  @IsInt({ message: "Lương tối thiểu phải là số nguyên" })
  @Min(0, { message: "Lương tối thiểu không được âm" })
  salaryMin?: number;

  @ApiPropertyOptional({
    example: 10000000,
    description: "Lương tối đa",
    minimum: 0,
  })
  @IsOptional()
  @IsInt({ message: "Lương tối đa phải là số nguyên" })
  @Min(0, { message: "Lương tối đa không được âm" })
  salaryMax?: number;

  @ApiPropertyOptional({
    example: "VND",
    default: "VND",
    description: "Mã tiền tệ gồm 3 ký tự",
  })
  @IsOptional()
  @IsString({ message: "Tiền tệ phải là chuỗi" })
  @Length(3, 3, { message: "Tiền tệ phải đúng 3 ký tự" })
  currency?: string;

  @ApiPropertyOptional({
    enum: JOB_STATUSES,
    default: "open",
    description: "Trạng thái tin",
  })
  @IsOptional()
  @IsIn(JOB_STATUSES, {
    message: `status phải là một trong: ${JOB_STATUSES.join(", ")}`,
  })
  status?: JobStatus;

  @ApiPropertyOptional({
    example: "2026-12-31",
    description: "Hạn nộp hồ sơ, định dạng YYYY-MM-DD",
  })
  @IsOptional()
  @IsDateString({}, { message: "Hạn nộp phải đúng định dạng YYYY-MM-DD" })
  deadline?: string;
}
