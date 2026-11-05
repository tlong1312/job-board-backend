import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { JobsService } from "./jobs.service";
import { Job } from "./entities/job.entity";
import { ApplicationEntity } from "../applications/entities/application.entity";
import { CompaniesService } from "../companies/companies.service";
import { SkillsService } from "../skills/skills.service";
import {
  BadRequestException,
  ForBiddenException,
  NotFoundException,
} from "commons/error";
import { JwtUser } from "commons/decorators/current-user.decorator";

describe("JobsService", () => {
  let service: JobsService;
  const jobsRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    merge: jest.fn(),
    remove: jest.fn(),
  };
  const applicationsRepository = { count: jest.fn() };
  const companiesService = { findOne: jest.fn() };
  const skillsService = { findByIds: jest.fn() };

  const employer: JwtUser = { id: 2, role: "employer" };
  const otherEmployer: JwtUser = { id: 3, role: "employer" };
  const admin: JwtUser = { id: 1, role: "admin" };
  const candidate: JwtUser = { id: 9, role: "candidate" };

  const fmt = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
  };
  const futureDate = () => fmt(10);
  const pastDate = () => fmt(-3);

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: getRepositoryToken(Job), useValue: jobsRepository },
        {
          provide: getRepositoryToken(ApplicationEntity),
          useValue: applicationsRepository,
        },
        { provide: CompaniesService, useValue: companiesService },
        { provide: SkillsService, useValue: skillsService },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
    skillsService.findByIds.mockResolvedValue([]);
  });

  describe("findOne", () => {
    it("ném NotFoundException khi id không tồn tại", async () => {
      jobsRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("trả về job khi tìm thấy theo id", async () => {
      const job = { id: 1, title: "Backend Intern", status: "open" } as Job;
      jobsRepository.findOne.mockResolvedValue(job);
      await expect(service.findOne(1)).resolves.toBe(job);
      expect(jobsRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: { company: true, skills: true },
      });
    });
  });

  describe("findOneForViewer", () => {
    const closed = { id: 1, status: "closed" } as Job;

    it("khách xem tin không phải open -> 404", async () => {
      jobsRepository.findOne.mockResolvedValue(closed);
      await expect(service.findOneForViewer(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("ứng viên xem tin blocked -> 404", async () => {
      jobsRepository.findOne.mockResolvedValue({ id: 1, status: "blocked" });
      await expect(
        service.findOneForViewer(1, candidate),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("khách xem tin open được", async () => {
      const open = { id: 1, status: "open" } as Job;
      jobsRepository.findOne.mockResolvedValue(open);
      await expect(service.findOneForViewer(1)).resolves.toBe(open);
    });

    it("admin/employer xem được tin closed", async () => {
      jobsRepository.findOne.mockResolvedValue(closed);
      await expect(service.findOneForViewer(1, admin)).resolves.toBe(closed);
      await expect(service.findOneForViewer(1, employer)).resolves.toBe(closed);
    });
  });

  describe("findAll", () => {
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
    const conditions = () => qb.andWhere.mock.calls.map((c) => String(c[0]));

    beforeEach(() => {
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
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      jobsRepository.createQueryBuilder.mockReturnValue(qb);
    });

    it("admin: mới nhất trước, không lọc status và không lọc hạn nộp", async () => {
      await service.findAll({}, admin);
      expect(qb.orderBy).toHaveBeenCalledWith("job.created_at", "DESC");
      expect(conditions()).toEqual([]);
    });

    it("employer lọc theo status khi có", async () => {
      await service.findAll({ status: "closed" }, employer);
      expect(qb.andWhere).toHaveBeenCalledWith("job.status = :status", {
        status: "closed",
      });
    });

    it("khách chỉ thấy tin open và còn hạn nộp", async () => {
      await service.findAll({});
      expect(qb.andWhere).toHaveBeenCalledWith("job.status = :status", {
        status: "open",
      });
      expect(conditions().some((c) => c.includes("deadline"))).toBe(true);
    });

    it("ứng viên xin status khác open -> danh sách rỗng, không truy vấn", async () => {
      const result = await service.findAll({ status: "blocked" }, candidate);
      expect(result.items).toEqual([]);
      expect(jobsRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it("lọc theo tỉnh, cấp bậc và tên công ty", async () => {
      await service.findAll(
        { province: "HCM", level: "junior", companyName: "acme" },
        admin,
      );
      const all = conditions().join(" | ");
      expect(all).toContain("job.province");
      expect(all).toContain("job.level");
      expect(all).toContain("company.name");
    });

    it("trả kèm thông tin phân trang", async () => {
      qb.getManyAndCount.mockResolvedValue([[{ id: 1 }], 25]);
      const result = await service.findAll({ page: 2, limit: 10 }, admin);
      expect(result.items).toEqual([{ id: 1 }]);
      expect(result.meta).toEqual(
        expect.objectContaining({ page: 2, limit: 10, total: 25 }),
      );
    });
  });

  describe("findMyJobs", () => {
    it("chỉ lấy tin do người này tạo, mới nhất trước", async () => {
      jobsRepository.find.mockResolvedValue([]);
      await service.findMyJobs(2);
      expect(jobsRepository.find).toHaveBeenCalledWith({
        where: { createdBy: 2 },
        order: { id: "DESC" },
      });
    });
  });

  describe("create", () => {
    const dto = { companyId: 1, title: "Backend Intern" };

    it("để lỗi 404 của CompaniesService nổi lên khi công ty không tồn tại", async () => {
      companiesService.findOne.mockRejectedValue(new NotFoundException("x"));
      await expect(service.create(dto, employer)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("ném 403 khi công ty không thuộc người đăng", async () => {
      companiesService.findOne.mockResolvedValue({ id: 1, ownerId: 99 });
      await expect(service.create(dto, employer)).rejects.toBeInstanceOf(
        ForBiddenException,
      );
      expect(jobsRepository.save).not.toHaveBeenCalled();
    });

    it("ném 400 khi lương tối đa < lương tối thiểu", async () => {
      companiesService.findOne.mockResolvedValue({ id: 1, ownerId: 2 });
      await expect(
        service.create({ ...dto, salaryMin: 10, salaryMax: 5 }, employer),
      ).rejects.toMatchObject({
        status: 400,
        errors: "Lương tối đa không được nhỏ hơn lương tối thiểu",
      });
    });

    it("ném 400 khi deadline trước hôm nay", async () => {
      companiesService.findOne.mockResolvedValue({ id: 1, ownerId: 2 });
      await expect(
        service.create({ ...dto, deadline: pastDate() }, employer),
      ).rejects.toMatchObject({
        status: 400,
        errors: "Hạn nộp hồ sơ phải từ hôm nay trở đi",
      });
    });

    it("chấp nhận deadline là hôm nay", async () => {
      companiesService.findOne.mockResolvedValue({ id: 1, ownerId: 2 });
      jobsRepository.create.mockReturnValue({});
      jobsRepository.save.mockResolvedValue({});
      await expect(
        service.create({ ...dto, deadline: fmt(0) }, employer),
      ).resolves.toBeDefined();
    });

    it("tạo thành công: createdBy lấy từ token, status = open", async () => {
      const full = {
        ...dto,
        salaryMin: 5,
        salaryMax: 10,
        deadline: futureDate(),
      };
      const entity = { id: 1 } as unknown as Job;
      companiesService.findOne.mockResolvedValue({ id: 1, ownerId: 2 });
      jobsRepository.create.mockReturnValue(entity);
      jobsRepository.save.mockResolvedValue(entity);
      await expect(service.create(full, employer)).resolves.toBe(entity);
      expect(jobsRepository.create).toHaveBeenCalledWith({
        ...full,
        createdBy: 2,
        status: "open",
        skills: [],
      });
      expect(jobsRepository.save).toHaveBeenCalledWith(entity);
    });
  });

  describe("update", () => {
    it("ném 404 khi không tìm thấy", async () => {
      jobsRepository.findOne.mockResolvedValue(null);
      await expect(
        service.update(1, { title: "x" }, employer),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("ném 403 khi không phải chủ tin và không phải admin", async () => {
      jobsRepository.findOne.mockResolvedValue({
        id: 1,
        createdBy: 2,
        status: "open",
      });
      await expect(
        service.update(1, { title: "New" }, otherEmployer),
      ).rejects.toBeInstanceOf(ForBiddenException);
      expect(jobsRepository.save).not.toHaveBeenCalled();
    });

    it("ném 403 khi tin đang bị blocked (kể cả admin)", async () => {
      jobsRepository.findOne.mockResolvedValue({
        id: 1,
        createdBy: 2,
        status: "blocked",
      });
      await expect(
        service.update(1, { title: "New" }, admin),
      ).rejects.toBeInstanceOf(ForBiddenException);
      expect(jobsRepository.save).not.toHaveBeenCalled();
    });

    it("ghép lương mới với lương cũ trong DB trước khi so sánh", async () => {
      jobsRepository.findOne.mockResolvedValue({
        id: 1,
        createdBy: 2,
        status: "open",
        salaryMin: 10,
        salaryMax: 20,
      });
      await expect(
        service.update(1, { salaryMax: 5 }, employer),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.update(1, { salaryMin: 30 }, employer),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("ném 400 khi deadline mới trước hôm nay", async () => {
      jobsRepository.findOne.mockResolvedValue({
        id: 1,
        createdBy: 2,
        status: "open",
      });
      await expect(
        service.update(1, { deadline: pastDate() }, employer),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("chủ tin cập nhật / đóng tin thành công", async () => {
      const job = {
        id: 1,
        createdBy: 2,
        status: "open",
        salaryMin: 10,
        salaryMax: 20,
      };
      jobsRepository.findOne.mockResolvedValue(job);
      jobsRepository.save.mockResolvedValue(job);
      await service.update(1, { salaryMax: 30, status: "closed" }, employer);
      expect(jobsRepository.merge).toHaveBeenCalledWith(job, {
        salaryMax: 30,
        status: "closed",
      });
      expect(jobsRepository.save).toHaveBeenCalledWith(job);
    });

    it("admin sửa được tin của người khác", async () => {
      const job = { id: 1, createdBy: 2, status: "open" };
      jobsRepository.findOne.mockResolvedValue(job);
      jobsRepository.save.mockResolvedValue(job);
      await service.update(1, { status: "closed" }, admin);
      expect(jobsRepository.save).toHaveBeenCalledWith(job);
    });
  });

  describe("remove", () => {
    it("ném 404 khi không tồn tại", async () => {
      jobsRepository.findOne.mockResolvedValue(null);
      await expect(service.remove(9, employer)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("ném 403 khi không phải chủ tin và không phải admin", async () => {
      jobsRepository.findOne.mockResolvedValue({ id: 1, createdBy: 2 });
      await expect(service.remove(1, otherEmployer)).rejects.toBeInstanceOf(
        ForBiddenException,
      );
      expect(jobsRepository.remove).not.toHaveBeenCalled();
    });

    it("ném 400 khi tin đã có hồ sơ", async () => {
      jobsRepository.findOne.mockResolvedValue({ id: 1, createdBy: 2 });
      applicationsRepository.count.mockResolvedValue(3);
      await expect(service.remove(1, employer)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(applicationsRepository.count).toHaveBeenCalledWith({
        where: { jobId: 1 },
      });
      expect(jobsRepository.remove).not.toHaveBeenCalled();
    });

    it("xoá thành công khi chưa có hồ sơ", async () => {
      const job = { id: 1, createdBy: 2 };
      jobsRepository.findOne.mockResolvedValue(job);
      applicationsRepository.count.mockResolvedValue(0);
      jobsRepository.remove.mockResolvedValue(job);
      await expect(service.remove(1, employer)).resolves.toEqual({
        message: "Đã xoá việc làm có id 1",
      });
      expect(jobsRepository.remove).toHaveBeenCalledWith(job);
    });

    it("admin xoá được tin của người khác", async () => {
      const job = { id: 1, createdBy: 2 };
      jobsRepository.findOne.mockResolvedValue(job);
      applicationsRepository.count.mockResolvedValue(0);
      jobsRepository.remove.mockResolvedValue(job);
      await expect(service.remove(1, admin)).resolves.toBeDefined();
    });
  });

  describe("block", () => {
    it("ném 404 khi không tìm thấy", async () => {
      jobsRepository.findOne.mockResolvedValue(null);
      await expect(service.block(1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("ném 400 khi tin đã blocked", async () => {
      jobsRepository.findOne.mockResolvedValue({ id: 1, status: "blocked" });
      await expect(service.block(1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(jobsRepository.save).not.toHaveBeenCalled();
    });

    it("đặt status = blocked", async () => {
      const job = { id: 1, status: "open" };
      jobsRepository.findOne.mockResolvedValue(job);
      jobsRepository.save.mockImplementation((j) => Promise.resolve(j));
      await expect(service.block(1)).resolves.toMatchObject({
        status: "blocked",
      });
    });
  });
});
