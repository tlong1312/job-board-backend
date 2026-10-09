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
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

@ApiTags("Users")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: "Tạo tài khoản người dùng mới" })
  @ApiCreatedResponse({ description: "Người dùng được tạo thành công." })
  @ApiBadRequestResponse({ description: "Dữ liệu đầu vào không hợp lệ." })
  @ApiConflictResponse({ description: "Email này đã được sử dụng." })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @ApiOperation({ summary: "Lấy danh sách người dùng" })
  @ApiOkResponse({ description: "Mảng người dùng" })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Xem một người dùng theo id" })
  @ApiOkResponse({ description: "Thông tin người dùng" })
  @ApiBadRequestResponse({ description: "id không phải số" })
  @ApiNotFoundResponse({ description: "Không tìm thấy người dùng" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Cập nhật thông tin (fullName, phone)" })
  @ApiOkResponse({ description: "Cập nhật thành công" })
  @ApiBadRequestResponse({ description: "Dữ liệu hoặc id không hợp lệ" })
  @ApiNotFoundResponse({ description: "Không tìm thấy người dùng" })
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Vô hiệu hóa người dùng (Soft Delete)" })
  @ApiOkResponse({ description: "Vô hiệu hóa thành công" })
  @ApiBadRequestResponse({ description: "Tài khoản đã bị vô hiệu hoá trước đó" })
  @ApiNotFoundResponse({ description: "Không tìm thấy người dùng" })
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }

  @Delete(":id/delete")
  @ApiOperation({ summary: 'Xóa vĩnh viễn người dùng theo ID' })
  hardRemove(@Param('id') id: string) {
    return this.usersService.hardRemove(+id);
  }
}