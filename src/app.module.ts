import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { UsersModule } from "./modules/users/users.module";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthModule } from "./modules/auth/auth.module";
import { ResumesModule } from "./modules/resumes/resumes.module";
import { ApplicationsModule } from "./modules/applications/applications.module";
import { JobsModule } from "./modules/jobs/jobs.module";
import { dbOptions, load } from "./config";
import { TypeOrmModule } from "@nestjs/typeorm";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [load],
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: dbOptions,
      inject: [ConfigService],
    }),

    UsersModule,
    AuthModule,
    JobsModule,
    ApplicationsModule,
    ResumesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
