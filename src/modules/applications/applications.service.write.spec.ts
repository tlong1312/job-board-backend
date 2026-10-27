import { ApplicationsService } from "./applications.service";
import { ApplicationEntity } from "./entities/application.entity";
import { ApplicationStatusHistory } from "./entities/application-status-history.entity";
import {
  BadRequestException,
  ConflictException,
  ForBiddenException,
} from "commons/error";

describe("ApplicationsService (ghi dữ liệu)", () => {
  const applications = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const history = { find: jest.fn() };
  const resumes = { findOne: jest.fn() };
  const jobs = { findOne: jest.fn() };
  const companies = { findOne: jest.fn() };
  const mailProducer = { enqueueStatusChanged: jest.fn() };
  const manager = { save: jest.fn(), create: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  let service: ApplicationsService;

  const openJob = { id: 20, status: "open", deadline: null, createdBy: 2, companyId: 60 };

  beforeEach(() => {
    jest.resetAllMocks();
    applications.create.mockImplementation((x) => x);
    applications.save.mockImplementation(async (x) => ({ id: 100, ...x }));
    dataSource.transaction.mockImplementation(async (cb) => cb(manager));
    service = new ApplicationsService(
      applications as never,
      history as never,
      resumes as never,
      jobs as never,
      dataSource as never,
      companies as never,
      mailProducer as never,
    );
  });

  describe("create", () => {
    const dto = { jobId: 20, coverLetter: "Chào anh/chị" } as never;

    it("ném 400 khi tin không còn open", async () => {
      jobs.findOne.mockResolvedValue({ ...openJob, status: "closed" });
      await expect(service.create(dto, 30)).rejects.toBeInstanceOf(BadRequestException);
      expect(applications.save).not.toHaveBeenCalled();
    });

    it("ném 400 khi tin đã quá hạn nộp", async () => {
      jobs.findOne.mockResolvedValue({ ...openJob, deadline: "2000-01-01" });
      await expect(service.create(dto, 30)).rejects.toBeInstanceOf(BadRequestException);
    });

    it("ném 409 khi ứng viên đã nộp tin này", async () => {
      jobs.findOne.mockResolvedValue(openJob);
      applications.findOne.mockResolvedValue({ id: 1 });
      await expect(service.create(dto, 30)).rejects.toBeInstanceOf(ConflictException);
    });

    it("ném 403 khi CV không thuộc về ứng viên", async () => {
      jobs.findOne.mockResolvedValue(openJob);
      resumes.findOne.mockResolvedValue(null);
      await expect(
        service.create({ jobId: 20, resumeId: 5 } as never, 30),
      ).rejects.toBeInstanceOf(ForBiddenException);
      expect(resumes.findOne).toHaveBeenCalledWith({ where: { id: 5, userId: 30 } });
      expect(applications.save).not.toHaveBeenCalled();
    });

    it("nộp thành công: trạng thái new, người nộp lấy từ token", async () => {
      jobs.findOne.mockResolvedValue(openJob);
      applications.findOne.mockResolvedValue(null);
      resumes.findOne.mockResolvedValue({ id: 5, userId: 30 });
      const saved = await service.create(
        { jobId: 20, resumeId: 5, coverLetter: "Chào" } as never,
        30,
      );
      expect(applications.create).toHaveBeenCalledWith({
        jobId: 20,
        candidateId: 30,
        resumeId: 5,
        coverLetter: "Chào",
        status: "new",
      });
      expect(saved.id).toBe(100);
    });

    it("không đính kèm CV thì không kiểm tra CV, resumeId = null", async () => {
      jobs.findOne.mockResolvedValue(openJob);
      applications.findOne.mockResolvedValue(null);
      await service.create({ jobId: 20 } as never, 30);
      expect(resumes.findOne).not.toHaveBeenCalled();
      expect(applications.create).toHaveBeenCalledWith(
        expect.objectContaining({ resumeId: null, coverLetter: null }),
      );
    });

    it("tin hạn nộp là hôm nay vẫn nộp được", async () => {
      const now = new Date();
      const today = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
      ].join("-");
      jobs.findOne.mockResolvedValue({ ...openJob, deadline: today });
      applications.findOne.mockResolvedValue(null);
      await expect(service.create({ jobId: 20 } as never, 30)).resolves.toBeDefined();
    });
  });

  describe("changeStatus", () => {
    const application = () => ({ id: 10, jobId: 20, candidateId: 30, status: "new" });

    beforeEach(() => {
      jobs.findOne.mockResolvedValue(openJob);
      manager.create.mockImplementation((_entity, x) => x);
      manager.save.mockImplementation(async (entity, x) =>
        entity === ApplicationStatusHistory ? { ...x, id: 77 } : x,
      );
    });

    it("ném 403 khi không phải chủ tin", async () => {
      applications.findOne.mockResolvedValue(application());
      await expect(
        service.changeStatus(10, { status: "viewed" } as never, 999),
      ).rejects.toBeInstanceOf(ForBiddenException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it("ném 400 khi hồ sơ đã ở trạng thái đó", async () => {
      applications.findOne.mockResolvedValue(application());
      await expect(
        service.changeStatus(10, { status: "new" } as never, 2),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("ném 400 khi hồ sơ đã bị từ chối", async () => {
      applications.findOne.mockResolvedValue({ ...application(), status: "rejected" });
      await expect(
        service.changeStatus(10, { status: "viewed" } as never, 2),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("đổi trạng thái, ghi lịch sử trong cùng giao dịch rồi mới đưa mail vào hàng đợi", async () => {
      applications.findOne.mockResolvedValue(application());
      const result = await service.changeStatus(
        10,
        { status: "interview", note: "Thứ Hai 9h" } as never,
        2,
      );

      expect(result.status).toBe("interview");
      expect(manager.save).toHaveBeenCalledWith(
        ApplicationEntity,
        expect.objectContaining({ status: "interview" }),
      );
      expect(manager.create).toHaveBeenCalledWith(
        ApplicationStatusHistory,
        expect.objectContaining({
          applicationId: 10,
          fromStatus: "new",
          toStatus: "interview",
          changedBy: 2,
          note: "Thứ Hai 9h",
        }),
      );
      expect(mailProducer.enqueueStatusChanged).toHaveBeenCalledWith({
        applicationId: 10,
        historyId: 77,
      });
    });

    it("giao dịch lỗi thì không gửi mail", async () => {
      applications.findOne.mockResolvedValue(application());
      dataSource.transaction.mockRejectedValue(new Error("DB lỗi"));
      await expect(
        service.changeStatus(10, { status: "viewed" } as never, 2),
      ).rejects.toThrow("DB lỗi");
      expect(mailProducer.enqueueStatusChanged).not.toHaveBeenCalled();
    });
  });

  describe("remove (rút hồ sơ)", () => {
    it("ném 403 khi không phải hồ sơ của mình", async () => {
      applications.findOne.mockResolvedValue({ id: 10, candidateId: 30, status: "new" });
      await expect(service.remove(10, 31)).rejects.toBeInstanceOf(ForBiddenException);
    });

    it("ném 400 khi hồ sơ không còn ở trạng thái new", async () => {
      applications.findOne.mockResolvedValue({ id: 10, candidateId: 30, status: "viewed" });
      await expect(service.remove(10, 30)).rejects.toBeInstanceOf(BadRequestException);
      expect(applications.remove).not.toHaveBeenCalled();
    });

    it("rút thành công khi còn ở trạng thái new", async () => {
      const app = { id: 10, candidateId: 30, status: "new" };
      applications.findOne.mockResolvedValue(app);
      await expect(service.remove(10, 30)).resolves.toEqual({ message: "Rút hồ sơ thành công" });
      expect(applications.remove).toHaveBeenCalledWith(app);
    });
  });
});
