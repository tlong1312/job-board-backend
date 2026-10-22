import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JobsService } from "./jobs.service";
import { JobsController } from "./jobs.controller";
import { Job } from "./entities/job.entity";
import { AuthModule } from "../auth/auth.module";
import { CompaniesModule } from "../companies/companies.module";
import { ApplicationEntity } from "../applications/entities/application.entity";
 
@Module({
  // Đăng ký thẳng ApplicationEntity (không import ApplicationsModule) để tránh
  // vòng phụ thuộc: ApplicationsModule đã import JobsModule.
  imports: [
    TypeOrmModule.forFeature([Job, ApplicationEntity]),
    CompaniesModule,
    AuthModule,
  ],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
 