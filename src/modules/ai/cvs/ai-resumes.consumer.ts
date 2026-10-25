import { Controller, Logger } from "@nestjs/common";
import { Ctx, EventPattern, Payload, RmqContext } from "@nestjs/microservices";

import { AiResumesService } from "./ai-resumes.service";
import { RESUME_PROCESS_EVENT } from "../ai.config";

/** Bên nhận: lấy từng CV trong hàng đợi, đọc file, rút thông tin, nhúng, lưu. */
@Controller()
export class AiResumesConsumer {
  private readonly logger = new Logger(AiResumesConsumer.name);

  constructor(private readonly resumes: AiResumesService) {}

  @EventPattern(RESUME_PROCESS_EVENT)
  async handle(
    @Payload() data: { resumeId?: unknown },
    @Ctx() ctx: RmqContext,
  ) {
    const channel = ctx.getChannelRef();
    const message = ctx.getMessage();
    const resumeId = Number(data?.resumeId);

    if (!Number.isInteger(resumeId) || resumeId <= 0) {
      this.logger.warn(`Bỏ qua message sai định dạng: ${JSON.stringify(data)}`);
      channel.ack(message);
      return;
    }

    try {
      await this.resumes.processResume(resumeId);
      channel.ack(message);
    } catch (e) {
      // Không đưa lại hàng đợi: file hỏng thì thử lại cũng hỏng. Lỗi nằm ở parsed_data.error của CV;
      // chạy lại bằng POST /ai/resumes/:id/process hoặc npm run ai:process-resumes.
      this.logger.error(
        `Xử lý CV ${resumeId} lỗi: ${e instanceof Error ? e.message : String(e)}`,
      );
      channel.nack(message, false, false);
    }
  }
}
