import { Controller, Get, Post, Body, Patch, Param, ParseIntPipe, Delete, Query } from '@nestjs/common';
import { ApplicationsService } from "./applications.service";
import { CreateApplicationDto } from "./dto/create-application.dto";
import { UpdateApplicationStatusDto } from "./dto/update-application-status.dto";
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";

@ApiTags("applications")
@Controller("applications")
export class ApplicationsController {
  constructor(
    private readonly applicationsService: ApplicationsService,
  ) {}

  @Post()
  @ApiOperation({
    summary: "Ứng viên nộp hồ sơ vào tin tuyển dụng",
  })
  @ApiCreatedResponse({
    description: "Hồ sơ ứng tuyển được tạo thành công",
  })
  @ApiBadRequestResponse({
    description:
      "Dữ liệu không hợp lệ / tin đã đóng hoặc bị khoá / tin đã hết hạn / người dùng không phải ứng viên / resumeId không tồn tại",
  })
  @ApiNotFoundResponse({
    description:
      "Không tìm thấy tin tuyển dụng hoặc ứng viên",
  })
  @ApiConflictResponse({
    description:
      "Ứng viên đã nộp hồ sơ cho tin tuyển dụng này",
  })
  create(
    @Body()
    createApplicationDto: CreateApplicationDto,
  ) {
    return this.applicationsService.create(
      createApplicationDto,
    );
  }

  @Get()
  @ApiOperation({
    summary: "Lấy danh sách hồ sơ ứng tuyển",
  })
  @ApiQuery({
    name: "jobId",
    required: false,
    type: Number,
    description: "Lọc hồ sơ theo id tin tuyển dụng",
  })
  @ApiQuery({
    name: "candidateId",
    required: false,
    type: Number,
    description: "Lọc hồ sơ theo id ứng viên",
  })
  @ApiOkResponse({
    description: "Mảng hồ sơ ứng tuyển",
  })
  @ApiBadRequestResponse({
    description: "jobId hoặc candidateId không phải số",
  })
  findAll(
    @Query(
      "jobId",
      new ParseIntPipe({ optional: true }),
    )
    jobId?: number,

    @Query(
      "candidateId",
      new ParseIntPipe({ optional: true }),
    )
    candidateId?: number,
  ) {
    return this.applicationsService.findAll(
      jobId,
      candidateId,
    );
  }

  @Get(":id")
  @ApiOperation({
    summary: "Xem một hồ sơ ứng tuyển theo id",
  })
  @ApiParam({
    name: "id",
    type: Number,
    description: "Id hồ sơ ứng tuyển",
  })
  @ApiOkResponse({
    description: "Thông tin hồ sơ ứng tuyển",
  })
  @ApiBadRequestResponse({
    description: "id không phải số",
  })
  @ApiNotFoundResponse({
    description: "Không tìm thấy hồ sơ ứng tuyển",
  })
  findOne(
    @Param("id", ParseIntPipe)
    id: number,
  ) {
    return this.applicationsService.findOne(id);
  }

  @Patch(":id/status")
  @ApiOperation({
    summary: "Cập nhật trạng thái hồ sơ ứng tuyển",
  })
  @ApiParam({
    name: "id",
    type: Number,
    description: "Id hồ sơ ứng tuyển",
  })
  @ApiOkResponse({
    description:
      "Hồ sơ được cập nhật trạng thái và ghi lịch sử thành công",
  })
  @ApiBadRequestResponse({
    description:
      "Dữ liệu không hợp lệ / hồ sơ đã ở trạng thái này / hồ sơ đã bị từ chối / changedBy không tồn tại",
  })
  @ApiNotFoundResponse({
    description: "Không tìm thấy hồ sơ ứng tuyển",
  })
  changeStatus(
    @Param("id", ParseIntPipe)
    id: number,

    @Body()
    updateApplicationStatusDto:
      UpdateApplicationStatusDto,
  ) {
    return this.applicationsService.changeStatus(
      id,
      updateApplicationStatusDto,
    );
  }

  @Get(":id/history")
  @ApiOperation({
    summary: "Xem lịch sử thay đổi trạng thái hồ sơ",
  })
  @ApiParam({
    name: "id",
    type: Number,
    description: "Id hồ sơ ứng tuyển",
  })
  @ApiOkResponse({
    description:
      "Danh sách lịch sử thay đổi trạng thái của hồ sơ",
  })
  @ApiBadRequestResponse({
    description: "id không phải số",
  })
  @ApiNotFoundResponse({
    description: "Không tìm thấy hồ sơ ứng tuyển",
  })
  getHistory(
    @Param("id", ParseIntPipe)
    id: number,
  ) {
    return this.applicationsService.getHistory(id);
  }

  @Delete(":id")
  @ApiOperation({
    summary: "Ứng viên rút hồ sơ ứng tuyển",
  })
  @ApiParam({
    name: "id",
    type: Number,
    description: "Id hồ sơ ứng tuyển",
  })
  @ApiOkResponse({
    description: "Rút hồ sơ thành công",
  })
  @ApiBadRequestResponse({
    description:
      "id không hợp lệ hoặc hồ sơ không còn ở trạng thái mới",
  })
  @ApiNotFoundResponse({
    description: "Không tìm thấy hồ sơ ứng tuyển",
  })
  remove(
    @Param("id", ParseIntPipe)
    id: number,
  ) {
    return this.applicationsService.remove(id);
  }
}