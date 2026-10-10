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
import { UsersService } from "../users/users.service";

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job)
    private readonly jobsRepository: Repository<Job>,
    private readonly usersService: UsersService,
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

  /** Hạn nộp phải từ hôm nay trở đi (mốc hôm nay tính từ 0h sáng). */
  private validateDeadline(deadline: string | null | undefined): void {
    if (!deadline) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(deadline) < today) {
      throw new BadRequestException("Hạn nộp hồ sơ phải từ hôm nay trở đi");
    }
  }

  async create(createJobDto: CreateJobDto): Promise<Job> {
    // findOne của UsersService tự ném 404 nếu không có user
    const user = await this.usersService.findOne(createJobDto.createdBy);
    if (user.role !== "employer") {
      throw new BadRequestException("Chỉ nhà tuyển dụng mới được đăng tin");
    }

    this.validateSalary(createJobDto.salaryMin, createJobDto.salaryMax);
    this.validateDeadline(createJobDto.deadline);

    // companyId không tồn tại: DB báo lỗi khoá ngoại (23503), filter tự trả 400
    const job = this.jobsRepository.create(createJobDto);
    return this.jobsRepository.save(job);
  }

  /** Tin mới nhất lên đầu, có thể lọc theo status. */
  findAll(query: QueryJobDto = {}): Promise<Job[]> {
    return this.jobsRepository.find({
      where: query.status ? { status: query.status } : {},
      order: { createdAt: "DESC", id: "DESC" },
    });
  }

  /**
   * Lấy 1 job theo id, ném NotFoundException nếu không có
   * không lọc theo status/deadline: nơi gọi (vd. nộp đơn) tự kiểm tra
   * job.status === "open" và job.deadline.
   */
  async findOne(id: number): Promise<Job> {
    const job = await this.jobsRepository.findOne({ where: { id } });
    if (!job) {
      throw new NotFoundException("Không tìm thấy việc làm có id " + id);
    }
    return job;
  }

  async update(id: number, updateJobDto: UpdateJobDto): Promise<Job> {
    const job = await this.findOne(id);

    if (job.status === "blocked") {
      throw new ForBiddenException(
        "Tin đã bị quản trị viên khoá, không thể sửa",
      );
    }

    // Ghép giá trị mới với giá trị cũ trong DB rồi mới so sánh
    this.validateSalary(
      updateJobDto.salaryMin ?? job.salaryMin,
      updateJobDto.salaryMax ?? job.salaryMax,
    );
    this.validateDeadline(updateJobDto.deadline);

    this.jobsRepository.merge(job, updateJobDto);
    return this.jobsRepository.save(job);
  }

  async remove(id: number): Promise<{ message: string }> {
    const job = await this.findOne(id);
    await this.jobsRepository.remove(job);
    return { message: "Đã xoá việc làm có id " + id };
  }
}
