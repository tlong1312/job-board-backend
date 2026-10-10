import { Injectable } from "@nestjs/common";
import { CreateApplicationDto } from "./dto/create-application.dto";
import { UpdateApplicationDto } from "./dto/update-application.dto";
import { Application } from "./entities/application.entity";
import { JobsService } from "../jobs/jobs.service";

@Injectable()
export class ApplicationsService {
  private readonly applications: Application[] = [];
  private nextId = 1;

  constructor(private readonly jobsService: JobsService) {}

  async create(createApplicationDto: CreateApplicationDto) {
    const job = await this.jobsService.findOne(createApplicationDto.jobId);
    const application: Application = {
      id: this.nextId++,
      jobId: job.id,
      candidateName: createApplicationDto.candidateName,
      status: "new",
    };
    this.applications.push(application);
    return application;
  }

  findAll() {
    return `This action returns all applications`;
  }

  findOne(id: number) {
    return `This action returns a #${id} application`;
  }

  update(id: number, updateApplicationDto: UpdateApplicationDto) {
    return `This action updates a #${id} application`;
  }

  remove(id: number) {
    return `This action removes a #${id} application`;
  }
}
