/**
 * Chấm các hồ sơ ứng tuyển đã có trong DB nhưng chưa có điểm.
 *   npm run ai:score-applications            (chỉ hồ sơ chưa có điểm hoặc chưa chấm được)
 *   npm run ai:score-applications -- --all   (chấm lại tất cả)
 */
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DataSource } from "typeorm";
import { AppModule } from "../../../app.module";
import { AiApplicationsService } from "../applications/ai-applications.service";

async function main() {
  const all = process.argv.includes("--all");
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["warn", "error"] });
  try {
    let svc: AiApplicationsService;
    try {
      svc = app.get(AiApplicationsService, { strict: false });
    } catch {
      console.error("Module AI chưa bật. Đặt AI_ENABLED=true trong .env rồi chạy lại.");
      process.exitCode = 1;
      return;
    }
    const ds = app.get(DataSource);
    const rows: Array<{ id: number }> = await ds.query(
      `SELECT a.id FROM applications a
         LEFT JOIN application_scores s ON s.application_id = a.id
        ${all ? "" : "WHERE s.application_id IS NULL OR s.status = 'unscored'"}
        ORDER BY a.id`,
    );
    console.log(`Có ${rows.length} hồ sơ cần chấm.`);
    let ok = 0;
    for (const { id } of rows) {
      try {
        const r = await svc.scoreApplication(Number(id));
        console.log(
          r.status === "scored"
            ? `  Hồ sơ ${id}: ${r.score?.toFixed(3)} (${r.label})`
            : `  Hồ sơ ${id}: chưa chấm được - ${r.reason}`,
        );
        ok++;
      } catch (e) {
        console.log(`  Hồ sơ ${id}: LỖI - ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    console.log(`Xong: ${ok}/${rows.length} hồ sơ.`);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
