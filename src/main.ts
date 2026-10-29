import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { ServiceErrorsFilter } from "commons/filters/service.error.filter";
import { ValidationPipe } from "@nestjs/common";
import { MicroserviceOptions } from "@nestjs/microservices";
import { mailRmqOptions } from "./modules/mail/mail.config";
import { ConfigService } from "@nestjs/config";

import { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "path";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configService = app.get(ConfigService);
  // CORS: production chỉ cho các origin khai báo trong CORS_ORIGINS (cách nhau bằng dấu phẩy).
  // Môi trường dev (không đặt biến) cho mọi origin để chạy frontend cục bộ.
  const corsOrigins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin:
      corsOrigins.length > 0
        ? corsOrigins
        : process.env.NODE_ENV === "production"
          ? false
          : true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
  });

  // Chỉ công khai thư mục logo. CV nằm ở uploads/ phải tải qua GET /resumes/:id/file (có kiểm tra quyền).
  app.useStaticAssets(join(__dirname, "..", "uploads", "logos"), {
    prefix: "/uploads/logos/",
  });

  app.setGlobalPrefix("api");
  app.useGlobalFilters(new ServiceErrorsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle("Job Board API")
    .setDescription(
      "API hệ thống tuyển dụng: xác thực, tin tuyển dụng, hồ sơ ứng tuyển, CV",
    )
    .setVersion("1.0")
    .addBearerAuth()
    .addSecurityRequirements("bearer")
    .build();
  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup("api-docs", app, document);

  app.connectMicroservice<MicroserviceOptions>(
    mailRmqOptions(
      configService.get<string>("rabbitmq.url", "amqp://localhost:5673"),
      "consumer",
    ),
  );
  await app.startAllMicroservices();

  const port = configService.get<number>("port") || 3000;
  await app.listen(port);
  console.log(`Application is running on: ${await app.getUrl()}/api-docs`);
}
bootstrap().catch((err) => {
  console.error("Lỗi khởi động server:", err);
});
