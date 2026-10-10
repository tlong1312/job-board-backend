import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { JobsService } from "./jobs.service";
import { CreateJobDto } from "./dto/create-job.dto";
import { UpdateJobDto } from "./dto/update-job.dto";
import { QueryJobDto } from "./dto/query-job.dto";

@ApiTags("jobs")
@Controller("jobs")
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @ApiOperation({ summary: "Đăng tin tuyển dụng mới" })
  @ApiCreatedResponse({ description: "Tin tuyển dụng vừa tạo" })
  @ApiBadRequestResponse({
    description:
      "Dữ liệu không hợp lệ / người đăng không phải nhà tuyển dụng / lương tối đa < lương tối thiểu / hạn nộp trước hôm nay / companyId không tồn tại",
  })
  @ApiNotFoundResponse({ description: "Không tìm thấy người đăng (createdBy)" })
  create(@Body() createJobDto: CreateJobDto) {
    return this.jobsService.create(createJobDto);
  }

  @Get()
  @ApiOperation({
    summary: "Lấy danh sách tin tuyển dụng",
  })
  @ApiOkResponse({ description: "Mảng tin tuyển dụng" })
  @ApiBadRequestResponse({ description: "status không hợp lệ" })
  findAll(@Query() query: QueryJobDto) {
    return this.jobsService.findAll(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Xem một tin tuyển dụng theo id" })
  @ApiParam({ name: "id", type: Number, description: "Id tin tuyển dụng" })
  @ApiOkResponse({ description: "Thông tin tin tuyển dụng" })
  @ApiBadRequestResponse({ description: "id không phải số" })
  @ApiNotFoundResponse({ description: "Không tìm thấy việc làm" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.jobsService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Cập nhật tin tuyển dụng" })
  @ApiParam({ name: "id", type: Number, description: "Id tin tuyển dụng" })
  @ApiOkResponse({ description: "Tin tuyển dụng sau khi cập nhật" })
  @ApiBadRequestResponse({
    description:
      "Dữ liệu không hợp lệ / lương tối đa < lương tối thiểu / hạn nộp trước hôm nay",
  })
  @ApiForbiddenResponse({ description: "Tin đã bị quản trị viên khoá" })
  @ApiNotFoundResponse({ description: "Không tìm thấy việc làm" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateJobDto: UpdateJobDto,
  ) {
    return this.jobsService.update(id, updateJobDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Xoá tin tuyển dụng" })
  @ApiParam({ name: "id", type: Number, description: "Id tin tuyển dụng" })
  @ApiOkResponse({ description: "Thông báo đã xoá" })
  @ApiBadRequestResponse({ description: "id không phải số" })
  @ApiNotFoundResponse({ description: "Không tìm thấy việc làm" })
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.jobsService.remove(id);
  }
}
