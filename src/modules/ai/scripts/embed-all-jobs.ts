import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../../../app.module";
import { AiJobsService } from "../jobs/ai-jobs.service";

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"],
  });
  try {
    let jobs: AiJobsService;
    try {
      jobs = app.get(AiJobsService, { strict: false });
    } catch {
      console.error(
        "AiJobsService chưa có. Hãy đặt AI_ENABLED=true trong .env rồi chạy lại.",
      );
      process.exitCode = 1;
      return;
    }
    const r = await jobs.embedAllJobs();
    console.log(
      `Xong: ${r.total} tin, nhúng ${r.embedded}, bỏ qua ${r.skipped}, ${r.seconds} giây.`,
    );
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
