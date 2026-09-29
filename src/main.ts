import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { ServiceErrorsFilter } from "commons/filters/service.error.filter";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  app.enableCors({
    origin: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
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
    .setTitle("NestJS API")
    .setDescription("The NestJS API description")
    .setVersion("1.0")
    .addBearerAuth()
    .addTag("nestjs")
    .build();
  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup("api-docs", app, document);

  const port = configService.get<number>("port") || 3010;
  await app.listen(port);
  console.log(`Application is running on: ${await app.getUrl()}/api-docs`);
}
bootstrap().catch((err) => {
  console.error("Lỗi khởi động server:", err);
});
