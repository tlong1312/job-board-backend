import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type UserRole = "candidate" | "employer" | "admin";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column({ name: "password_hash", select: false })
  passwordHash: string;

  @Column({ name: "full_name" })
  fullName: string;

  @Column({ type: "varchar", length: 20, nullable: true })
  phone: string | null;

  @Column({ type: "varchar", length: 20, default: "candidate" })
  role: UserRole;

  @Column({ name: "is_active", default: true })
  isActive: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}
