import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { BadRequestException } from "commons/error";
import { CreateSkillDto } from "./dto/create-skill.dto";
import { Skill } from "./entities/skill.entity";

@Injectable()
export class SkillsService {
  constructor(
    @InjectRepository(Skill)
    private readonly skillsRepository: Repository<Skill>,
  ) {}

  async findAll(): Promise<Skill[]> {
    return this.skillsRepository.find({
      order: {
        name: "ASC",
      },
    });
  }

  async create(dto: CreateSkillDto): Promise<Skill> {
    const name = dto.name.trim();

    const existing = await this.skillsRepository.findOne({
      where: { name },
    });

    if (existing) {
      throw new BadRequestException("Kỹ năng đã tồn tại");
    }

    const skill = this.skillsRepository.create({ name });
    return this.skillsRepository.save(skill);
  }

  async findByIds(ids: number[]): Promise<Skill[]> {
    if (ids.length === 0) return [];

    const uniqueIds = [...new Set(ids)];

    const skills = await this.skillsRepository.find({
      where: {
        id: In(uniqueIds),
      },
    });

    if (skills.length !== uniqueIds.length) {
      throw new BadRequestException("Một hoặc nhiều kỹ năng không tồn tại");
    }

    return skills;
  }
}
