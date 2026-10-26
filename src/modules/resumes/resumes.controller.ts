import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  Query,
  Res, 
  StreamableFile,
  ParseIntPipe, 
  UseInterceptors, 
  UploadedFile,
} from '@nestjs/common';
import { BadRequestException } from 'commons/error';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname} from 'path';
import { Response } from 'express'; 
import { ApiTags, ApiOperation, ApiQuery, ApiConsumes, ApiBody, ApiProduces } from '@nestjs/swagger';import { ResumesService } from './resumes.service';
import { CreateResumeDto } from './dto/create-resume.dto';
import { UpdateResumeDto } from './dto/update-resume.dto';
import { Roles } from 'commons/decorators/roles.decorator';
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
        callback(new BadRequestException('Chỉ chấp nhận file PDF hoặc Word (DOC/DOCX)'), false); 
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
      targetUserId = currentUser.id || currentUser.userId;
    }

    return this.resumesService.findAll(targetUserId);
  }

  @Get('users/me')
  @ApiOperation({ summary: 'Lấy danh sách CV của tài khoản đang đăng nhập' })
  findMyResumes(@CurrentUser() currentUser: any) {
    const id = currentUser.id || currentUser.sub;
    return this.resumesService.findAll(+id);
  }

  @Get(':id/file')
  @ApiOperation({ summary: 'Xem trực tiếp file CV (Inline)' })
  @ApiProduces('application/pdf', 'application/msword', 'application/octet-stream')
  async getResumeFile(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: any,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const fileData = await this.resumesService.getResumeFileStream(id, currentUser);

    res.set({
      'Content-Type': fileData.mimeType, 
      'Content-Disposition': `inline; filename="${fileData.fileName}"`, 
    });
  return new StreamableFile(fileData.stream);
}

  @Patch(':id')
  @Roles('candidate', 'admin')
  @ApiOperation({ summary: 'Cập nhật CV' })
  update(
    @Param('id', ParseIntPipe) id: number, 
    @Body() updateResumeDto: UpdateResumeDto,
    @CurrentUser() currentUser: any 
  ) {
    return this.resumesService.update(id, updateResumeDto, currentUser); 
  }

  @Delete(':id')
  @Roles('candidate', 'admin')
  @ApiOperation({ summary: 'Xóa CV' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: any
  ) {
    return this.resumesService.remove(id, currentUser);
  }
}