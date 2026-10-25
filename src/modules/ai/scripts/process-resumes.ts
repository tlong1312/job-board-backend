/**
 * Đọc và nhúng các CV đã có trong DB nhưng chưa xử lý (parsed_at còn trống).
 *   npm run ai:process-resumes            (chỉ CV chưa xử lý)
 *   npm run ai:process-resumes -- --all   (làm lại tất cả)
 */
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DataSource } from "typeorm";
import { AppModule } from "../../../app.module";
import { AiResumesService } from "../cvs/ai-resumes.service";

async function main() {
  const all = process.argv.includes("--all");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["warn", "error"],
  });
  try {
    let svc: AiResumesService;
    try {
      svc = app.get(AiResumesService, { strict: false });
    } catch {
      console.error(
        "Module AI chưa bật. Đặt AI_ENABLED=true trong .env rồi chạy lại.",
      );
      process.exitCode = 1;
      return;
    }
    const ds = app.get(DataSource);
    const rows: Array<{ id: number }> = await ds.query(
      `SELECT id FROM resumes ${all ? "" : "WHERE parsed_at IS NULL"} ORDER BY id`,
    );
    console.log(`Có ${rows.length} CV cần xử lý.`);
    let ok = 0;
    for (const { id } of rows) {
      try {
        const r = await svc.processResume(Number(id));
        console.log(
          `  CV ${id}: ${r.info.skills.length} kỹ năng, ${r.info.years ?? "?"} năm, cấp ${r.info.level ?? "?"}`,
        );
        ok++;
      } catch (e) {
        console.log(
          `  CV ${id}: LỖI - ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    console.log(`Xong: ${ok}/${rows.length} CV.`);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
