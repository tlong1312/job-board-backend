import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { RateLimit, RateLimitGuard } from "../../redis/rate-limit.guard";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Public } from "commons/decorators/public.decorator";
import { JobSearchService } from "./job-search.service";
import { BadRequestException } from "commons/error";

@ApiTags("jobs")
@Controller("search/jobs")
export class JobSearchController {
  constructor(private readonly search: JobSearchService) {}
  @Public()
  @Get()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 30, windowSeconds: 60 })
  @ApiOperation({ summary: "Tìm tin tuyển dụng đang mở bằng full-text search" })
  @ApiQuery({
    name: "q",
    required: true,
    type: String,
    description: "Từ khóa, ví dụ: nestjs backend",
  })
  @ApiQuery({ name: "limit", required: false, type: Number })
  async find(@Query("q") q?: string, @Query("limit") limit?: string) {
    if (!q || !q.trim())
      throw new BadRequestException("Thiếu từ khóa tìm kiếm (q)");
    const n = Math.min(Math.max(Number(limit) || 10, 1), 50);
    const items = await this.search.search(q, n);
    return { query: q, count: items.length, items };
  }
}
