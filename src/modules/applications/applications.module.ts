import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ApplicationsService } from "./applications.service";
import { ApplicationsController } from "./applications.controller";
import { ApplicationEntity } from "./entities/application.entity";
import { ApplicationStatusHistory } from "./entities/application-status-history.entity";
import { CompaniesModule } from "../companies/companies.module";
import { JobsModule } from "../jobs/jobs.module";
import { Resume } from "../resumes/entities/resume.entity";
import { MailModule } from "../mail/mail.module";
import { RedisModule } from "../redis/redis.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApplicationEntity,
      ApplicationStatusHistory,
      Resume,
    ]),
    JobsModule,
    CompaniesModule,
    MailModule,
    RedisModule,
  ],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}
