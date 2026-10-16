import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
  Req,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Public } from "commons/decorators/public.decorator";
import { Roles } from "commons/decorators/roles.decorator";
import {
  CurrentUser,
  type JwtUser,
} from "commons/decorators/current-user.decorator";
import type { Request } from "express";
import { AuthService } from "../auth/auth.service";
import { JobsService } from "./jobs.service";
import { CreateJobDto } from "./dto/create-job.dto";
import { UpdateJobDto } from "./dto/update-job.dto";
import { QueryJobDto } from "./dto/query-job.dto";
 
@ApiBearerAuth()
@ApiTags("jobs")
@Controller("jobs")
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly authService: AuthService,
  ) {}
 
  /**
   * API @Public() không đi qua bước gắn user của JwtAuthGuard, nên tự đọc token ở đây.
   * Không có token / token sai / hết hạn: coi là khách (undefined), không ném lỗi.
   */
  private async getViewer(
    authorization?: string,
  ): Promise<JwtUser | undefined> {
    const [type, token] = authorization?.split(" ") ?? [];
    if (type !== "Bearer" || !token) return undefined;
    try {
      const payload = await this.authService.verifyAccessToken(token);
      return { id: payload.sub, role: payload.role };
    } catch {
      return undefined;
    }
  }
 
  @Post()
  @Roles("employer")
  @ApiOperation({
    summary: "Nhà tuyển dụng đăng tin tuyển dụng mới (status = open)",
  })
  @ApiCreatedResponse({ description: "Tin tuyển dụng vừa tạo" })
  @ApiBadRequestResponse({
    description:
      "Thiếu tiêu đề / jobType, level ngoài danh sách / lương âm / hạn nộp sai định dạng / lương tối đa < lương tối thiểu / hạn nộp trước hôm nay",
  })
  @ApiUnauthorizedResponse({ description: "Chưa đăng nhập" })
  @ApiForbiddenResponse({
    description: "Không phải nhà tuyển dụng / công ty không thuộc người đăng",
  })
  @ApiNotFoundResponse({ description: "Công ty không tồn tại" })
  create(@Body() createJobDto: CreateJobDto, @CurrentUser() user: JwtUser) {
    return this.jobsService.create(createJobDto, user);
  }
 
  @Get()
  @Public()
  @ApiOperation({
    summary: "Lấy danh sách tin tuyển dụng (mới nhất trước)",
    description:
      "Khách và ứng viên chỉ thấy tin open. Nhà tuyển dụng/admin xem được mọi trạng thái và lọc theo status.",
  })
  @ApiOkResponse({ description: "Mảng tin tuyển dụng" })
  @ApiBadRequestResponse({ description: "status không hợp lệ" })
  async findAll(@Query() query: QueryJobDto, @Req() req: Request) {
    const viewer = await this.getViewer(req.headers.authorization);
    return this.jobsService.findAll(query, viewer);
  }
 
  @Get(":id")
  @Public()
  @ApiOperation({ summary: "Xem một tin tuyển dụng theo id" })
  @ApiParam({ name: "id", type: Number, description: "Id tin tuyển dụng" })
  @ApiOkResponse({ description: "Thông tin tin tuyển dụng" })
  @ApiBadRequestResponse({ description: "id không phải số" })
  @ApiNotFoundResponse({
    description:
      "Không tìm thấy việc làm (khách/ứng viên cũng nhận 404 với tin không phải open)",
  })
  async findOne(@Param("id", ParseIntPipe) id: number, @Req() req: Request) {
    const viewer = await this.getViewer(req.headers.authorization);
    return this.jobsService.findOneForViewer(id, viewer);
  }
 
  @Patch(":id")
  @Roles("employer", "admin")
  @ApiOperation({
    summary: "Chủ tin hoặc admin sửa tin / đóng tin (status = closed)",
  })
  @ApiParam({ name: "id", type: Number, description: "Id tin tuyển dụng" })
  @ApiOkResponse({ description: "Tin tuyển dụng sau khi cập nhật" })
  @ApiBadRequestResponse({
    description:
      "id không phải số / status ngoài open, closed / lương tối đa < lương tối thiểu / hạn nộp sai",
  })
  @ApiUnauthorizedResponse({ description: "Chưa đăng nhập" })
  @ApiForbiddenResponse({
    description: "Không phải chủ tin hoặc admin / tin đã bị khoá",
  })
  @ApiNotFoundResponse({ description: "Không tìm thấy việc làm" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateJobDto: UpdateJobDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.jobsService.update(id, updateJobDto, user);
  }
 
  @Patch(":id/block")
  @Roles("admin")
  @ApiOperation({ summary: "Admin khoá tin (status = blocked)" })
  @ApiParam({ name: "id", type: Number, description: "Id tin tuyển dụng" })
  @ApiOkResponse({ description: "Tin tuyển dụng sau khi bị khoá" })
  @ApiBadRequestResponse({ description: "id không phải số / tin đã bị khoá" })
  @ApiForbiddenResponse({ description: "Không phải admin" })
  @ApiNotFoundResponse({ description: "Không tìm thấy việc làm" })
  block(@Param("id", ParseIntPipe) id: number) {
    return this.jobsService.block(id);
  }
 
  @Delete(":id")
  @Roles("employer", "admin")
  @ApiOperation({ summary: "Chủ tin hoặc admin xoá tin" })
  @ApiParam({ name: "id", type: Number, description: "Id tin tuyển dụng" })
  @ApiOkResponse({ description: "Thông báo đã xoá" })
  @ApiBadRequestResponse({
    description: "id không phải số / tin đã có hồ sơ, hãy đóng tin thay vì xoá",
  })
  @ApiUnauthorizedResponse({ description: "Chưa đăng nhập" })
  @ApiForbiddenResponse({ description: "Không phải chủ tin hoặc admin" })
  @ApiNotFoundResponse({ description: "Không tìm thấy việc làm" })
  remove(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.jobsService.remove(id, user);
  }
}
 