import { ApiPropertyOptional, OmitType, PartialType } from "@nestjs/swagger";
import { IsIn, IsOptional } from "class-validator";
import { CreateJobDto } from "./create-job.dto";

// Chỉ cho đóng/mở lại qua update; "blocked" chỉ admin đặt qua PATCH /jobs/:id/block
export const UPDATABLE_JOB_STATUSES = ["open", "closed"] as const;
export type UpdatableJobStatus = (typeof UPDATABLE_JOB_STATUSES)[number];

// Không cho đổi công ty sau khi tạo tin
export class UpdateJobDto extends PartialType(
  OmitType(CreateJobDto, ["companyId"] as const),
) {
  @ApiPropertyOptional({
    enum: UPDATABLE_JOB_STATUSES,
    description: 'Đặt "closed" để đóng tin',
  })
  @IsOptional()
  @IsIn(UPDATABLE_JOB_STATUSES, {
    message: `status phải là một trong: ${UPDATABLE_JOB_STATUSES.join(", ")}`,
  })
  status?: UpdatableJobStatus;
}
