import { Inject, Injectable, Logger } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { AI_QUEUE_CLIENT, JOB_EMBED_EVENT } from "../ai.config";

@Injectable()
export class AiJobsProducer {
  private readonly logger = new Logger(AiJobsProducer.name);

  constructor(@Inject(AI_QUEUE_CLIENT) private readonly client: ClientProxy) {}

  enqueueEmbedJob(jobId: number): void {
    this.client.emit(JOB_EMBED_EVENT, { jobId }).subscribe({
      error: (e: unknown) =>
        this.logger.error(
          `Không đẩy được tin ${jobId} vào hàng đợi: ${e instanceof Error ? e.message : String(e)}`,
        ),
    });
  }
}
