import { Test, TestingModule } from "@nestjs/testing";
import { JobsService } from "./jobs.service";
import { NotFoundException } from "commons/error";

describe("JobsService", () => {
  let service: JobsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JobsService],
    }).compile();

    service = module.get<JobsService>(JobsService);
  });

  it("ném NotFoundException khi id không tồn tại", () => {
    expect(() => service.findOne(99)).toThrow(NotFoundException);
  });

  it("tạo job rồi tìm lại được theo id", () => {
    const job = service.create({ title: "Backend Intern", company: "ABC" });
    expect(service.findOne(job.id)).toEqual(job);
  });
});
