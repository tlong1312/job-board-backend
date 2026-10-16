import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CreateJobDto } from "./dto/create-job.dto";
import { UpdateJobDto } from "./dto/update-job.dto";
import { QueryJobDto } from "./dto/query-job.dto";
import { Job } from "./entities/job.entity";
import {
  BadRequestException,
  ForBiddenException,
  NotFoundException,
} from "commons/error";
import { JwtUser } from "commons/decorators/current-user.decorator";
import { CompaniesService } from "../companies/companies.service";
import { ApplicationEntity } from "../applications/entities/application.entity";

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job)
    private readonly jobsRepository: Repository<Job>,
    @InjectRepository(ApplicationEntity)
    private readonly applicationsRepository: Repository<ApplicationEntity>,
    private readonly companiesService: CompaniesService,
  ) {}

  /** Lương tối đa không được nhỏ hơn lương tối thiểu (chỉ so khi có đủ cả hai). */
  private validateSalary(
    salaryMin: number | null | undefined,
    salaryMax: number | null | undefined,
  ): void {
    if (salaryMin != null && salaryMax != null && salaryMax < salaryMin) {
      throw new BadRequestException(
        "Lương tối đa không được nhỏ hơn lương tối thiểu",
      );
    }
  }

  /** Hạn nộp phải từ hôm nay trở đi. So sánh chuỗi YYYY-MM-DD với ngày hôm nay (giờ máy chủ). */
  private validateDeadline(deadline: string | null | undefined): void {
    if (!deadline) return;
    const now = new Date();
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    if (deadline.slice(0, 10) < today) {
      throw new BadRequestException("Hạn nộp hồ sơ phải từ hôm nay trở đi");
    }
  }

  /** Chủ tin hoặc admin mới được sửa/xoá. */
  private assertOwnerOrAdmin(job: Job, user: JwtUser): void {
    if (user.role !== "admin" && job.createdBy !== user.id) {
      throw new ForBiddenException(
        "Chỉ chủ tin hoặc quản trị viên mới được thực hiện thao tác này",
      );
    }
  }

  /** Khách và ứng viên chỉ được thấy tin open. Employer/admin thấy tất cả. */
  private canSeeAllStatuses(user?: JwtUser): boolean {
    return !!user && (user.role === "admin" || user.role === "employer");
  }

  /** UC11: người đăng lấy từ token, tin tạo ra ở trạng thái open. */
  async create(createJobDto: CreateJobDto, user: JwtUser): Promise<Job> {
    // CompaniesService.findOne tự ném 404 nếu công ty không tồn tại
    const company = await this.companiesService.findOne(createJobDto.companyId);
    if (company.ownerId !== user.id) {
      throw new ForBiddenException("Công ty không thuộc về bạn");
    }

    this.validateSalary(createJobDto.salaryMin, createJobDto.salaryMax);
    this.validateDeadline(createJobDto.deadline);

    const job = this.jobsRepository.create({
      ...createJobDto,
      createdBy: user.id,
      status: "open",
    });
    return this.jobsRepository.save(job);
  }

  /**tin mới nhất lên đầu, lọc theo status; khách/ứng viên chỉ thấy open. */
  async findAll(query: QueryJobDto = {}, user?: JwtUser): Promise<Job[]> {
    let status = query.status;
    if (!this.canSeeAllStatuses(user)) {
      // xin tin không phải open thì không có gì để thấy
      if (status && status !== "open") return [];
      status = "open";
    }
    return this.jobsRepository.find({
      where: status ? { status } : {},
      order: { createdAt: "DESC", id: "DESC" },
    });
  }

  /**
   * tra job.status === "open" và job.deadline). API chi tiết dùng findOneForViewer.
   */
  async findOne(id: number): Promise<Job> {
    const job = await this.jobsRepository.findOne({ where: { id } });
    if (!job) {
      throw new NotFoundException("Không tìm thấy việc làm có id " + id);
    }
    return job;
  }

  /** UC14: chi tiết tin; khách/ứng viên không thấy tin closed/blocked (trả 404). */
  async findOneForViewer(id: number, user?: JwtUser): Promise<Job> {
    const job = await this.findOne(id);
    if (!this.canSeeAllStatuses(user) && job.status !== "open") {
      throw new NotFoundException("Không tìm thấy việc làm có id " + id);
    }
    return job;
  }

  /** chủ tin hoặc admin sửa tin / đóng tin (status = closed). */
  async update(
    id: number,
    updateJobDto: UpdateJobDto,
    user: JwtUser,
  ): Promise<Job> {
    const job = await this.findOne(id);
    this.assertOwnerOrAdmin(job, user);

    if (job.status === "blocked") {
      throw new ForBiddenException(
        "Tin đã bị quản trị viên khoá, không thể sửa",
      );
    }

    // ghép giá trị mới với giá trị cũ trong DB rồi mới so sánh
    this.validateSalary(
      updateJobDto.salaryMin ?? job.salaryMin,
      updateJobDto.salaryMax ?? job.salaryMax,
    );
    this.validateDeadline(updateJobDto.deadline);

    this.jobsRepository.merge(job, updateJobDto);
    return this.jobsRepository.save(job);
  }

  /** chủ tin hoặc admin xoá; tin đã có hồ sơ thì phải đóng tin thay vì xoá. */
  async remove(id: number, user: JwtUser): Promise<{ message: string }> {
    const job = await this.findOne(id);
    this.assertOwnerOrAdmin(job, user);

    const applicationCount = await this.applicationsRepository.count({
      where: { jobId: id },
    });
    if (applicationCount > 0) {
      throw new BadRequestException(
        "Tin đã có hồ sơ ứng tuyển, hãy đóng tin thay vì xoá (xoá tin sẽ xoá luôn các hồ sơ)",
      );
    }

    await this.jobsRepository.remove(job);
    return { message: "Đã xoá việc làm có id " + id };
  }

  /** admin khoá tin (status = blocked). */
  async block(id: number): Promise<Job> {
    const job = await this.findOne(id);
    if (job.status === "blocked") {
      throw new BadRequestException("Tin đã bị khoá trước đó");
    }
    job.status = "blocked";
    return this.jobsRepository.save(job);
  }
}
