import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Resume } from './entities/resume.entity';
import { CreateResumeDto } from './dto/create-resume.dto';
import { UpdateResumeDto } from './dto/update-resume.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class ResumesService {
  constructor(
    @InjectRepository(Resume)
    private readonly resumesRepository: Repository<Resume>,
    private readonly usersService: UsersService,
    private readonly dataSource: DataSource, 
  ) {}

  async create(createResumeDto: CreateResumeDto) {
    const user = await this.usersService.findOne(createResumeDto.userId);

    if (user.role !== 'candidate') {
      throw new BadRequestException('Chỉ ứng viên mới được tải CV');
    }

    if (createResumeDto.isDefault) {
      // Dùng transaction để hạ cờ mặc định của các CV cũ và lưu CV mới
      return await this.dataSource.transaction(async (manager) => {
        // 1. Hạ toàn bộ cờ isDefault của user này xuống false
        await manager.update(Resume, { userId: createResumeDto.userId }, { isDefault: false });
        
        // 2. Lưu CV mới với isDefault = true
        const newResume = manager.create(Resume, createResumeDto);
        return await manager.save(newResume);
      });
    }

    // Nếu không set mặc định thì lưu bình thường
    const newResume = this.resumesRepository.create(createResumeDto);
    return await this.resumesRepository.save(newResume);
  }

  findAll(userId?: number) {
    const query = userId ? { where: { userId } } : {};
    return this.resumesRepository.find(query);
  }

  async findOne(id: number) {
    const resume = await this.resumesRepository.findOne({ where: { id } });
    if (!resume) {
      throw new NotFoundException('Không tìm thấy CV có id ' + id);
    }
    return resume;
  }

  async update(id: number, updateResumeDto: UpdateResumeDto) {
    const resume = await this.findOne(id); // Gọi hàm findOne để bắt 404 nếu không tồn tại

    if (updateResumeDto.isDefault) {
      const targetUserId = updateResumeDto.userId || resume.userId;
      
      return await this.dataSource.transaction(async (manager) => {
        // Hạ cờ các CV khác của user
        await manager.update(Resume, { userId: targetUserId }, { isDefault: false });
        
        // Cập nhật CV hiện tại
        Object.assign(resume, updateResumeDto);
        return await manager.save(resume);
      });
    }

    Object.assign(resume, updateResumeDto);
    return await this.resumesRepository.save(resume);
  }

  async remove(id: number) {
    const resume = await this.findOne(id);
    await this.resumesRepository.remove(resume);
    return { message: 'Đã xóa CV thành công' };
  }
}