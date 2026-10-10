import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { User } from "../users/entities/user.entity";
import { JwtService } from "@nestjs/jwt";
import { UsersService } from "../users/users.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { RefreshToken } from "./entities/refresh-token.entity";
import {
  ConflictException,
  ForBiddenException,
  UnAuthorizedException,
} from "commons/error";

describe("AuthService", () => {
  let service: AuthService;

  const mockJwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const mockUsersService = {
    create: jest.fn(),
    findOne: jest.fn(),
  };

  const mockRefreshRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockUser: User = {
    id: 1,
    email: "candidate@jobboard.local",
    fullName: "Nguyễn Văn A",
    role: "candidate",
    isActive: true,
  } as User;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test_access_secret";
    process.env.JWT_REFRESH_SECRET = "test_refresh_secret";

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: UsersService, useValue: mockUsersService },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRefreshRepository,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  // describe("register", () => {
  //   it("nên đăng ký thành công và trả về cặp token", async () => {
  //     mockUsersService.create.mockResolvedValue(mockUser);
  //     mockJwtService.signAsync
  //       .mockResolvedValueOnce("access_token_123")
  //       .mockResolvedValueOnce("refresh_token_123");
  //     mockRefreshRepository.save.mockResolvedValue({});

  //     const result = await service.register({
  //       email: "candidate@jobboard.local",
  //       password: "Password@123",
  //       fullName: "Nguyễn Văn A",
  //     } as any);

  //     expect(result).toEqual({
  //       accessToken: "access_token_123",
  //       refreshToken: "refresh_token_123",
  //       user: {
  //         id: 1,
  //         email: "candidate@jobboard.local",
  //         fullName: "Nguyễn Văn A",
  //         role: "candidate",
  //       },
  //     });
  //     expect(mockRefreshRepository.save).toHaveBeenCalledTimes(1);
  //   });

  //   it("nên ném ConflictException (409) khi email đã được đăng ký", async () => {
  //     mockUsersService.create.mockRejectedValue(
  //       new ConflictException("Email đã được đăng ký"),
  //     );

  //     await expect(
  //       service.register({ email: "candidate@jobboard.local" } as any),
  //     ).rejects.toThrow(ConflictException);
  //   });
  // });

  describe("login", () => {
    it("nên cấp cặp token và lưu bản băm refresh token vào DB", async () => {
      mockJwtService.signAsync
        .mockResolvedValueOnce("access_token_123")
        .mockResolvedValueOnce("refresh_token_123");
      mockRefreshRepository.save.mockResolvedValue({});

      const result = await service.login(mockUser);

      expect(result.accessToken).toBe("access_token_123");
      expect(result.refreshToken).toBe("refresh_token_123");
      expect(mockRefreshRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      );
    });
  });

  describe("refresh", () => {
    it("nên ném UnAuthorizedException khi refresh token sai chữ ký hoặc hết hạn JWT", async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error("Invalid token"));

      await expect(service.refresh("token_bia_dat")).rejects.toThrow(
        UnAuthorizedException,
      );
    });

    it("nên ném UnAuthorizedException khi refresh token đã bị thu hồi (revokedAt khác null)", async () => {
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 1 });
      mockRefreshRepository.findOne.mockResolvedValue({
        tokenHash: "hash",
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 100000),
      });

      await expect(service.refresh("token_da_logout")).rejects.toThrow(
        UnAuthorizedException,
      );
    });

    it("nên ném ForBiddenException khi tài khoản người dùng bị khóa", async () => {
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 1 });
      mockRefreshRepository.findOne.mockResolvedValue({
        tokenHash: "hash",
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      });
      mockUsersService.findOne.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await expect(service.refresh("valid_refresh_token")).rejects.toThrow(
        ForBiddenException,
      );
    });

    it("nên trả về accessToken mới khi refresh token hợp lệ", async () => {
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 1 });
      mockRefreshRepository.findOne.mockResolvedValue({
        tokenHash: "hash",
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      });
      mockUsersService.findOne.mockResolvedValue(mockUser);
      mockJwtService.signAsync.mockResolvedValue("new_access_token");

      const result = await service.refresh("valid_refresh_token");

      expect(result).toEqual({ accessToken: "new_access_token" });
    });
  });

  describe("logout", () => {
    it("nên cập nhật revokedAt và luôn trả về thông báo đăng xuất thành công", async () => {
      mockRefreshRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.logout("some_refresh_token");

      expect(mockRefreshRepository.update).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ message: "Đăng xuất thành công" });
    });
  });
});
