import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional } from "class-validator";
import { JOB_STATUSES, type JobStatus } from "../entities/job.entity";

export class QueryJobDto {
  @ApiPropertyOptional({
    enum: JOB_STATUSES,
    description: "Lọc theo trạng thái tin. Bỏ trống để lấy tất cả",
  })
  @IsOptional()
  @IsIn(JOB_STATUSES, {
    message: `status phải là một trong: ${JOB_STATUSES.join(", ")}`,
  })
  status?: JobStatus;
}
