import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ResumesService } from './resumes.service';
import { CreateResumeDto } from './dto/create-resume.dto';
import { UpdateResumeDto } from './dto/update-resume.dto';

@ApiTags('Resumes')
@Controller('resumes')
export class ResumesController {
  constructor(private readonly resumesService: ResumesService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo CV mới' })
  create(@Body() createResumeDto: CreateResumeDto) {
    return this.resumesService.create(createResumeDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách CV' })
  @ApiQuery({ name: 'userId', required: false, type: Number, description: 'Lọc CV theo ID ứng viên' })
  findAll(@Query('userId') userId?: string) {
    return this.resumesService.findAll(userId ? +userId : undefined);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết một CV' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.resumesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật CV' })
  update(
    @Param('id', ParseIntPipe) id: number, 
    @Body() updateResumeDto: UpdateResumeDto
  ) {
    return this.resumesService.update(id, updateResumeDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa CV' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.resumesService.remove(id);
  }
}