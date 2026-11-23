import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { AiSearchService } from "./ai-search.service";
import { Public } from "commons/decorators/public.decorator";
import { SearchQueryDto } from "./ai-search.dto";
import { RateLimit, RateLimitGuard } from "../../redis/rate-limit.guard";

@ApiTags("ai")
@Controller("ai")
export class AiSearchController {
  constructor(private readonly search: AiSearchService) {}

  @Get("search")
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 30, windowSeconds: 60 })
  @ApiOperation({
    summary:
      "Tìm việc theo từ khóa hoặc theo nghĩa (like, fts, vector, hybrid)",
  })
  async find(@Query() dto: SearchQueryDto) {
    const mode = dto.mode ?? "hybrid";
    const items = await this.search.search(dto.q, mode, dto.limit ?? 10);
    return { mode, query: dto.q, count: items.length, items };
  }
}
