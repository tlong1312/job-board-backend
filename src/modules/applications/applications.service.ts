import { CreateApplicationDto } from "./dto/create-application.dto";
import { UpdateApplicationStatusDto } from "./dto/update-application-status.dto";
import { ApplicationEntity } from "./entities/application.entity";
import { JobsService } from "../jobs/jobs.service";
import { InjectRepository } from "@nestjs/typeorm";
import { ApplicationStatusHistory } from "./entities/application-status-history.entity";
import { DataSource, Repository } from "typeorm";
import { Injectable } from "@nestjs/common";
import { CompaniesService } from "../companies/companies.service";
import { MailProducer } from "../mail/mail.producer";
import { JwtUser } from "commons/decorators/current-user.decorator";
import {
  BadRequestException,
  ConflictException,
  ForBiddenException,
  NotFoundException,
} from "commons/error";

export interface ApplicationListItem {
  id: number;
  jobId: number;
  candidateId: number;
  resumeId: number | null;
  coverLetter: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  jobTitle: string;
  companyName: string | null;
  candidateName: string;
}

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(ApplicationEntity)
    private readonly applicationsRepository: Repository<ApplicationEntity>,

    @InjectRepository(ApplicationStatusHistory)
    private readonly historyRepository: Repository<ApplicationStatusHistory>,

    private readonly jobsService: JobsService,

    private readonly dataSource: DataSource,

    private readonly companiesService: CompaniesService,

    private readonly mailProducer: MailProducer,
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

    return this.applicationsRepository.save(application);
  }

  async findAll(
    currentUser: JwtUser,
    jobId?: number,
  ): Promise<ApplicationListItem[]> {
    const qb = this.applicationsRepository
      .createQueryBuilder("application")
      .innerJoin("jobs", "job", "job.id = application.job_id")
      .innerJoin("companies", "company", "company.id = job.company_id")
      .innerJoin(
        "users",
        "candidate",
        "candidate.id = application.candidate_id",
      )
      .select([
        "application.id AS id",
        'application.job_id AS "jobId"',
        'application.candidate_id AS "candidateId"',
        'application.resume_id AS "resumeId"',
        'application.cover_letter AS "coverLetter"',
        "application.status AS status",
        'application.created_at AS "createdAt"',
        'application.updated_at AS "updatedAt"',
        'job.title AS "jobTitle"',
        'company.name AS "companyName"',
        'candidate.full_name AS "candidateName"',
      ])
      .orderBy("application.createdAt", "DESC");

    if (currentUser.role === "candidate") {
      qb.andWhere("application.candidate_id = :candidateId", {
        candidateId: currentUser.id,
      });
    } else if (currentUser.role === "employer") {
      if (jobId === undefined) {
        throw new BadRequestException("Nhà tuyển dụng phải cung cấp jobId");
      }

      await this.assertCompanyOwner(jobId, currentUser.id);

      qb.andWhere("application.job_id = :jobId", {
        jobId,
      });
    } else if (currentUser.role === "admin") {
      if (jobId !== undefined) {
        qb.andWhere("application.job_id = :jobId", {
          jobId,
        });
      }
    } else {
      throw new ForBiddenException("Bạn không có quyền xem hồ sơ");
    }

    return qb.getRawMany<ApplicationListItem>();
  }

  private async assertCompanyOwner(
    jobId: number,
    employerId: number,
  ): Promise<void> {
    const job = await this.jobsService.findOne(jobId);
    const company = await this.companiesService.findOne(job.companyId);
    if (company.ownerId !== employerId) {
      throw new ForBiddenException("Hồ sơ không ứng tuyển vào công ty của bạn");
    }
  }

  async findOneForViewer(
    id: number,
    currentUser: JwtUser,
  ): Promise<ApplicationEntity> {
    const application = await this.findOne(id);
    if (currentUser.role === "admin") return application;
    if (
      currentUser.role === "candidate" &&
      application.candidateId === currentUser.id
    ) {
      return application;
    }
    if (currentUser.role === "employer") {
      await this.assertCompanyOwner(application.jobId, currentUser.id);
      return application;
    }
    throw new ForBiddenException("Bạn không có quyền xem hồ sơ này");
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

    const { updatedApplication, historyId } = await this.dataSource.transaction(
      async (manager) => {
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

        const savedHistory = await manager.save(
          ApplicationStatusHistory,
          history,
        );

        return {
          updatedApplication,
          historyId: savedHistory.id,
        };
      },
    );

    this.mailProducer.enqueueStatusChanged({
      applicationId: updatedApplication.id,
      historyId,
    });

    return updatedApplication;
  }

  async getHistory(
    id: number,
    currentUser: JwtUser,
  ): Promise<ApplicationStatusHistory[]> {
    await this.findOneForViewer(id, currentUser);

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
