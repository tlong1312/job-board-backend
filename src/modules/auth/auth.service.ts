import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UsersService } from "../users/users.service";
import { InjectRepository } from "@nestjs/typeorm";
import { RefreshToken } from "./entities/refresh-token.entity";
import { IsNull, Repository } from "typeorm";
import { User } from "../users/entities/user.entity";
import { ForBiddenException, UnAuthorizedException } from "commons/error";
import * as crypto from "crypto";
import { RegisterDto } from "./dto/register.dto";

const ACCESS_TTL = "15m";
const REFRESH_TTL = "7d";
const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UsersService,
    @InjectRepository(RefreshToken)
    private readonly refreshRepository: Repository<RefreshToken>,
  ) {}

  // async register(dto: RegisterDto) {
  //   const user = await this.userService.create(dto);
  //   return this.issueTokens(user);
  // }

  login(user: User) {
    return this.issueTokens(user);
  }

  private secret(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error("Thiếu biến môi trường " + name);
    return value;
  }

  private sha256(value: string) {
    return crypto.createHash("sha256").update(value).digest("hex");
  }

  private signAccessToken(user: User) {
    return this.jwtService.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      { secret: this.secret("JWT_ACCESS_SECRET"), expiresIn: ACCESS_TTL },
    );
  }

  async refresh(refreshToken: string) {
    const payload = await this.jwtService
      .verifyAsync(refreshToken, { secret: this.secret("JWT_REFRESH_SECRET") })
      .catch(() => null);
    if (!payload) {
      throw new UnAuthorizedException("Refresh token không hợp lệ");
    }

    const record = await this.refreshRepository.findOne({
      where: { tokenHash: this.sha256(refreshToken) },
    });

    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnAuthorizedException(
        "Refresh token đã bị thu hồi hoặc hết hạn",
      );
    }

    const user = await this.userService.findOne(payload.sub);
    if (!user.isActive) {
      throw new ForBiddenException("Tài khoản đã bị khóa");
    }
    return { accessToken: await this.signAccessToken(user) };
  }

  async logout(refreshToken: string) {
    await this.refreshRepository.update(
      { tokenHash: this.sha256(refreshToken), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );

    return { message: "Đăng xuất thành công" };
  }

  private async issueTokens(user: User) {
    const accessToken = await this.signAccessToken(user);
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, jti: crypto.randomUUID() },
      { secret: this.secret("JWT_REFRESH_SECRET"), expiresIn: REFRESH_TTL },
    );
    await this.refreshRepository.save({
      userId: user.id,
      tokenHash: this.sha256(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_MS),
    });
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }
}
