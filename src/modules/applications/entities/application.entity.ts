import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('applications')
export class ApplicationEntity {
  @PrimaryGeneratedColumn()
  id: number;
  
  @Column({ name: 'job_id', type: 'int' })
  jobId: number;

  @Column({ name: 'candidate_id', type: 'int' })
  candidateId: number;

  @Column({ name: 'resume_id', type: 'int', nullable: true })
  resumeId: number | null;

  @Column({ name: 'cover_letter', type: 'text', nullable: true })
  coverLetter: string | null;

  @Column({ type: 'varchar', length: 20, default: 'new' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
