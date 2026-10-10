import { OmitType, PartialType } from "@nestjs/swagger";
import { CreateJobDto } from "./create-job.dto";

// Không cho đổi công ty và người đăng sau khi tạo tin
export class UpdateJobDto extends PartialType(
  OmitType(CreateJobDto, ["companyId", "createdBy"] as const),
) {}
