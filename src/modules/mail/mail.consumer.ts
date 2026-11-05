import { Controller, Logger } from "@nestjs/common";
import { Ctx, EventPattern, Payload, RmqContext } from "@nestjs/microservices";
import { APPLICATION_STATUS_CHANGED_EVENT } from "./mail.config";
import { MailService } from "./mail.service";

@Controller()
export class MailConsumer {
  private readonly logger = new Logger(MailConsumer.name);

  constructor(private readonly mail: MailService) {}

  @EventPattern(APPLICATION_STATUS_CHANGED_EVENT)
  async handle(
    @Payload() data: { applicationId?: unknown; historyId?: unknown },
    @Ctx() ctx: RmqContext,
  ) {
    const channel = ctx.getChannelRef();
    const message = ctx.getMessage();
    const applicationId = Number(data?.applicationId);
    const historyId = Number(data?.historyId);

    if (
      !Number.isInteger(applicationId) ||
      applicationId <= 0 ||
      !Number.isInteger(historyId) ||
      historyId <= 0
    ) {
      this.logger.warn(`Bỏ qua message sai định dạng: ${JSON.stringify(data)}`);
      channel.ack(message);
      return;
    }

    try {
      await this.mail.sendStatusChanged({ applicationId, historyId });
      channel.ack(message);
    } catch (e) {
      this.logger.error(
        `Xử lý email hồ sơ ${applicationId} lỗi: ${e instanceof Error ? e.message : String(e)}`,
      );
      channel.nack(message, false, false);
    }
  }
}
