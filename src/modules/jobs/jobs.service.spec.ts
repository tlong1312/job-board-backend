import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { JobsService } from "./jobs.service";
import { Job } from "./entities/job.entity";
import { UsersService } from "../users/users.service";
import {
  BadRequestException,
  ForBiddenException,
  NotFoundException,
} from "commons/error";

describe("JobsService", () => {
  let service: JobsService;
  const jobsRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    merge: jest.fn(),
    remove: jest.fn(),
  };
  const usersService = { findOne: jest.fn() };

  const futureDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().slice(0, 10);
  };
  const pastDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    return d.toISOString().slice(0, 10);
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: getRepositoryToken(Job), useValue: jobsRepository },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
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
      expect(jobsRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  describe("findAll", () => {
    it("sắp xếp mới nhất trước và không lọc khi không có status", async () => {
      jobsRepository.find.mockResolvedValue([]);
      await service.findAll({});
      expect(jobsRepository.find).toHaveBeenCalledWith({
        where: {},
        order: { createdAt: "DESC", id: "DESC" },
      });
    });

    it("lọc theo status khi có", async () => {
      jobsRepository.find.mockResolvedValue([]);
      await service.findAll({ status: "open" });
      expect(jobsRepository.find).toHaveBeenCalledWith({
        where: { status: "open" },
        order: { createdAt: "DESC", id: "DESC" },
      });
    });
  });

  describe("create", () => {
    const dto = {
      companyId: 1,
      createdBy: 2,
      title: "Backend Intern",
    };

    it("ném 400 khi người đăng không phải employer", async () => {
      usersService.findOne.mockResolvedValue({ id: 2, role: "candidate" });
      await expect(service.create(dto)).rejects.toMatchObject({
        status: 400,
        errors: "Chỉ nhà tuyển dụng mới được đăng tin",
      });
      expect(jobsRepository.save).not.toHaveBeenCalled();
    });

    it("để lỗi 404 của UsersService nổi lên khi không có user", async () => {
      usersService.findOne.mockRejectedValue(new NotFoundException("x"));
      await expect(service.create(dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("ném 400 khi lương tối đa < lương tối thiểu", async () => {
      usersService.findOne.mockResolvedValue({ id: 2, role: "employer" });
      await expect(
        service.create({ ...dto, salaryMin: 10, salaryMax: 5 }),
      ).rejects.toMatchObject({
        status: 400,
        errors: "Lương tối đa không được nhỏ hơn lương tối thiểu",
      });
    });

    it("ném 400 khi deadline trước hôm nay", async () => {
      usersService.findOne.mockResolvedValue({ id: 2, role: "employer" });
      await expect(
        service.create({ ...dto, deadline: pastDate() }),
      ).rejects.toMatchObject({
        status: 400,
        errors: "Hạn nộp hồ sơ phải từ hôm nay trở đi",
      });
    });

    it("tạo thành công khi dữ liệu hợp lệ", async () => {
      const full = {
        ...dto,
        salaryMin: 5,
        salaryMax: 10,
        deadline: futureDate(),
      };
      const entity = { id: 1, ...full } as unknown as Job;
      usersService.findOne.mockResolvedValue({ id: 2, role: "employer" });
      jobsRepository.create.mockReturnValue(entity);
      jobsRepository.save.mockResolvedValue(entity);
      await expect(service.create(full)).resolves.toBe(entity);
      expect(jobsRepository.save).toHaveBeenCalledWith(entity);
    });
  });

  describe("update", () => {
    it("ném 403 khi tin đang bị blocked", async () => {
      jobsRepository.findOne.mockResolvedValue({ id: 1, status: "blocked" });
      await expect(service.update(1, { title: "New" })).rejects.toBeInstanceOf(
        ForBiddenException,
      );
      expect(jobsRepository.save).not.toHaveBeenCalled();
    });

    it("ghép lương mới với lương cũ trong DB trước khi so sánh", async () => {
      jobsRepository.findOne.mockResolvedValue({
        id: 1,
        status: "open",
        salaryMin: 10,
        salaryMax: 20,
      });
      // chỉ gửi salaryMax = 5 -> so với salaryMin cũ = 10 -> lỗi
      await expect(service.update(1, { salaryMax: 5 })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      // chỉ gửi salaryMin = 30 -> so với salaryMax cũ = 20 -> lỗi
      await expect(service.update(1, { salaryMin: 30 })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("ném 400 khi deadline mới trước hôm nay", async () => {
      jobsRepository.findOne.mockResolvedValue({ id: 1, status: "open" });
      await expect(
        service.update(1, { deadline: pastDate() }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("cập nhật thành công", async () => {
      const job = { id: 1, status: "open", salaryMin: 10, salaryMax: 20 };
      jobsRepository.findOne.mockResolvedValue(job);
      jobsRepository.save.mockResolvedValue(job);
      await service.update(1, { salaryMax: 30 });
      expect(jobsRepository.merge).toHaveBeenCalledWith(job, {
        salaryMax: 30,
      });
      expect(jobsRepository.save).toHaveBeenCalledWith(job);
    });
  });

  describe("remove", () => {
    it("ném 404 khi không tồn tại", async () => {
      jobsRepository.findOne.mockResolvedValue(null);
      await expect(service.remove(9)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("xoá thành công", async () => {
      const job = { id: 1 };
      jobsRepository.findOne.mockResolvedValue(job);
      jobsRepository.remove.mockResolvedValue(job);
      await expect(service.remove(1)).resolves.toEqual({
        message: "Đã xoá việc làm có id 1",
      });
      expect(jobsRepository.remove).toHaveBeenCalledWith(job);
    });
  });
});
