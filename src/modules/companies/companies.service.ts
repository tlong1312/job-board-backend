import { 
  Injectable, 
  NotFoundException, 
  BadRequestException, 
  ConflictException 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './entity/company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UsersService } from '../users/users.service'; // Import UsersService

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private companiesRepository: Repository<Company>,
    private usersService: UsersService, // Inject UsersService để gọi findOne
  ) {}

  async create(createCompanyDto: CreateCompanyDto) {
    // 1. Kiểm tra chủ công ty (hàm findOne của usersService sẽ tự ném 404 nếu không thấy)
    const owner = await this.usersService.findOne(createCompanyDto.ownerId);

    // 2. Kiểm tra quyền của chủ công ty
    if (owner.role !== 'employer') {
      throw new BadRequestException('Chỉ nhà tuyển dụng mới được tạo công ty');
    }

    // 3. Kiểm tra trùng tên công ty của cùng 1 chủ
    const existingCompany = await this.companiesRepository.findOne({
      where: { ownerId: createCompanyDto.ownerId, name: createCompanyDto.name },
    });

    if (existingCompany) {
      throw new ConflictException('Bạn đã có công ty cùng tên');
    }

    // 4. Lưu vào database
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
      throw new NotFoundException('Không tìm thấy công ty có id ' + id);
    }
    
    return company;
  }

  async update(id: number, updateCompanyDto: UpdateCompanyDto) {
    // 1. Kiểm tra công ty có tồn tại không
    const company = await this.findOne(id);

    // 2. Nếu có cập nhật tên công ty, cần kiểm tra xem tên mới có bị trùng với công ty khác của chính chủ đó không
    if (updateCompanyDto.name) {
      const existingCompany = await this.companiesRepository.findOne({
        where: { ownerId: company.ownerId, name: updateCompanyDto.name },
      });

      // Nếu tìm thấy công ty cùng tên, nhưng khác ID với công ty đang sửa -> ném lỗi
      if (existingCompany && existingCompany.id !== id) {
        throw new ConflictException('Bạn đã có công ty cùng tên');
      }
    }

    // 3. Thực hiện cập nhật
    await this.companiesRepository.update(id, updateCompanyDto);
    
    return this.findOne(id); // Trả về data mới nhất sau khi update
  }

  async remove(id: number) {
    // Kiểm tra tồn tại trước khi xóa
    await this.findOne(id);
    
    await this.companiesRepository.delete(id);
    
    return {
      statusCode: 200,
      message: `Đã xóa thành công công ty có id ${id}`,
    };
  }
}