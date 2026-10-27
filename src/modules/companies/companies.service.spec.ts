import { CompaniesService } from "./companies.service";
import {
  BadRequestException,
  ConflictException,
  ForBiddenException,
  NotFoundException,
} from "commons/error";
import type { JwtUser } from "commons/decorators/current-user.decorator";

describe("CompaniesService", () => {
  let service: CompaniesService;
  const repository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const users = { findOne: jest.fn() };
  const redis = { invalidatePublicCache: jest.fn() };

  const owner: JwtUser = { id: 2, role: "employer" };
  const stranger: JwtUser = { id: 3, role: "employer" };
  const admin: JwtUser = { id: 1, role: "admin" };
  const company = { id: 10, ownerId: 2, name: "ACME" };

  beforeEach(() => {
    jest.resetAllMocks();
    service = new CompaniesService(repository as never, users as never, redis as never);
  });

  describe("create", () => {
    const dto = { ownerId: 2, name: "ACME" } as never;

    it("chỉ employer mới được tạo công ty", async () => {
      users.findOne.mockResolvedValue({ id: 2, role: "candidate" });
      await expect(service.create(dto)).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it("ném 409 khi đã có công ty cùng tên của chủ này", async () => {
      users.findOne.mockResolvedValue({ id: 2, role: "employer" });
      repository.findOne.mockResolvedValue(company);
      await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
    });

    it("tạo thành công", async () => {
      users.findOne.mockResolvedValue({ id: 2, role: "employer" });
      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(company);
      repository.save.mockResolvedValue(company);
      await expect(service.create(dto)).resolves.toEqual(company);
      expect(repository.save).toHaveBeenCalledWith(company);
    });
  });

  describe("đọc dữ liệu", () => {
    it("findAll không nạp quan hệ owner (tránh lộ email/số điện thoại chủ công ty)", async () => {
      repository.find.mockResolvedValue([company]);
      await service.findAll();
      const arg = repository.find.mock.calls[0]?.[0];
      expect(arg?.relations).toBeUndefined();
    });

    it("findOne ném 404 khi không có", async () => {
      repository.findOne.mockResolvedValue(null);
      await expect(service.findOne(10)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("findOne không nạp quan hệ owner", async () => {
      repository.findOne.mockResolvedValue(company);
      await service.findOne(10);
      expect(repository.findOne.mock.calls[0][0].relations).toBeUndefined();
    });

    it("findByOwnerId ném 404 khi chủ chưa có công ty nào", async () => {
      users.findOne.mockResolvedValue({ id: 2 });
      repository.find.mockResolvedValue([]);
      await expect(service.findByOwnerId(2)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("findByOwnerId trả danh sách công ty của chủ", async () => {
      users.findOne.mockResolvedValue({ id: 2 });
      repository.find.mockResolvedValue([company]);
      await expect(service.findByOwnerId(2)).resolves.toEqual([company]);
    });
  });

  describe("update", () => {
    it("ném 403 khi không phải chủ và không phải admin", async () => {
      repository.findOne.mockResolvedValue(company);
      await expect(service.update(10, { name: "X" }, stranger)).rejects.toBeInstanceOf(
        ForBiddenException,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it("ném 409 khi đổi sang tên trùng công ty khác của cùng chủ", async () => {
      repository.findOne
        .mockResolvedValueOnce(company)
        .mockResolvedValueOnce({ id: 11, ownerId: 2, name: "Khác" });
      await expect(service.update(10, { name: "Khác" }, owner)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it("chủ sửa thành công và xoá cache công khai", async () => {
      repository.findOne
        .mockResolvedValueOnce(company) // kiểm tra quyền
        .mockResolvedValueOnce(null) // kiểm tra trùng tên
        .mockResolvedValueOnce({ ...company, name: "Mới" }); // đọc lại sau khi sửa
      const result = await service.update(10, { name: "Mới" }, owner);
      expect(repository.update).toHaveBeenCalledWith(10, { name: "Mới" });
      expect(redis.invalidatePublicCache).toHaveBeenCalledTimes(1);
      expect(result.name).toBe("Mới");
    });

    it("admin sửa được công ty của người khác", async () => {
      repository.findOne.mockResolvedValue(company);
      await service.update(10, { description: "mô tả" }, admin);
      expect(repository.update).toHaveBeenCalledWith(10, { description: "mô tả" });
    });
  });

  describe("remove", () => {
    it("ném 403 khi không phải chủ và không phải admin", async () => {
      repository.findOne.mockResolvedValue(company);
      await expect(service.remove(10, stranger)).rejects.toBeInstanceOf(ForBiddenException);
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it("chủ xoá thành công và xoá cache", async () => {
      repository.findOne.mockResolvedValue(company);
      const result = await service.remove(10, owner);
      expect(repository.delete).toHaveBeenCalledWith(10);
      expect(redis.invalidatePublicCache).toHaveBeenCalledTimes(1);
      expect(result.statusCode).toBe(200);
    });

    it("vẫn chạy khi không có Redis", async () => {
      const noRedis = new CompaniesService(repository as never, users as never);
      repository.findOne.mockResolvedValue(company);
      await expect(noRedis.remove(10, admin)).resolves.toEqual(
        expect.objectContaining({ statusCode: 200 }),
      );
    });
  });
});
