import { AuthService } from "./auth.service";
import { BadRequestException } from "commons/error";

describe("AuthService.changePassword", () => {
  const jwt = { signAsync: jest.fn(), verifyAsync: jest.fn() };
  const users = { changePassword: jest.fn() };
  const refreshRepository = { update: jest.fn() };
  let service: AuthService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new AuthService(jwt as never, users as never, refreshRepository as never);
  });

  it("đổi mật khẩu rồi thu hồi mọi refresh token còn hiệu lực của người đó", async () => {
    users.changePassword.mockResolvedValue(undefined);
    const result = await service.changePassword(9, {
      currentPassword: "Cu12345678",
      newPassword: "Moi12345678",
    });

    expect(users.changePassword).toHaveBeenCalledWith(9, "Cu12345678", "Moi12345678");
    expect(refreshRepository.update).toHaveBeenCalledTimes(1);
    const [where, patch] = refreshRepository.update.mock.calls[0];
    expect(where.userId).toBe(9);
    expect(patch.revokedAt).toBeInstanceOf(Date);
    expect(result.message).toContain("Đổi mật khẩu thành công");
  });

  it("sai mật khẩu hiện tại: lỗi nổi lên và không thu hồi token", async () => {
    users.changePassword.mockRejectedValue(new BadRequestException("sai"));
    await expect(
      service.changePassword(9, { currentPassword: "x", newPassword: "y" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(refreshRepository.update).not.toHaveBeenCalled();
  });
});
