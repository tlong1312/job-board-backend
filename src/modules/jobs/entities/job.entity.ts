import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

// Danh sách giá trị hợp lệ, khớp CHECK trong init.sql; DTO dùng lại cho @IsIn
export const JOB_TYPES = [
  "full_time",
  "part_time",
  "internship",
  "contract",
] as const;
export const JOB_LEVELS = ["intern", "junior", "middle", "senior"] as const;
// blocked: quản trị viên khoá tin
export const JOB_STATUSES = ["open", "closed", "blocked"] as const;

export type JobType = (typeof JOB_TYPES)[number];
export type JobLevel = (typeof JOB_LEVELS)[number];
export type JobStatus = (typeof JOB_STATUSES)[number];

/**
 * Ánh xạ bảng `jobs` trong init.sql.
 *
 * KHÔNG ánh xạ cột `search_vector` (TSVECTOR GENERATED ALWAYS ... STORED):
 * Postgres tự tính, TypeORM mà ghi vào sẽ bị lỗi. Full-text search sẽ dùng
 * query builder / raw SQL ở tầng 3.
 */
@Entity("jobs")
export class Job {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "company_id" })
  companyId: number;

  @Column({ name: "created_by" })
  createdBy: number;

  @Column({ type: "varchar", length: 150 })
  title: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ type: "varchar", length: 150, nullable: true })
  location: string | null;

  @Column({
    name: "job_type",
    type: "varchar",
    length: 20,
    default: "full_time",
  })
  jobType: JobType;

  @Column({ type: "varchar", length: 20, nullable: true })
  level: JobLevel | null;

  @Column({ name: "salary_min", type: "int", nullable: true })
  salaryMin: number | null;

  @Column({ name: "salary_max", type: "int", nullable: true })
  salaryMax: number | null;

  @Column({ type: "varchar", length: 3, default: "VND" })
  currency: string;

  @Column({ type: "varchar", length: 20, default: "open" })
  status: JobStatus;

  /**
   * Cột DATE (không có giờ). TypeORM + pg trả về chuỗi "YYYY-MM-DD",
   * KHÔNG phải đối tượng Date -> so sánh hạn nộp dùng chuỗi hoặc tự parse.
   */
  @Column({ type: "date", nullable: true })
  deadline: string | null;

  @Column({ name: "views_count", type: "int", default: 0 })
  viewsCount: number;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}
