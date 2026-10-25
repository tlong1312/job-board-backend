import { Controller, Get, Param, ParseIntPipe, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser, JwtUser } from "commons/decorators/current-user.decorator";
import { Roles } from "commons/decorators/roles.decorator";
import { AiApplicationsService } from "./ai-applications.service";

@ApiBearerAuth()
@ApiTags("ai")
@Controller("ai")
export class AiApplicationsController {
  constructor(private readonly applications: AiApplicationsService) {}

  @Get("jobs/:jobId/applicants")
  @Roles("employer", "admin")
  @ApiOperation({
    summary: "Danh sách hồ sơ của tin, xếp theo điểm phù hợp (chỉ gợi ý, người tuyển dụng quyết định)",
  })
  async applicants(@Param("jobId", ParseIntPipe) jobId: number, @CurrentUser() user: JwtUser) {
    await this.applications.assertJobOwner(jobId, { id: user.id, role: user.role });
    return this.applications.listApplicants(jobId);
  }

  @Post("applications/:id/score")
  @Roles("employer", "admin")
  @ApiOperation({ summary: "Chấm lại điểm một hồ sơ (ví dụ sau khi CV được xử lý lại)" })
  async rescore(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    const jobId = await this.applications.jobIdOfApplication(id);
    await this.applications.assertJobOwner(jobId, { id: user.id, role: user.role });
    return this.applications.scoreApplication(id);
  }
}
