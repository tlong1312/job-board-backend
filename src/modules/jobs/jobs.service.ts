import { Injectable, Optional } from "@nestjs/common";
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
import { createPaginationMeta, getPagination } from "commons/helper/pagination";
import { SkillsService } from "../skills/skills.service";
import { RedisService } from "../redis/redis.service";

/** Cache chỉ giữ ngắn: tin có hạn nộp nên không để dữ liệu cũ quá lâu. */
const PUBLIC_CACHE_TTL_SECONDS = 60;

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job)
    private readonly jobsRepository: Repository<Job>,
    @InjectRepository(ApplicationEntity)
    private readonly applicationsRepository: Repository<ApplicationEntity>,
    private readonly companiesService: CompaniesService,
    private readonly skillsService: SkillsService,
    // @Optional: không có Redis (vd. unit test) thì bỏ qua cache, vẫn chạy bằng DB
    @Optional() private readonly redis?: RedisService,
  ) {}

  private async invalidateCache(): Promise<void> {
    await this.redis?.invalidatePublicCache();
  }

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

    const { skillIds, ...jobData } = createJobDto;

    const skills = await this.skillsService.findByIds(skillIds ?? []);

    const job = this.jobsRepository.create({
      ...jobData,
      createdBy: user.id,
      status: "open",
      skills,
    });
    const saved = await this.jobsRepository.save(job);
    await this.invalidateCache();
    return saved;
  }

  /**tin mới nhất lên đầu, lọc theo status; khách/ứng viên chỉ thấy open. */
  async findAll(query: QueryJobDto = {}, user?: JwtUser) {
    // Chỉ cache góc nhìn khách/ứng viên (ai cũng thấy y hệt nhau: chỉ tin open).
    // Employer/admin thấy cả tin đóng/khoá nên không cache để khỏi lẫn dữ liệu.
    if (this.redis && !this.canSeeAllStatuses(user)) {
      const key = `jobs:list:${JSON.stringify(Object.entries(query).sort())}`;
      return this.redis.remember(key, PUBLIC_CACHE_TTL_SECONDS, () =>
        this.loadList(query, user),
      );
    }
    return this.loadList(query, user);
  }

  private async loadList(query: QueryJobDto, user?: JwtUser) {
    const { page, limit, skip } = getPagination(query);

    let status = query.status;

    if (!this.canSeeAllStatuses(user)) {
      if (status && status !== "open") {
        return {
          items: [],
          meta: createPaginationMeta(page, limit, 0),
        };
      }

      status = "open";
    }

    const qb = this.jobsRepository
      .createQueryBuilder("job")
      .leftJoinAndSelect("job.company", "company")
      .leftJoinAndSelect("job.skills", "skill")
      .where("1 = 1");

    if (status) {
      qb.andWhere("job.status = :status", { status });
    }

    // Khách/ứng viên không thấy tin đã quá hạn nộp (employer/admin vẫn thấy để quản lý)
    if (!this.canSeeAllStatuses(user)) {
      qb.andWhere("(job.deadline IS NULL OR job.deadline >= CURRENT_DATE)");
    }

    if (query.province) {
      qb.andWhere("LOWER(job.province) = LOWER(:province)", {
        province: query.province,
      });
    }

    if (query.level) {
      qb.andWhere("job.level = :level", {
        level: query.level,
      });
    }

    if (query.companyName) {
      qb.andWhere("LOWER(company.name) LIKE LOWER(:companyName)", {
        companyName: `%${query.companyName}%`,
      });
    }

    const [items, total] = await qb
      .orderBy("job.created_at", "DESC")
      .addOrderBy("job.id", "DESC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      meta: createPaginationMeta(page, limit, total),
    };
  }

  async findOne(id: number): Promise<Job> {
    const job = await this.jobsRepository.findOne({
      where: { id },
      relations: {
        company: true,
        skills: true,
      },
    });

    if (!job) {
      throw new NotFoundException("Không tìm thấy việc làm có id " + id);
    }

    return job;
  }

  /** UC14: chi tiết tin; khách/ứng viên không thấy tin closed/blocked (trả 404). */
  async findOneForViewer(id: number, user?: JwtUser): Promise<Job> {
    const load = async () => {
      const job = await this.findOne(id);
      if (!this.canSeeAllStatuses(user) && job.status !== "open") {
        throw new NotFoundException("Không tìm thấy việc làm có id " + id);
      }
      return job;
    };
    // Tin không open ném 404 trước khi tới bước lưu, nên cache chỉ chứa tin open.
    if (this.redis && !this.canSeeAllStatuses(user)) {
      return this.redis.remember(
        `jobs:detail:${id}`,
        PUBLIC_CACHE_TTL_SECONDS,
        load,
      );
    }
    return load();
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

    const { skillIds, ...jobData } = updateJobDto;

    this.jobsRepository.merge(job, jobData);

    if (skillIds !== undefined) {
      job.skills = await this.skillsService.findByIds(skillIds);
    }

    const saved = await this.jobsRepository.save(job);
    await this.invalidateCache();
    return saved;
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
    await this.invalidateCache();
    return { message: "Đã xoá việc làm có id " + id };
  }

  /** admin khoá tin (status = blocked). */
  async block(id: number): Promise<Job> {
    const job = await this.findOne(id);
    if (job.status === "blocked") {
      throw new BadRequestException("Tin đã bị khoá trước đó");
    }
    job.status = "blocked";
    const saved = await this.jobsRepository.save(job);
    await this.invalidateCache();
    return saved;
  }

  async findMyJobs(userId: number) {
    const jobs = await this.jobsRepository.find({
      where: { createdBy: userId },
      order: { id: "DESC" },
    });

    return jobs;
  }
}
