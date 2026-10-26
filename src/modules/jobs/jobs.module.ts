import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JobsService } from "./jobs.service";
import { JobsController } from "./jobs.controller";
import { Job } from "./entities/job.entity";
import { AuthModule } from "../auth/auth.module";
import { CompaniesModule } from "../companies/companies.module";
import { ApplicationEntity } from "../applications/entities/application.entity";
import { JobSearchController } from "./search/job-search.controller";
import { JobSearchService } from "./search/job-search.service";
import { SkillsModule } from "../skills/skills.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Job, ApplicationEntity]),
    CompaniesModule,
    AuthModule,
    SkillsModule,
  ],
  controllers: [JobsController, JobSearchController],
  providers: [JobsService, JobSearchService],
  exports: [JobsService],
})
export class JobsModule {}
