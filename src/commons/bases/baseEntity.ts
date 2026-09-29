import { Exclude } from "class-transformer";
import {
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from "typeorm";

export abstract class BaseEntity {
  constructor(baseEntity: Partial<BaseEntity>) {
    const keys = [
      "createdBy",
      "updatedBy",
      "deletedBy",
      "createdAt",
      "updatedAt",
      "deletedAt",
    ];
    if (baseEntity) {
      keys.forEach((key) => {
        if (baseEntity[key] !== undefined) {
          this[key] = baseEntity[key];
        }
      });
    }
  }

  @Column({ type: "varchar", nullable: true }) createdBy: string;
  @Column({ type: "varchar", nullable: true }) updatedBy: string;

  @CreateDateColumn({ type: "timestamp", name: "createdAt" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updatedAt" })
  updatedAt: Date;

  @Exclude()
  @Column({ type: "varchar", nullable: true })
  deletedBy: string;

  @Exclude()
  @DeleteDateColumn({ type: "timestamp", nullable: true, name: "deletedAt" })
  deletedAt: Date;
}
