import { CreateApplicationDto } from "./dto/create-application.dto";
import { UpdateApplicationStatusDto } from "./dto/update-application-status.dto";
import { ApplicationEntity } from "./entities/application.entity";
import { JobsService } from "../jobs/jobs.service";
import { InjectRepository } from "@nestjs/typeorm";
import { ApplicationStatusHistory } from "./entities/application-status-history.entity";
import { DataSource, Repository } from "typeorm";
import { Injectable, Optional } from "@nestjs/common";
import { JwtUser } from "commons/decorators/current-user.decorator";
import {
  BadRequestException,
  ConflictException,
  ForBiddenException,
  NotFoundException,
} from "commons/error";
import { AiApplicationsProducer } from "../ai/applications/ai-applications.producer";

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(ApplicationEntity)
    private readonly applicationsRepository: Repository<ApplicationEntity>,

    @InjectRepository(ApplicationStatusHistory)
    private readonly historyRepository: Repository<ApplicationStatusHistory>,

    private readonly jobsService: JobsService,

    private readonly dataSource: DataSource,

    @Optional() private readonly aiApplications?: AiApplicationsProducer,
  ) {}

  async create(
    createApplicationDto: CreateApplicationDto,
    candidateId: number,
  ) {
    const job = await this.jobsService.findOne(createApplicationDto.jobId);

    if (job.status !== "open") {
      throw new BadRequestException(
        "Tin tuyển dụng đã đóng hoặc bị khoá, không nhận hồ sơ",
      );
    }

    if (job.deadline) {
      const today = new Date();

      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");

      const todayString = `${year}-${month}-${day}`;

      if (job.deadline < todayString) {
        throw new BadRequestException("Tin đã hết hạn nộp hồ sơ");
      }
    }

    const existingApplication = await this.applicationsRepository.findOne({
      where: {
        jobId: createApplicationDto.jobId,
        candidateId,
      },
    });

    if (existingApplication) {
      throw new ConflictException("Ứng viên đã nộp hồ sơ cho tin này");
    }

    const application = this.applicationsRepository.create({
      jobId: createApplicationDto.jobId,
      candidateId,
      resumeId: createApplicationDto.resumeId ?? null,
      coverLetter: createApplicationDto.coverLetter ?? null,
      status: "new",
    });

    const saved = await this.applicationsRepository.save(application);
    this.aiApplications?.enqueueScoreApplication(saved.id);
    return saved;
  }

  async findAll(
    currentUser: JwtUser,
    jobId?: number,
  ): Promise<ApplicationEntity[]> {
    if (currentUser.role === "candidate") {
      return this.applicationsRepository.find({
        where: {
          candidateId: currentUser.id,
        },
        order: {
          createdAt: "DESC",
        },
      });
    }

    if (!jobId) {
      throw new BadRequestException("Nhà tuyển dụng phải cung cấp jobId");
    }

    const job = await this.jobsService.findOne(jobId);

    if (job.createdBy !== currentUser.id) {
      throw new ForBiddenException("Bạn không phải chủ tin tuyển dụng này");
    }

    return this.applicationsRepository.find({
      where: {
        jobId,
      },
      order: {
        createdAt: "DESC",
      },
    });
  }

  async findOneForCandidate(
    id: number,
    candidateId: number,
  ): Promise<ApplicationEntity> {
    const application = await this.findOne(id);

    if (application.candidateId !== candidateId) {
      throw new ForBiddenException("Bạn không có quyền xem hồ sơ này");
    }

    return application;
  }

  async findOne(id: number): Promise<ApplicationEntity> {
    const application = await this.applicationsRepository.findOne({
      where: { id },
    });

    if (!application) {
      throw new NotFoundException(`Không tìm thấy hồ sơ có id ${id}`);
    }

    return application;
  }

  async changeStatus(
    id: number,
    dto: UpdateApplicationStatusDto,
    employerId: number,
  ) {
    const application = await this.findOne(id);

    const job = await this.jobsService.findOne(application.jobId);

    if (job.createdBy !== employerId) {
      throw new ForBiddenException("Bạn không phải chủ tin tuyển dụng này");
    }

    if (application.status === dto.status) {
      throw new BadRequestException("Hồ sơ đã ở trạng thái này");
    }

    if (application.status === "rejected") {
      throw new BadRequestException(
        "Hồ sơ đã bị từ chối, không thể đổi trạng thái",
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const oldStatus = application.status;

      application.status = dto.status;

      const updatedApplication = await manager.save(
        ApplicationEntity,
        application,
      );

      const history = manager.create(ApplicationStatusHistory, {
        applicationId: application.id,
        fromStatus: oldStatus,
        toStatus: dto.status,

        // ID lấy từ JWT
        changedBy: employerId,

        note: dto.note ?? null,
      });

      await manager.save(ApplicationStatusHistory, history);

      return updatedApplication;
    });
  }

  async getHistory(
    id: number,
    currentUser: JwtUser,
  ): Promise<ApplicationStatusHistory[]> {
    const application = await this.findOne(id);

    if (currentUser.role === "candidate") {
      if (application.candidateId !== currentUser.id) {
        throw new ForBiddenException(
          "Bạn không có quyền xem lịch sử hồ sơ này",
        );
      }
    }

    if (currentUser.role === "employer") {
      const job = await this.jobsService.findOne(application.jobId);

      if (job.createdBy !== currentUser.id) {
        throw new ForBiddenException("Bạn không phải chủ tin tuyển dụng này");
      }
    }

    return this.historyRepository.find({
      where: {
        applicationId: id,
      },
      order: {
        createdAt: "ASC",
      },
    });
  }

  async remove(id: number, candidateId: number) {
    const application = await this.findOne(id);

    if (application.candidateId !== candidateId) {
      throw new ForBiddenException("Bạn không có quyền rút hồ sơ này");
    }

    if (application.status !== "new") {
      throw new BadRequestException("Chỉ rút được hồ sơ ở trạng thái mới");
    }

    await this.applicationsRepository.remove(application);

    return {
      message: "Rút hồ sơ thành công",
    };
  }
}
