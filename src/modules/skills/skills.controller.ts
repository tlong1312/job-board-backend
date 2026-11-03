import { Body, Controller, Get, Post } from "@nestjs/common";
import { Roles } from "commons/decorators/roles.decorator";
import { CreateSkillDto } from "./dto/create-skill.dto";
import { SkillsService } from "./skills.service";

@Controller("skills")
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  findAll() {
    return this.skillsService.findAll();
  }

  @Post()
  @Roles("admin")
  create(@Body() dto: CreateSkillDto) {
    return this.skillsService.create(dto);
  }
}
