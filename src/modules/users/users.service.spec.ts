import { ForbiddenException } from "@nestjs/common";
import { UsersService } from "./users.service";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "commons/error";

// Không cần bcrypt thật (chậm, native): giả lập băm và so sánh
jest.mock("bcrypt", () => ({
  hash: async (plain: string) => `hashed:${plain}`,
  compare: async (plain: string, hash: string) => hash === `hashed:${plain}`,
}));

describe("UsersService", () => {
  let service: UsersService;
  const qb = {
    addSelect: jest.fn(),
    where: jest.fn(),
    getOne: jest.fn(),
  };
  const repository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const admin = { id: 1, role: "admin" };
  const me = { id: 5, role: "candidate" };

  beforeEach(() => {
    jest.resetAllMocks();
    qb.addSelect.mockReturnValue(qb);
    qb.where.mockReturnValue(qb);
    repository.createQueryBuilder.mockReturnValue(qb);
    repository.save.mockImplementation(async (u) => u);
    service = new UsersService(repository as never);
  });

  describe("create", () => {
    it("chuẩn hoá email, băm mật khẩu và không trả passwordHash", async () => {
      repository.findOne.mockResolvedValue(null);
      repository.create.mockImplementation((x) => ({ id: 7, ...x }));

      const result = await service.create({
        email: "  A@Example.COM ",
        password: "Matkhau123",
        fullName: "An",
      } as never);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { email: "a@example.com" },
      });
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "a@example.com",
          passwordHash: "hashed:Matkhau123",
          fullName: "An",
        }),
      );
      expect(result).toEqual(expect.objectContaining({ id: 7, email: "a@example.com" }));
      expect(result).not.toHaveProperty("passwordHash");
      expect(result).not.toHaveProperty("password");
    });

    it("ném 409 khi email đã tồn tại", async () => {
      repository.findOne.mockResolvedValue({ id: 1 });
      await expect(
        service.create({ email: "a@b.com", password: "x", fullName: "An" } as never),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe("findOne / findByEmail / findAll", () => {
    it("ném 404 khi không tìm thấy", async () => {
      repository.findOne.mockResolvedValue(null);
      await expect(service.findOne(99)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("không chọn cột passwordHash", async () => {
      repository.findOne.mockResolvedValue({ id: 1 });
      await service.findOne(1);
      const arg = repository.findOne.mock.calls[0][0];
      expect(arg.where).toEqual({ id: 1 });
      expect(arg.select.passwordHash).toBeUndefined();
      expect(arg.select.email).toBe(true);
    });

    it("findByEmail chuẩn hoá email trước khi tìm", async () => {
      repository.findOne.mockResolvedValue(null);
      await service.findByEmail("  X@Y.com ");
      expect(repository.findOne).toHaveBeenCalledWith({ where: { email: "x@y.com" } });
    });

    it("findAll sắp xếp theo id tăng dần", async () => {
      repository.find.mockResolvedValue([]);
      await service.findAll();
      expect(repository.find.mock.calls[0][0].order).toEqual({ id: "ASC" });
    });
  });

  describe("update", () => {
    it("người thường không sửa được tài khoản người khác", async () => {
      await expect(service.update(6, { fullName: "X" }, me)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it("tự sửa fullName và phone của mình", async () => {
      repository.findOne.mockResolvedValue({ id: 5, fullName: "Cũ", phone: null });
      const result = await service.update(5, { fullName: "Mới", phone: "0901234567" }, me);
      expect(result).toEqual(
        expect.objectContaining({ fullName: "Mới", phone: "0901234567" }),
      );
    });

    it("admin sửa được người khác", async () => {
      repository.findOne.mockResolvedValue({ id: 6, fullName: "Cũ", phone: null });
      await expect(service.update(6, { fullName: "Mới" }, admin)).resolves.toEqual(
        expect.objectContaining({ fullName: "Mới" }),
      );
    });
  });

  describe("remove (khoá tài khoản)", () => {
    it("người thường không khoá người khác", async () => {
      await expect(service.remove(6, me)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("ném 400 khi tài khoản đã bị khoá", async () => {
      repository.findOne.mockResolvedValue({ id: 5, isActive: false });
      await expect(service.remove(5, me)).rejects.toBeInstanceOf(BadRequestException);
    });

    it("đặt isActive = false", async () => {
      repository.findOne.mockResolvedValue({ id: 5, isActive: true });
      const result = await service.remove(5, me);
      expect(result.isActive).toBe(false);
    });
  });

  describe("unlock", () => {
    it("ném 400 khi tài khoản đang hoạt động", async () => {
      repository.findOne.mockResolvedValue({ id: 5, isActive: true });
      await expect(service.unlock(5)).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it("đặt isActive = true cho tài khoản đang bị khoá", async () => {
      repository.findOne.mockResolvedValue({ id: 5, isActive: false });
      const result = await service.unlock(5);
      expect(result.isActive).toBe(true);
    });

    it("ném 404 khi không có người dùng", async () => {
      repository.findOne.mockResolvedValue(null);
      await expect(service.unlock(5)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("changePassword", () => {
    it("ném 404 khi không có người dùng", async () => {
      qb.getOne.mockResolvedValue(null);
      await expect(service.changePassword(5, "a", "b")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("ném 400 khi mật khẩu hiện tại sai", async () => {
      qb.getOne.mockResolvedValue({ id: 5, passwordHash: "hashed:Dung12345" });
      await expect(
        service.changePassword(5, "Sai12345", "Moi12345"),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it("ném 400 khi mật khẩu mới trùng mật khẩu cũ", async () => {
      qb.getOne.mockResolvedValue({ id: 5, passwordHash: "hashed:Dung12345" });
      await expect(
        service.changePassword(5, "Dung12345", "Dung12345"),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("băm mật khẩu mới và lưu", async () => {
      qb.getOne.mockResolvedValue({ id: 5, passwordHash: "hashed:Dung12345" });
      await service.changePassword(5, "Dung12345", "Moi12345");
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 5, passwordHash: "hashed:Moi12345" }),
      );
    });
  });

  describe("hardRemove", () => {
    it("xoá người dùng sau khi xác nhận tồn tại", async () => {
      repository.findOne.mockResolvedValue({ id: 5 });
      const result = await service.hardRemove(5);
      expect(repository.delete).toHaveBeenCalledWith(5);
      expect(result.statusCode).toBe(200);
    });
  });
});
