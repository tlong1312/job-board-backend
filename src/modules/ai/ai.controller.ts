import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AiService } from "./ai.service";
import { Public } from "commons/decorators/public.decorator";

@ApiTags("ai")
@Controller("ai")
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get("health")
  @Public()
  @ApiOperation({ summary: "Kiểm tra Ollama và mô hình embedding đang chạy" })
  health() {
    return this.ai.health();
  }
}
