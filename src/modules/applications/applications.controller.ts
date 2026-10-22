import { Controller, Get, Post, Body, Patch, Param, ParseIntPipe, Delete, Query } from '@nestjs/common';
import { ApplicationsService } from "./applications.service";
import { CreateApplicationDto } from "./dto/create-application.dto";
import { UpdateApplicationStatusDto } from "./dto/update-application-status.dto";
import {
  CurrentUser,
  JwtUser,
} from "commons/decorators/current-user.decorator";
import { Roles } from "commons/decorators/roles.decorator";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

@ApiBearerAuth()
@ApiTags("applications")
@Controller("applications")
export class ApplicationsController {
  constructor(
    private readonly applicationsService: ApplicationsService,
  ) {}

  @Post()
  @Roles("candidate")
  @ApiOperation({
    summary: "Ứng viên nộp hồ sơ vào tin tuyển dụng",
  })
  @ApiCreatedResponse({
    description: "Hồ sơ ứng tuyển được tạo thành công",
  })
  @ApiBadRequestResponse({
    description:
      "Dữ liệu không hợp lệ / tin không open / tin đã hết hạn",
  })
  @ApiUnauthorizedResponse({
    description: "Chưa đăng nhập",
  })
  @ApiForbiddenResponse({
    description: "Không phải ứng viên",
  })
  @ApiNotFoundResponse({
    description: "Không tìm thấy tin tuyển dụng",
  })
  @ApiConflictResponse({
    description: "Ứng viên đã nộp tin này rồi",
  })
  create(
    @Body() dto: CreateApplicationDto,
    @CurrentUser("id") candidateId: number,
  ) {
    return this.applicationsService.create(
      dto,
      candidateId,
    );
  }

  @Get()
  @Roles("candidate", "employer", "admin")
  @ApiOperation({
    summary: "Lấy danh sách hồ sơ ứng tuyển",
  })
  @ApiQuery({
    name: "jobId",
    required: false,
    type: Number,
    example: 1,
    description:
      "Employer phải truyền jobId thuộc công ty của mình; admin có thể bỏ qua để xem tất cả",
  })
  @ApiOkResponse({
    description: "Mảng hồ sơ ứng tuyển",
  })
  @ApiUnauthorizedResponse({
    description: "Chưa đăng nhập",
  })
  @ApiForbiddenResponse({
    description:
      "Tin tuyển dụng không thuộc công ty của nhà tuyển dụng",
  })
  findAll(
    @CurrentUser() currentUser: JwtUser,

    @Query(
      "jobId",
      new ParseIntPipe({ optional: true }),
    )
    jobId?: number,
  ) {
    return this.applicationsService.findAll(
      currentUser,
      jobId,
    );
  }

  @Get(":id")
  @Roles("candidate", "employer", "admin")
  @ApiOperation({
    summary: "Xem chi tiết hồ sơ theo quyền của người đăng nhập",
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
    description:
      "id không phải số",
  })
  @ApiUnauthorizedResponse({
    description: "Chưa đăng nhập",
  })
  @ApiForbiddenResponse({
    description: "Hồ sơ không thuộc ứng viên hoặc công ty của nhà tuyển dụng",
  })
  @ApiNotFoundResponse({
    description: "Không tìm thấy hồ sơ",
  })
  findOne(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() currentUser: JwtUser,
  ) {
    return this.applicationsService.findOneForViewer(id, currentUser);
  }

  @Patch(":id/status")
  @Roles("employer")
  @ApiOperation({
    summary: "Nhà tuyển dụng cập nhật trạng thái hồ sơ",
  })
  @ApiParam({
    name: "id",
    type: Number,
    description: "Id hồ sơ ứng tuyển",
  })
  @ApiOkResponse({
    description:
      "Cập nhật trạng thái và ghi lịch sử thành công",
  })
  @ApiBadRequestResponse({
    description:
      "Trạng thái không hợp lệ / trùng trạng thái / hồ sơ đã rejected",
  })
  @ApiUnauthorizedResponse({
    description: "Chưa đăng nhập",
  })
  @ApiForbiddenResponse({
    description: "Không phải chủ tin tuyển dụng",
  })
  @ApiNotFoundResponse({
    description: "Không tìm thấy hồ sơ",
  })
  changeStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateApplicationStatusDto,
    @CurrentUser("id") employerId: number,
  ) {
    return this.applicationsService.changeStatus(
      id,
      dto,
      employerId,
    );
  }

  @Get(":id/history")
  @Roles("candidate", "employer", "admin")
  @ApiOperation({
    summary: "Xem lịch sử thay đổi trạng thái hồ sơ",
  })
  @ApiParam({
    name: "id",
    type: Number,
    example: 1,
    description: "Id hồ sơ ứng tuyển",
  })
  @ApiOkResponse({
    description: "Lịch sử trạng thái hồ sơ",
  })
  @ApiUnauthorizedResponse({
    description: "Chưa đăng nhập",
  })
  @ApiForbiddenResponse({
    description:
      "Không phải chủ hồ sơ hoặc chủ công ty nhận hồ sơ; admin được xem tất cả",
  })
  @ApiNotFoundResponse({
    description: "Không tìm thấy hồ sơ",
  })
  getHistory(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() currentUser: JwtUser,
  ) {
    return this.applicationsService.getHistory(
      id,
      currentUser,
    );
  }

  @Delete(":id")
  @Roles("candidate")
  @ApiOperation({
    summary: "Ứng viên rút hồ sơ của mình",
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
      "Hồ sơ không còn ở trạng thái new",
  })
  @ApiUnauthorizedResponse({
    description: "Chưa đăng nhập",
  })
  @ApiForbiddenResponse({
    description: "Hồ sơ không thuộc ứng viên",
  })
  @ApiNotFoundResponse({
    description: "Không tìm thấy hồ sơ",
  })
  remove(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser("id") candidateId: number,
  ) {
    return this.applicationsService.remove(
      id,
      candidateId,
    );
  }
}
