import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import {
  JOB_LEVELS,
  JOB_STATUSES,
  type JobLevel,
  type JobStatus,
} from "../entities/job.entity";

export class QueryJobDto {
  @ApiPropertyOptional({
    enum: JOB_STATUSES,
    description: "Lọc theo trạng thái tin",
    example: "open",
  })
  @IsOptional()
  @IsIn(JOB_STATUSES, {
    message: `status phải là một trong: ${JOB_STATUSES.join(", ")}`,
  })
  status?: JobStatus;

  @ApiPropertyOptional({
    description: "Số trang, bắt đầu từ 1",
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: "Số lượng tin mỗi trang",
    example: 10,
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: "Lọc theo tỉnh/thành phố",
    example: "Hồ Chí Minh",
  })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional({
    enum: JOB_LEVELS,
    description: "Lọc theo cấp bậc",
    example: "junior",
  })
  @IsOptional()
  @IsIn(JOB_LEVELS)
  level?: JobLevel;

  @ApiPropertyOptional({
    description: "Tìm theo tên công ty, có thể nhập một phần tên",
    example: "ABC",
  })
  @IsOptional()
  @IsString()
  companyName?: string;
}
