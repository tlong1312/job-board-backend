import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { RegisterDto } from "./dto/register.dto";
import { LocalAuthGuard } from "commons/guards/local-auth.guard";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @ApiOperation({ summary: "Đăng ký tài khoản" })
  @ApiResponse({
    status: 201,
    description: "Đăng ký thành công, trả về hai token",
  })
  @ApiResponse({ status: 400, description: "Dữ liệu không hợp lệ" })
  @ApiResponse({ status: 409, description: "Email đã được đăng ký" })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @ApiBody({ type: LoginDto })
  @ApiOperation({ summary: "Đăng nhập bằng email và mật khẩu" })
  @ApiResponse({
    status: 200,
    description: "Đăng nhập thành công, trả về hai token",
  })
  @ApiResponse({ status: 401, description: "Sai email hoặc mật khẩu" })
  @ApiResponse({ status: 403, description: "Tài khoản bị khoá" })
  login(@Request() req) {
    return this.authService.login(req.user);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Cấp access token mới từ refresh token" })
  @ApiResponse({ status: 200, description: "Trả về access token mới" })
  @ApiResponse({
    status: 401,
    description: "Refresh token không hợp lệ, bị thu hồi hoặc hết hạn",
  })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Đăng xuất, thu hồi refresh token" })
  @ApiResponse({ status: 200, description: "Đăng xuất thành công" })
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }
}
