import { Injectable } from "@nestjs/common";
import { CreateJobDto } from "./dto/create-job.dto";
import { UpdateJobDto } from "./dto/update-job.dto";
import { Job } from "./entities/job.entity";
import { NotFoundException } from "commons/error";

@Injectable()
export class JobsService {
  private readonly jobs: Job[] = [];
  private nextId = 1;

  create(createJobDto: CreateJobDto): Job {
    const job: Job = { id: this.nextId++, ...createJobDto };
    this.jobs.push(job);
    return job;
  }

  findAll(): Job[] {
    return this.jobs;
  }

  findOne(id: number): Job {
    const job = this.jobs.find((j) => j.id === id);
    if (!job) {
      throw new NotFoundException(`Không tìm thấy việc làm có id ${id}`);
    }
    return job;
  }

  update(id: number, updateJobDto: UpdateJobDto) {
    return `This action updates a #${id} job`;
  }

  remove(id: number) {
    return `This action removes a #${id} job`;
  }
}
