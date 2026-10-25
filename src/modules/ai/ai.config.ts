import { ConfigService } from "@nestjs/config";
import { RmqOptions, Transport } from "@nestjs/microservices";

export const AI_QUEUE = "ai.embedding";

export const AI_QUEUE_CLIENT = "AI_QUEUE_CLIENT";

export const JOB_EMBED_EVENT = "job.embed";

export const APPLICATION_SCORE_EVENT = "application.score";

export const RESUME_PROCESS_EVENT = "resume.process";

export function isAiEnabled(): boolean {
  return (process.env.AI_ENABLED ?? "false").toLowerCase() === "true";
}

export function rabbitUrl(config: ConfigService): string {
  return config.get<string>(
    "RABBITMQ_URL",
    "amqp://guest:guest@localhost:5673",
  );
}

export function aiRmqOptions(url: string): RmqOptions {
  return {
    transport: Transport.RMQ,
    options: {
      urls: [url],
      queue: AI_QUEUE,
      queueOptions: { durable: true },
      noAck: false,
      prefetchCount: 1,
    },
  };
}
