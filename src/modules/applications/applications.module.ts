import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ApplicationsService } from "./applications.service";
import { ApplicationsController } from "./applications.controller";
import { ApplicationEntity } from "./entities/application.entity";
import { ApplicationStatusHistory } from "./entities/application-status-history.entity";
import { JobsModule } from "../jobs/jobs.module";

@Module({
  imports: 
  [TypeOrmModule.forFeature([
      ApplicationEntity,
      ApplicationStatusHistory,
    ]),
    JobsModule,
  ],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}
