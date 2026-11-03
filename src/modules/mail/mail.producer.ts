import { Inject, Injectable, Logger } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import {
  APPLICATION_STATUS_CHANGED_EVENT,
  MAIL_QUEUE_CLIENT,
  StatusChangedPayload,
} from "./mail.config";

@Injectable()
export class MailProducer {
  private readonly logger = new Logger(MailProducer.name);

  constructor(
    @Inject(MAIL_QUEUE_CLIENT) private readonly client: ClientProxy,
  ) {}

  enqueueStatusChanged(payload: StatusChangedPayload): void {
    this.client.emit(APPLICATION_STATUS_CHANGED_EVENT, payload).subscribe({
      error: (e: unknown) =>
        this.logger.error(
          `Không đẩy được email hồ sơ ${payload.applicationId} vào hàng đợi: ${
            e instanceof Error ? e.message : String(e)
          }`,
        ),
    });
  }
}
