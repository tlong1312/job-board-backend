import { Controller, Get, Post, Body, Patch, Param, ParseIntPipe, Delete, Query } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';  
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';

@Controller("applications")
  export class ApplicationsController {
    constructor(
      private readonly applicationsService:
        ApplicationsService,
    ) {}

  @Post()
  create(
    @Body()
    createApplicationDto: CreateApplicationDto,
  ) {
    return this.applicationsService.create(
      createApplicationDto,
    );
  }
  
  @Get()
  findAll(
    @Query("jobId") jobId?: string,
    @Query("candidateId") candidateId?: string,
  ) {
    return this.applicationsService.findAll(
      jobId ? Number(jobId) : undefined,
      candidateId
        ? Number(candidateId)
        : undefined,
    );
  }

  @Get(":id")
  findOne(
    @Param("id", ParseIntPipe)
    id: number,
  ) {
    return this.applicationsService.findOne(id);
  }

  @Patch(":id/status")
  changeStatus(
    @Param("id", ParseIntPipe)
    id: number,

    @Body()
    updateApplicationStatusDto:
      UpdateApplicationStatusDto,
  ) {
    return this.applicationsService.changeStatus(
      id,
      updateApplicationStatusDto,
    );
  }

  @Get(":id/history")
  getHistory(
    @Param("id", ParseIntPipe)
    id: number,
  ) {
    return this.applicationsService.getHistory(id);
  }

  @Delete(":id")
  remove(
    @Param("id", ParseIntPipe)
    id: number,
  ) {
    return this.applicationsService.remove(id);
  }

}
