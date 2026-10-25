import { Controller, Get, Param, ParseIntPipe, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "commons/decorators/current-user.decorator";
import { AiResumesService, Requester } from "./ai-resumes.service";

/**
 * Bộ trang trí @CurrentUser của dự án trả về object người dùng; tên trường id có thể là id hoặc userId
 * (controller CV hiện có dùng cả hai), nên lấy cái nào có.
 */
function whoIs(user: { id?: number; userId?: number; role?: string } | undefined): Requester {
  return { id: Number(user?.id ?? user?.userId), role: String(user?.role ?? "") };
}

@ApiTags("ai")
@Controller("ai/resumes")
export class AiResumesController {
  constructor(private readonly resumes: AiResumesService) {}

  @Post(":id/process")
  @ApiOperation({ summary: "Đọc lại file CV, rút thông tin và nhúng vector (chủ CV hoặc admin)" })
  async process(
    @Param("id", ParseIntPipe) id: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @CurrentUser() user: any,
  ) {
    await this.resumes.assertAccess(id, whoIs(user));
    return this.resumes.processResume(id);
  }

  @Get(":id/parsed")
  @ApiOperation({ summary: "Xem thông tin máy rút ra từ CV: kỹ năng, số năm, cấp độ, tỉnh" })
  async parsed(
    @Param("id", ParseIntPipe) id: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @CurrentUser() user: any,
  ) {
    await this.resumes.assertAccess(id, whoIs(user));
    return this.resumes.getParsed(id);
  }

  @Get(":id/matches")
  @ApiOperation({ summary: "Gợi ý các tin đang mở hợp với CV, kèm điểm và lý do" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  async matches(
    @Param("id", ParseIntPipe) id: number,
    @Query("limit") limit: string | undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @CurrentUser() user: any,
  ) {
    await this.resumes.assertAccess(id, whoIs(user));
    const n = Math.min(Math.max(Number(limit) || 10, 1), 50);
    return this.resumes.matchJobs(id, n);
  }
}
