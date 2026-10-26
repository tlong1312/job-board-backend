import { ConfigService } from "@nestjs/config";
import { JwtModuleOptions } from "@nestjs/jwt";
import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { join } from "path";

export const load = () => {
  const env = process.env;

  const dbConfig = {
    host: env.DB_HOST || "127.0.0.1",
    port: parseInt(env.DB_PORT || "5435", 10),
    username: env.DB_USER || "postgres",
    password: String(env.DB_PASS || "123456"),
    database: env.DB_NAME || "job_board_db",
  };
  return {
    db: {
      ...dbConfig,
      type: "postgres",
      synchronize: false,
      logging: true,
      keepConnectionAlive: true,
      migrationsTableName: "migration_typeorm",
      migrationsRun: false,
      autoLoadEntities: true,
      migrations: [join(__dirname, "./migrations/*{.ts,.js}")],
    } as TypeOrmModuleOptions,

    rabbitmq: {
      url: env.RABBITMQ_URL || "amqp://localhost:5673",
    },

    redis: {
      host: env.REDIS_HOST || "localhost",
      port: parseInt(env.REDIS_PORT || "6381", 10),
    },

    // SMTP gửi email. Môi trường dev dùng Mailpit trong docker-compose (xem hộp thư ở http://localhost:8026)
    mail: {
      host: env.MAIL_HOST || "localhost",
      port: parseInt(env.MAIL_PORT || "1026", 10),
      secure: env.MAIL_SECURE === "true",
      user: env.MAIL_USER || "",
      pass: env.MAIL_PASS || "",
      from: env.MAIL_FROM || "Job Board <no-reply@jobboard.local>",
    },

    // s3: {
    //   accessKeyId: env.VNA_S3_ACCESS_ID,
    //   secretAccessKey: env.VNA_S3_ACCESS_KEY,
    //   bucketName: env.VNA_S3_BUCKET,
    //   region: env.VNA_S3_REGION || "ap-southeast-1",
    // },
  };
};

export const dbOptions = (configService: ConfigService) =>
  configService.get<TypeOrmModuleOptions>("db")!;

export const jwtOptions = (configService: ConfigService) =>
  configService.get<JwtModuleOptions>("jwt");

export const s3Options = (configService: ConfigService) =>
  configService.get("s3")!;
