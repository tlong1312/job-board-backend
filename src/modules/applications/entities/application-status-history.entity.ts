import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("application_status_history")
export class ApplicationStatusHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({name: "application_id",type: "int",})
  applicationId: number;

  @Column({name: "from_status",type: "varchar",length: 20,nullable: true,})
  fromStatus: string | null;

  @Column({name: "to_status",type: "varchar",length: 20,})
  toStatus: string;

  @Column({name: "changed_by",type: "int",nullable: true,})
  changedBy: number | null;

  @Column({type: "text",nullable: true,})
  note: string | null;

  @CreateDateColumn({name: "created_at",type: "timestamptz",})
  createdAt: Date;
}