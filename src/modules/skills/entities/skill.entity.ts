import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("skills")
export class Skill {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 80, unique: true })
  name: string;
}
