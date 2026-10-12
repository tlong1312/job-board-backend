import { CreateApplicationDto } from "./dto/create-application.dto";
import { UpdateApplicationStatusDto } from "./dto/update-application-status.dto";
import { ApplicationEntity } from "./entities/application.entity";
import { JobsService } from "../jobs/jobs.service";
import { InjectRepository } from "@nestjs/typeorm";
import { ApplicationStatusHistory } from "./entities/application-status-history.entity";
import { DataSource, Repository } from 'typeorm';
import { UsersService } from "../users/users.service";
import { Injectable } from "@nestjs/common";
import { BadRequestException, ConflictException, NotFoundException } from "commons/error";

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(ApplicationEntity)
    private readonly applicationsRepository: Repository<ApplicationEntity>,

    @InjectRepository(ApplicationStatusHistory)
    private readonly historyRepository: Repository<ApplicationStatusHistory>,

    private readonly jobsService: JobsService,

    private readonly usersService: UsersService,

    private readonly dataSource: DataSource,
  ) {}

  async create(createApplicationDto: CreateApplicationDto) {
    const job = await this.jobsService.findOne(createApplicationDto.jobId);

    const candidate = await this.usersService.findOne(createApplicationDto.candidateId);
    if (candidate.role !== "candidate") {
      throw new BadRequestException("Chỉ ứng viên mới được nộp hồ sơ");
    }

    const existingApplication = await this.applicationsRepository.findOne({
      where: {
        jobId: createApplicationDto.jobId,
        candidateId: createApplicationDto.candidateId,
      },
    });

    if (existingApplication) {
      throw new ConflictException("Ứng viên đã nộp hồ sơ cho tin này");
    }

    const application = this.applicationsRepository.create({
      jobId: createApplicationDto.jobId,
      candidateId: createApplicationDto.candidateId,
      resumeId: createApplicationDto.resumeId ?? null,
      coverLetter: createApplicationDto.coverLetter ?? null,
      status: "new",
    });
      
    return this.applicationsRepository.save(application);
  }

  async findAll(
    jobId?: number,
    candidateId?: number,
  ): Promise<ApplicationEntity[]> {
    const where: {
      jobId?: number;
      candidateId?: number;
    } = {};

    if (jobId) {
      where.jobId = jobId;
    }

    if (candidateId) {
      where.candidateId = candidateId;
    }

    return this.applicationsRepository.find({
      where,
      order: {
        createdAt: "DESC",
      },
    });
  }
  
  async findOne(id: number): Promise<ApplicationEntity> {
    const application = 
    await this.applicationsRepository.findOne({ where: { id } });
    if (!application) {
      throw new NotFoundException(
      `Không tìm thấy hồ sơ có id ${id}`,
    );
    }
    return application;
  }

  async changeStatus(
    id: number,
    updateApplicationStatusDto: UpdateApplicationStatusDto,
  ) {
    const application = await this.findOne(id);

    if (application.status === updateApplicationStatusDto.status) {
      throw new BadRequestException(
        "Hồ sơ đã ở trạng thái này",
      );
    }

    if (application.status === "rejected") {
      throw new BadRequestException(
        "Hồ sơ đã bị từ chối, không thể đổi trạng thái",
      );
    }

    return this.dataSource.transaction(
      async (manager) => {
        const oldStatus = application.status;

        application.status =
          updateApplicationStatusDto.status;

        const updatedApplication =
          await manager.save(
            ApplicationEntity,
            application,
          );

        const history = manager.create(
          ApplicationStatusHistory,
          {
            applicationId: application.id,
            fromStatus: oldStatus,
            toStatus:
              updateApplicationStatusDto.status,
            changedBy:
              updateApplicationStatusDto.changedBy,
            note:
              updateApplicationStatusDto.note ?? null,
          },
        );

        await manager.save(
          ApplicationStatusHistory,
          history,
        );

        return updatedApplication;
      },
    );
  }

  async getHistory(
    id: number,
  ): Promise<ApplicationStatusHistory[]> {
    await this.findOne(id);

    return this.historyRepository.find({
      where: {
        applicationId: id,
      },
      order: {
        createdAt: "ASC",
      },
    });
  }

  async remove(id: number) {
    const application = await this.findOne(id);

    if (application.status !== "new") {
      throw new BadRequestException(
        "Chỉ rút được hồ sơ ở trạng thái mới",
      );
    }

    await this.applicationsRepository.remove(
      application,
    );

    return {
      message: "Rút hồ sơ thành công",
    };
  }
}