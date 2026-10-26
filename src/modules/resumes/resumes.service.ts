import { Injectable } from '@nestjs/common';
import { NotFoundException, BadRequestException } from 'commons/error';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Resume } from './entities/resume.entity';
import { CreateResumeDto } from './dto/create-resume.dto';
import { UpdateResumeDto } from './dto/update-resume.dto';
import { UsersService } from '../users/users.service';
import { ApplicationEntity } from '../applications/entities/application.entity';
import { Job } from '../jobs/entities/job.entity';
import { Company } from '../companies/entities/company.entity';
import * as fs from 'fs';
import { join } from 'path';

@Injectable()
export class ResumesService {
  constructor(
    @InjectRepository(Resume)
    private readonly resumesRepository: Repository<Resume>,
    
    @InjectRepository(ApplicationEntity)
    private readonly applicationsRepository: Repository<ApplicationEntity>,
    @InjectRepository(Job)
    private readonly jobsRepository: Repository<Job>,
    @InjectRepository(Company)
    private readonly companiesRepository: Repository<Company>,

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

  async findOne(id: number, currentUser?: any) {
  const resume = await this.resumesRepository.findOne({ where: { id } });
  if (!resume) {
    throw new NotFoundException('Không tìm thấy CV có id ' + id);
  }

  if (currentUser) {
    const userId = +(currentUser.id || currentUser.userId || currentUser.sub);
    const isAdmin = currentUser.role === 'admin';
    const isOwner = resume.userId === userId;
    const isEmployer = await this.checkEmployerAccess(userId, resume.id);

    if (!isAdmin && !isOwner && !isEmployer) {
      throw new BadRequestException('Truy cập bị từ chối. Bạn không có quyền xem CV này.');
    }
  }

  return resume;
}

  async update(id: number, updateResumeDto: UpdateResumeDto, currentUser: any) { // Thêm currentUser
    const resume = await this.resumesRepository.findOne({ where: { id } });
    if (!resume) {
      throw new NotFoundException('Không tìm thấy CV có id ' + id);
    }

    const currentUserId = +(currentUser.id || currentUser.userId || currentUser.sub);
    const isAdmin = currentUser.role === 'admin';
    const isOwner = resume.userId === currentUserId;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('Truy cập bị từ chối. Bạn chỉ được phép cập nhật CV của chính mình.');
    }

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

  async checkEmployerAccess(employerUserId: number, resumeId: number): Promise<boolean> {
    const applications = await this.applicationsRepository.find({
      where: { resumeId: resumeId }
    });

    if (!applications || applications.length === 0) {
      return false; 
    }

    const jobIds = applications.map(app => app.jobId);

    const jobs = await this.jobsRepository.find({
      where: { id: In(jobIds) }
    });

    if (!jobs || jobs.length === 0) {
      return false;
    }

    const companyIds = jobs.map(job => job.companyId);
    const companyMatch = await this.companiesRepository.findOne({
      where: {
        id: In(companyIds),
        ownerId: employerUserId
      }
    });

    return !!companyMatch; 
  }

  async remove(id: number, currentUser: any) {
    const resume = await this.resumesRepository.findOne({ where: { id } });
    if (!resume) {
      throw new NotFoundException(`Không tìm thấy CV có id ${id}`);
    }

    const currentUserId = +(currentUser.id || currentUser.userId || currentUser.sub);
    const isAdmin = currentUser.role === 'admin';
    const isOwner = resume.userId === currentUserId;

    if (!isAdmin && !isOwner) {
      throw new BadRequestException('Truy cập bị từ chối. Bạn chỉ được phép xóa CV của chính mình.');
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

  async getResumeFileStream(id: number, currentUser: any) {
  const resume = await this.findOne(id, currentUser);

  const filePath = join(process.cwd(), 'uploads', resume.fileName);
  if (!fs.existsSync(filePath)) {
    throw new NotFoundException('File không tồn tại trên hệ thống');
  }

  return {
    stream: fs.createReadStream(filePath),
    mimeType: resume.mimeType || 'application/pdf',
    fileName: resume.fileName,
  };
}
}