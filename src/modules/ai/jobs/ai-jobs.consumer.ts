import { Controller, Logger } from "@nestjs/common";
import { Ctx, EventPattern, Payload, RmqContext } from "@nestjs/microservices";
import { JOB_EMBED_EVENT } from "../ai.config";
import { AiJobsService } from "./ai-jobs.service";

@Controller()
export class AiJobsConsumer {
  private readonly logger = new Logger(AiJobsConsumer.name);

  constructor(private readonly jobs: AiJobsService) {}

  @EventPattern(JOB_EMBED_EVENT)
  async handle(@Payload() data: { jobId?: unknown }, @Ctx() ctx: RmqContext) {
    const channel = ctx.getChannelRef();
    const message = ctx.getMessage();
    const jobId = Number(data?.jobId);

    if (!Number.isInteger(jobId) || jobId <= 0) {
      this.logger.warn(`Bỏ qua message sai định dạng: ${JSON.stringify(data)}`);
      channel.ack(message);
      return;
    }

    try {
      const r = await this.jobs.embedJobs([jobId]);
      this.logger.log(
        `Tin ${jobId}: nhúng ${r.embedded}, bỏ qua ${r.skipped}, không còn ${r.missing}`,
      );
      channel.ack(message);
    } catch (e) {
      this.logger.error(
        `Nhúng tin ${jobId} lỗi: ${e instanceof Error ? e.message : String(e)}`,
      );
      channel.nack(message, false, false);
    }
  }
}
