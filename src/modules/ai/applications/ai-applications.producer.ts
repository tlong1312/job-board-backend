import { Inject, Injectable, Logger } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { AI_QUEUE_CLIENT, APPLICATION_SCORE_EVENT } from "../ai.config";

/** Bên gửi: báo vào hàng đợi "hồ sơ này mới nộp, hãy chấm điểm". Không chờ kết quả. */
@Injectable()
export class AiApplicationsProducer {
  private readonly logger = new Logger(AiApplicationsProducer.name);

  constructor(@Inject(AI_QUEUE_CLIENT) private readonly client: ClientProxy) {}

  /** Lỗi RabbitMQ chỉ ghi log, không làm hỏng việc nộp hồ sơ. */
  enqueueScoreApplication(applicationId: number): void {
    this.client.emit(APPLICATION_SCORE_EVENT, { applicationId }).subscribe({
      error: (e: unknown) =>
        this.logger.error(
          `Không đẩy được hồ sơ ${applicationId} vào hàng đợi: ${e instanceof Error ? e.message : String(e)}`,
        ),
    });
  }
}
