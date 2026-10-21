import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("resumes")
export class Resume {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "user_id", type: "int" })
  userId: number;

  @Column({ name: "file_path", type: "varchar", length: 500 })
  fileUrl: string;

  @Column({ name: "file_name", type: "varchar", length: 255 })
  fileName: string;

  @Column({ name: "mime_type", type: "varchar", length: 100, nullable: true })
  mimeType: string | null;

  @Column({ name: "file_size", type: "int", nullable: true })
  fileSize: number | null;

  @Column({ name: "is_default", type: "boolean", default: false })
  isDefault: boolean;

  @CreateDateColumn({
    name: "uploaded_at",
    type: "timestamptz",
  })
  uploadedAt: Date;
}
