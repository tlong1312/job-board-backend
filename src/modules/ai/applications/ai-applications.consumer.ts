import { Controller, Logger } from "@nestjs/common";
import { Ctx, EventPattern, Payload, RmqContext } from "@nestjs/microservices";
import { APPLICATION_SCORE_EVENT } from "../ai.config";
import { AiApplicationsService } from "./ai-applications.service";

/** Bên nhận: lấy từng hồ sơ trong hàng đợi, chấm điểm, lưu vào application_scores. */
@Controller()
export class AiApplicationsConsumer {
  private readonly logger = new Logger(AiApplicationsConsumer.name);

  constructor(private readonly applications: AiApplicationsService) {}

  @EventPattern(APPLICATION_SCORE_EVENT)
  async handle(@Payload() data: { applicationId?: unknown }, @Ctx() ctx: RmqContext) {
    const channel = ctx.getChannelRef();
    const message = ctx.getMessage();
    const applicationId = Number(data?.applicationId);

    if (!Number.isInteger(applicationId) || applicationId <= 0) {
      this.logger.warn(`Bỏ qua message sai định dạng: ${JSON.stringify(data)}`);
      channel.ack(message);
      return;
    }

    try {
      await this.applications.scoreApplication(applicationId);
      channel.ack(message);
    } catch (e) {
      // Không đưa lại hàng đợi. Hồ sơ nào lỡ sẽ được bù khi chạy npm run ai:score-applications.
      this.logger.error(`Chấm hồ sơ ${applicationId} lỗi: ${e instanceof Error ? e.message : String(e)}`);
      channel.nack(message, false, false);
    }
  }
}
