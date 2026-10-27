import { JobsService } from "./jobs.service";
import type { JwtUser } from "commons/decorators/current-user.decorator";

describe("JobsService (cache Redis và lọc tin hết hạn)", () => {
  const qb = {
    leftJoinAndSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    skip: jest.fn(),
    take: jest.fn(),
    getManyAndCount: jest.fn(),
  };
  const jobsRepository = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    merge: jest.fn(),
    remove: jest.fn(),
  };
  const applicationsRepository = { count: jest.fn() };
  const companies = { findOne: jest.fn() };
  const skills = { findByIds: jest.fn() };
  const redis = { remember: jest.fn(), invalidatePublicCache: jest.fn() };

  const employer: JwtUser = { id: 2, role: "employer" };
  const admin: JwtUser = { id: 1, role: "admin" };
  const candidate: JwtUser = { id: 9, role: "candidate" };
  const job = { id: 5, status: "open", createdBy: 2, companyId: 1, salaryMin: null, salaryMax: null };

  let service: JobsService;

  beforeEach(() => {
    jest.resetAllMocks();
    for (const m of [
      qb.leftJoinAndSelect,
      qb.where,
      qb.andWhere,
      qb.orderBy,
      qb.addOrderBy,
      qb.skip,
      qb.take,
    ]) {
      m.mockReturnValue(qb);
    }
    qb.getManyAndCount.mockResolvedValue([[job], 1]);
    jobsRepository.createQueryBuilder.mockReturnValue(qb);
    jobsRepository.findOne.mockResolvedValue({ ...job });
    jobsRepository.save.mockImplementation(async (x) => x);
    jobsRepository.create.mockImplementation((x) => x);
    jobsRepository.merge.mockImplementation((target, src) => Object.assign(target, src));
    applicationsRepository.count.mockResolvedValue(0);
    skills.findByIds.mockResolvedValue([]);
    companies.findOne.mockResolvedValue({ id: 1, ownerId: 2 });
    redis.remember.mockImplementation((_k, _ttl, loader) => loader());
    service = new JobsService(
      jobsRepository as never,
      applicationsRepository as never,
      companies as never,
      skills as never,
      redis as never,
    );
  });

  const conditions = () => qb.andWhere.mock.calls.map((c) => String(c[0]));

  describe("danh sách tin", () => {
    it("khách và ứng viên đi qua cache", async () => {
      await service.findAll({ page: 1 } as never, undefined);
      await service.findAll({ page: 1 } as never, candidate);
      expect(redis.remember).toHaveBeenCalledTimes(2);
      expect(redis.remember.mock.calls[0][0]).toContain("jobs:list:");
      expect(redis.remember.mock.calls[0][1]).toBe(60);
    });

    it("hai truy vấn khác nhau dùng hai khoá cache khác nhau", async () => {
      await service.findAll({ page: 1 } as never);
      await service.findAll({ page: 2 } as never);
      expect(redis.remember.mock.calls[0][0]).not.toBe(redis.remember.mock.calls[1][0]);
    });

    it("thứ tự thuộc tính trong query không làm đổi khoá cache", async () => {
      await service.findAll({ page: 1, level: "junior" } as never);
      await service.findAll({ level: "junior", page: 1 } as never);
      expect(redis.remember.mock.calls[0][0]).toBe(redis.remember.mock.calls[1][0]);
    });

    it("employer và admin không dùng cache (thấy cả tin đóng/khoá)", async () => {
      await service.findAll({ page: 1 } as never, employer);
      await service.findAll({ page: 1 } as never, admin);
      expect(redis.remember).not.toHaveBeenCalled();
    });

    it("khách/ứng viên bị loại các tin đã quá hạn nộp", async () => {
      await service.findAll({ page: 1 } as never, undefined);
      expect(conditions().some((c) => c.includes("deadline") && c.includes("CURRENT_DATE"))).toBe(
        true,
      );
    });

    it("employer/admin vẫn thấy tin quá hạn để quản lý", async () => {
      await service.findAll({ page: 1 } as never, employer);
      expect(conditions().some((c) => c.includes("deadline"))).toBe(false);
    });

    it("không có Redis vẫn chạy bằng DB", async () => {
      const plain = new JobsService(
        jobsRepository as never,
        applicationsRepository as never,
        companies as never,
        skills as never,
      );
      const result = await plain.findAll({ page: 1 } as never);
      expect(result.items).toEqual([job]);
    });
  });

  describe("chi tiết tin", () => {
    it("khách xem tin open qua cache với khoá theo id", async () => {
      await service.findOneForViewer(5, undefined);
      expect(redis.remember).toHaveBeenCalledWith("jobs:detail:5", 60, expect.any(Function));
    });

    it("employer xem chi tiết không qua cache", async () => {
      await service.findOneForViewer(5, employer);
      expect(redis.remember).not.toHaveBeenCalled();
    });
  });

  describe("xoá cache khi dữ liệu đổi", () => {
    it("tạo tin", async () => {
      await service.create(
        { companyId: 1, title: "Dev" } as never,
        employer,
      );
      expect(redis.invalidatePublicCache).toHaveBeenCalledTimes(1);
    });

    it("sửa tin", async () => {
      await service.update(5, { title: "Mới" } as never, employer);
      expect(redis.invalidatePublicCache).toHaveBeenCalledTimes(1);
    });

    it("xoá tin", async () => {
      await service.remove(5, employer);
      expect(redis.invalidatePublicCache).toHaveBeenCalledTimes(1);
    });

    it("khoá tin", async () => {
      await service.block(5);
      expect(redis.invalidatePublicCache).toHaveBeenCalledTimes(1);
    });

    it("thao tác bị từ chối thì không xoá cache", async () => {
      await expect(service.update(5, { title: "X" } as never, { id: 99, role: "employer" })).rejects.toBeDefined();
      expect(redis.invalidatePublicCache).not.toHaveBeenCalled();
    });
  });
});
