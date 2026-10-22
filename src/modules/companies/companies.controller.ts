import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { Roles } from 'commons/decorators/roles.decorator';
import { Public } from 'commons/decorators/public.decorator';
import { CurrentUser } from 'commons/decorators/current-user.decorator';

@ApiTags('Companies')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @Roles('employer')
  @ApiOperation({ summary: 'Tạo mới một công ty' })
  create(
    @CurrentUser('id') ownerId: number,
    @Body() createCompanyDto: CreateCompanyDto
  ) {
    createCompanyDto.ownerId = ownerId;
    return this.companiesService.create(createCompanyDto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Lấy danh sách tất cả công ty' })
  findAll() {
    return this.companiesService.findAll();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Lấy thông tin chi tiết một công ty theo ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.companiesService.findOne(id);
  }

  @Get('owner/:ownerId')
  @Public()
  @ApiOperation({ summary: 'Lấy thông tin chi tiết một công ty theo ID người dùng' })
  async findByOwnerId(@Param('ownerId', ParseIntPipe) ownerId: number) {
    const companies = await this.companiesService.findByOwnerId(ownerId);
    return {
      statusCode: 200,
      message: `Lấy danh sách công ty của ownerId ${ownerId} thành công`,
      data: companies,
    };
  }
  
  @Patch(':id')
  @Roles('employer')
  @ApiOperation({ summary: 'Cập nhật thông tin công ty' })
  update(
    @Param('id', ParseIntPipe) id: number, 
    @Body() updateCompanyDto: UpdateCompanyDto,
    @CurrentUser('id') currentUser: any
  ) {
    return this.companiesService.update(id, updateCompanyDto, currentUser);
  }

  @Delete(':id')
  @Roles('employer', 'admin')
  @ApiOperation({ 
    summary: 'Xóa công ty theo ID',
    description: '**LƯU Ý:** Xóa công ty sẽ kéo theo xóa toàn bộ các job thuộc về công ty này.' 
  })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') currentUser: any
  ) {
    return this.companiesService.remove(id, currentUser);
  }
}