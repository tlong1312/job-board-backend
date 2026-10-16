import type { Request } from "express";
import { Test, TestingModule } from "@nestjs/testing";
import { JobsController } from "./jobs.controller";
import { JobsService } from "./jobs.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Job } from "./entities/job.entity";
import { ApplicationEntity } from "../applications/entities/application.entity";
import { CompaniesService } from "../companies/companies.service";
import { AuthService } from "../auth/auth.service";
 
describe("JobsController", () => {
  let controller: JobsController;
  const req = (authorization?: string) =>
    ({ headers: { authorization } }) as unknown as Request;
  const authService = { verifyAccessToken: jest.fn() };
  const jobsService = { findAll: jest.fn(), findOneForViewer: jest.fn() };
 
  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [
        { provide: JobsService, useValue: jobsService },
        { provide: getRepositoryToken(Job), useValue: {} },
        { provide: getRepositoryToken(ApplicationEntity), useValue: {} },
        { provide: CompaniesService, useValue: {} },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();
 
    controller = module.get<JobsController>(JobsController);
  });
 
  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
 
  describe("findAll (public)", () => {
    it("không có token: coi là khách", async () => {
      await controller.findAll({}, req());
      expect(jobsService.findAll).toHaveBeenCalledWith({}, undefined);
    });
 
    it("token hợp lệ: truyền user xuống service", async () => {
      authService.verifyAccessToken.mockResolvedValue({
        sub: 1,
        role: "admin",
      });
      await controller.findAll({ status: "closed" }, req("Bearer abc"));
      expect(jobsService.findAll).toHaveBeenCalledWith(
        { status: "closed" },
        { id: 1, role: "admin" },
      );
    });
 
    it("token sai/hết hạn: vẫn coi là khách, không ném lỗi", async () => {
      authService.verifyAccessToken.mockRejectedValue(new Error("expired"));
      await controller.findAll({}, req("Bearer bad"));
      expect(jobsService.findAll).toHaveBeenCalledWith({}, undefined);
    });
  });
 
  describe("findOne (public)", () => {
    it("token hợp lệ: truyền user xuống service", async () => {
      authService.verifyAccessToken.mockResolvedValue({
        sub: 2,
        role: "employer",
      });
      await controller.findOne(5, req("Bearer abc"));
      expect(jobsService.findOneForViewer).toHaveBeenCalledWith(5, {
        id: 2,
        role: "employer",
      });
    });
  });
});
 