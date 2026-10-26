import { Injectable } from '@nestjs/common';
import { NotFoundException, BadRequestException } from 'commons/error';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Resume } from './entities/resume.entity';
import { CreateResumeDto } from './dto/create-resume.dto';
import { UpdateResumeDto } from './dto/update-resume.dto';
import { UsersService } from '../users/users.service';
import * as fs from 'fs';
import { join } from 'path';

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
      return await this.dataSource.transaction(async (manager) => {
        await manager.update(Resume, { userId: createResumeDto.userId }, { isDefault: false });
        
        const newResume = manager.create(Resume, createResumeDto);
        return await manager.save(newResume);
      });
    }

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
    const resume = await this.findOne(id);

    if (updateResumeDto.isDefault) {
      const targetUserId = updateResumeDto.userId || resume.userId;
      
      return await this.dataSource.transaction(async (manager) => {
        await manager.update(Resume, { userId: targetUserId }, { isDefault: false });
        
        Object.assign(resume, updateResumeDto);
        return await manager.save(resume);
      });
    }

    Object.assign(resume, updateResumeDto);
    return await this.resumesRepository.save(resume);
  }

  async remove(id: number) {
    const resume = await this.resumesRepository.findOne({ where: { id } });
    if (!resume) {
      throw new NotFoundException(`Không tìm thấy CV có id ${id}`);
    }

    await this.resumesRepository.delete(id);
    if (resume.fileName) {
      const filePath = join(process.cwd(), 'uploads', resume.fileName);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath); 
        } catch (error) {
          console.error(`Không thể xóa file vật lý: ${filePath}`, error);
        }
      }
    }

    return { 
      statusCode: 200, 
      message: 'Đã xóa thành công CV và file đính kèm' 
    };
  }
}