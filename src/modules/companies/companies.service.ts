import { 
  Injectable, 
  NotFoundException, 
  BadRequestException, 
  ConflictException,
  ForbiddenException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './entity/company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private companiesRepository: Repository<Company>,
    private usersService: UsersService,
  ) {}

  async create(createCompanyDto: CreateCompanyDto) {
    const owner = await this.usersService.findOne(createCompanyDto.ownerId);

    if (owner.role !== 'employer') {
      throw new BadRequestException('Chỉ nhà tuyển dụng mới được tạo công ty');
    }

    const existingCompany = await this.companiesRepository.findOne({
      where: { ownerId: createCompanyDto.ownerId, name: createCompanyDto.name },
    });

    if (existingCompany) {
      throw new ConflictException('Bạn đã có công ty cùng tên');
    }

    const newCompany = this.companiesRepository.create(createCompanyDto);
    return await this.companiesRepository.save(newCompany);
  }

  async findAll() {
    return await this.companiesRepository.find({ 
      relations: {
        owner: true 
      } 
    }); 
  }

  async findOne(id: number) {
    const company = await this.companiesRepository.findOne({ 
      where: { id },
      relations: {
        owner: true
      } 
    });
    
    if (!company) {
      throw new NotFoundException('Không tìm thấy công ty có id ${id}');
    }
    
    return company;
  }

  async findByOwnerId(ownerId: number) {
    const owner = await this.usersService.findOne(ownerId);
    
    if (!owner) {
      throw new NotFoundException(`Không tìm thấy người dùng có id là ${ownerId}`);
    }
    const companies = await this.companiesRepository.find({
      where: { ownerId },
      relations: {
        owner: true 
      }
    });
    if (companies.length === 0) {
      throw new NotFoundException(`Người dùng với id ${ownerId} hiện chưa tạo công ty nào`);
    }
    return companies;
  }

  async update(id: number, updateCompanyDto: UpdateCompanyDto, currentUser: any) {
    const company = await this.findOne(id);

    if (currentUser.role !== 'admin' && currentUser.id !== company.ownerId) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa thông tin của công ty này');
    }

    if (updateCompanyDto.name) {
      const existingCompany = await this.companiesRepository.findOne({
        where: { ownerId: company.ownerId, name: updateCompanyDto.name },
      });

      if (existingCompany && existingCompany.id !== id) {
        throw new ConflictException('Bạn đã có công ty cùng tên');
      }
    }

    await this.companiesRepository.update(id, updateCompanyDto);
    
    return this.findOne(id); 
  }

  async remove(id: number, currentUser: any) {
    const company = await this.findOne(id);
    
    if (currentUser.role !== 'admin' && currentUser.id !== company.ownerId) {
      throw new ForbiddenException('Bạn không có quyền xóa công ty này');
    }

    await this.companiesRepository.delete(id);
    
    return {
      statusCode: 200,
      message: `Đã xóa thành công công ty có id ${id}`,
    };
  }
}