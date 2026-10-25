import { RmqOptions, Transport } from "@nestjs/microservices";

export const MAIL_QUEUE = "mail.email";

export const MAIL_QUEUE_CLIENT = "MAIL_QUEUE_CLIENT";

export const APPLICATION_STATUS_CHANGED_EVENT = "application.status_changed";

export interface StatusChangedPayload {
  applicationId: number;
  historyId: number;
}

export function mailRmqOptions(
  url: string,
  role: "producer" | "consumer",
): RmqOptions {
  return {
    transport: Transport.RMQ,
    options: {
      urls: [url],
      queue: MAIL_QUEUE,
      queueOptions: { durable: true },
      noAck: role === "producer",
      prefetchCount: 1,
    },
  };
}
