import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Public } from "commons/decorators/public.decorator";
import { Roles } from "commons/decorators/roles.decorator";
import { CurrentUser } from "commons/decorators/current-user.decorator";
@ApiBearerAuth()
@ApiTags("Users")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Public()
  @ApiOperation({ summary: "Tạo tài khoản người dùng mới" })
  @ApiCreatedResponse({ description: "Người dùng được tạo thành công." })
  @ApiBadRequestResponse({ description: "Dữ liệu đầu vào không hợp lệ." })
  @ApiConflictResponse({ description: "Email này đã được sử dụng." })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles("admin")
  @ApiOperation({ summary: "Lấy danh sách người dùng" })
  @ApiOkResponse({ description: "Mảng người dùng" })
  findAll() {
    return this.usersService.findAll();
  }

  @Get('me')
  @ApiOperation({ summary: 'Lấy thông tin tài khoản đang đăng nhập' })
  async getMe(@CurrentUser() currentUser: any) {
    const id = +(currentUser.id || currentUser.userId || currentUser.sub);
    return this.usersService.findOne(id);
  }  

  @Get(":id")
  @Roles("admin")
  @ApiOperation({ summary: "Xem một người dùng theo id" })
  @ApiOkResponse({ description: "Thông tin người dùng" })
  @ApiBadRequestResponse({ description: "id không phải số" })
  @ApiNotFoundResponse({ description: "Không tìm thấy người dùng" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Patch(":id")
  @Roles("admin", "candidate", "employer")
  @ApiOperation({ summary: "Cập nhật thông tin (fullName, phone)" })
  @ApiOkResponse({ description: "Cập nhật thành công" })
  @ApiBadRequestResponse({ description: "Dữ liệu hoặc id không hợp lệ" })
  @ApiNotFoundResponse({ description: "Không tìm thấy người dùng" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.usersService.update(id, updateUserDto, currentUser);
  }

  @Patch("/lock/:id")
  @Roles("admin", "candidate", "employer")
  @ApiOperation({ summary: "Khóa người dùng theo ID" })
  @ApiOkResponse({ description: "Vô hiệu hóa thành công" })
  @ApiBadRequestResponse({
    description: "Tài khoản đã bị vô hiệu hoá trước đó",
  })
  @ApiNotFoundResponse({ description: "Không tìm thấy người dùng" })
  remove(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() currentUser: any,
  ) {
    return this.usersService.remove(id, currentUser);
  }

  @Delete(":id")
  @Roles("admin")
  @ApiOperation({ summary: "Xóa vĩnh viễn người dùng theo ID" })
  hardRemove(@Param("id", ParseIntPipe) id: number) {
    return this.usersService.hardRemove(id);
  }
}
