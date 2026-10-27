import { ResumesService } from "./resumes.service";
import { Resume } from "./entities/resume.entity";
import {
  BadRequestException,
  ForBiddenException,
  NotFoundException,
} from "commons/error";

describe("ResumesService", () => {
  const resumes = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
  };
  const applications = { find: jest.fn() };
  const jobs = { find: jest.fn() };
  const companies = { findOne: jest.fn() };
  const users = { findOne: jest.fn() };
  const manager = { update: jest.fn(), create: jest.fn(), save: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  let service: ResumesService;

  const resume = { id: 1, userId: 30, fileName: "khong-ton-tai-xyz.pdf", mimeType: null };
  const owner = { id: 30, role: "candidate" };
  const stranger = { id: 31, role: "candidate" };
  const admin = { id: 1, role: "admin" };

  beforeEach(() => {
    jest.resetAllMocks();
    // ResumesService(resumes, applications, jobs, companies, users, dataSource)
    service = new ResumesService(
      resumes as never,
      applications as never,
      jobs as never,
      companies as never,
      users as never,
      dataSource as never,
    );
    resumes.findOne.mockResolvedValue(resume);
    applications.find.mockResolvedValue([]);
    dataSource.transaction.mockImplementation(async (cb) => cb(manager));
  });

  describe("create", () => {
    it("chỉ ứng viên mới được tải CV", async () => {
      users.findOne.mockResolvedValue({ id: 2, role: "employer" });
      await expect(service.create({ userId: 2 } as never)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("tải CV thường: tạo và lưu", async () => {
      users.findOne.mockResolvedValue({ id: 30, role: "candidate" });
      resumes.create.mockReturnValue(resume);
      resumes.save.mockResolvedValue(resume);
      await expect(service.create({ userId: 30 } as never)).resolves.toBe(resume);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it("đặt làm CV mặc định: bỏ mặc định của các CV cũ trong cùng giao dịch", async () => {
      users.findOne.mockResolvedValue({ id: 30, role: "candidate" });
      manager.create.mockReturnValue(resume);
      manager.save.mockResolvedValue(resume);
      await service.create({ userId: 30, isDefault: true } as never);
      expect(manager.update).toHaveBeenCalledWith(Resume, { userId: 30 }, { isDefault: false });
      expect(manager.save).toHaveBeenCalledWith(resume);
    });
  });

  describe("findOne (kiểm tra quyền xem CV)", () => {
    it("ném 404 khi không có CV", async () => {
      resumes.findOne.mockResolvedValue(null);
      await expect(service.findOne(9, owner)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("không truyền người xem thì trả CV (dùng nội bộ)", async () => {
      await expect(service.findOne(1)).resolves.toBe(resume);
    });

    it("chủ CV và admin xem được", async () => {
      await expect(service.findOne(1, owner)).resolves.toBe(resume);
      await expect(service.findOne(1, admin)).resolves.toBe(resume);
    });

    it("nhà tuyển dụng xem được CV của người đã nộp vào công ty mình", async () => {
      applications.find.mockResolvedValue([{ jobId: 7 }]);
      jobs.find.mockResolvedValue([{ id: 7, companyId: 3 }]);
      companies.findOne.mockResolvedValue({ id: 3, ownerId: 2 });
      await expect(service.findOne(1, { id: 2, role: "employer" })).resolves.toBe(resume);
    });

    it("người lạ bị từ chối với 403", async () => {
      await expect(service.findOne(1, stranger)).rejects.toBeInstanceOf(ForBiddenException);
    });

    it("nhà tuyển dụng của công ty khác bị từ chối", async () => {
      applications.find.mockResolvedValue([{ jobId: 7 }]);
      jobs.find.mockResolvedValue([{ id: 7, companyId: 3 }]);
      companies.findOne.mockResolvedValue(null);
      await expect(service.findOne(1, { id: 99, role: "employer" })).rejects.toBeInstanceOf(
        ForBiddenException,
      );
    });
  });

  describe("remove", () => {
    it("người lạ không xoá được CV của người khác (403)", async () => {
      await expect(service.remove(1, stranger)).rejects.toBeInstanceOf(ForBiddenException);
      expect(resumes.delete).not.toHaveBeenCalled();
    });

    it("ném 404 khi không có CV", async () => {
      resumes.findOne.mockResolvedValue(null);
      await expect(service.remove(1, owner)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("chủ CV xoá được", async () => {
      const result = await service.remove(1, owner);
      expect(resumes.delete).toHaveBeenCalledWith(1);
      expect(result.statusCode).toBe(200);
    });

    it("admin xoá được CV của người khác", async () => {
      await service.remove(1, admin);
      expect(resumes.delete).toHaveBeenCalledWith(1);
    });
  });

  describe("getResumeFileStream", () => {
    it("ném 404 khi file không còn trên đĩa", async () => {
      await expect(service.getResumeFileStream(1, owner)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("người lạ bị từ chối trước khi đụng tới file", async () => {
      await expect(service.getResumeFileStream(1, stranger)).rejects.toBeInstanceOf(
        ForBiddenException,
      );
    });
  });
});
