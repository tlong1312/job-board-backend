import { Inject, Injectable, Logger } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { AI_QUEUE_CLIENT, RESUME_PROCESS_EVENT } from "../ai.config";

@Injectable()
export class AiResumesProducer {
  private readonly logger = new Logger(AiResumesProducer.name);

  constructor(@Inject(AI_QUEUE_CLIENT) private readonly client: ClientProxy) {}

  enqueueProcessResume(resumeId: number): void {
    this.client.emit(RESUME_PROCESS_EVENT, { resumeId }).subscribe({
      error: (e: unknown) =>
        this.logger.error(
          `Không đẩy được CV ${resumeId} vào hàng đợi: ${e instanceof Error ? e.message : String(e)}`,
        ),
    });
  }
}
