import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  Query, 
  ParseIntPipe, 
  UseInterceptors, 
  UploadedFile, 
  BadRequestException 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ApiTags, ApiOperation, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ResumesService } from './resumes.service';
import { CreateResumeDto } from './dto/create-resume.dto';
import { UpdateResumeDto } from './dto/update-resume.dto';
import { Roles } from 'commons/decorators/roles.decorator';
import { Public } from 'commons/decorators/public.decorator';
import { CurrentUser } from 'commons/decorators/current-user.decorator';

@ApiTags('Resumes')
@Controller('resumes')
export class ResumesController {
  constructor(private readonly resumesService: ResumesService) {}

  @Post()
  @Roles('candidate')
  @ApiOperation({ summary: 'Tải CV lên và lưu trực tiếp vào Database' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { 
          type: 'string', 
          format: 'binary', 
          description: 'File CV (PDF/Word)' 
        },
        isDefault: { 
          type: 'boolean', 
          description: 'Đặt làm CV mặc định', 
          example: false 
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, callback) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        const filename = `${file.fieldname}-${uniqueSuffix}${ext}`;
        callback(null, filename);
      },
    }),
    limits: {
      fileSize: 5 * 1024 * 1024,
    },
    fileFilter: (req, file, callback) => {
      const validMimeTypes = [
        'application/pdf', 
        'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      ];
      
      if (validMimeTypes.includes(file.mimetype)) {
        callback(null, true); 
      } else {
        callback(new BadRequestException('Chỉ chấp nhận file PDF hoặc Word (DOC/DOCX)'), false); // Chặn lại
      }
    },
  }))
  async create(
    @CurrentUser("id") userId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() createResumeDto: CreateResumeDto
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng đính kèm file CV cần upload');
    }

    const resumeData = {
      userId: userId,
      isDefault: createResumeDto.isDefault || false,
      fileName: file.filename,
      fileUrl: `/uploads/${file.filename}`, 
      mimeType: file.mimetype,
      fileSize: file.size,
    };

    return this.resumesService.create(resumeData); 
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách CV' })
  @ApiQuery({ name: 'userId', required: false, type: Number, description: 'Lọc CV theo ID ứng viên' })
  findAll(
    @CurrentUser() currentUser: any,
    @Query('userId') queryUserId?: string,
  ) {
    let targetUserId: number | undefined;

    if (currentUser.role === 'admin') { 
      targetUserId = queryUserId ? +queryUserId : undefined;
    } else {
      targetUserId = currentUser.userId;
    }

    return this.resumesService.findAll(targetUserId);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Lấy chi tiết một CV' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.resumesService.findOne(id);
  }

  @Patch(':id')
  @Roles('candidate')
  @ApiOperation({ summary: 'Cập nhật CV' })
  update(
    @Param('id', ParseIntPipe) id: number, 
    @Body() updateResumeDto: UpdateResumeDto
  ) {
    return this.resumesService.update(id, updateResumeDto);
  }

  @Delete(':id')
  @Public()
  @ApiOperation({ summary: 'Xóa CV' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.resumesService.remove(id);
  }
}