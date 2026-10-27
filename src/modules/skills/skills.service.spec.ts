import { SkillsService } from "./skills.service";
import { BadRequestException } from "commons/error";

describe("SkillsService", () => {
  const repository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  let service: SkillsService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new SkillsService(repository as never);
  });

  it("findAll sắp xếp theo tên tăng dần", async () => {
    repository.find.mockResolvedValue([]);
    await service.findAll();
    expect(repository.find).toHaveBeenCalledWith({ order: { name: "ASC" } });
  });

  describe("create", () => {
    it("ném 400 khi kỹ năng đã tồn tại", async () => {
      repository.findOne.mockResolvedValue({ id: 1, name: "NestJS" });
      await expect(service.create({ name: "NestJS" } as never)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it("cắt khoảng trắng thừa rồi lưu", async () => {
      repository.findOne.mockResolvedValue(null);
      repository.create.mockImplementation((x) => x);
      repository.save.mockImplementation(async (x) => ({ id: 1, ...x }));
      const result = await service.create({ name: "  NestJS  " } as never);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { name: "NestJS" } });
      expect(result).toEqual({ id: 1, name: "NestJS" });
    });
  });

  describe("findByIds", () => {
    it("danh sách rỗng thì không truy vấn", async () => {
      await expect(service.findByIds([])).resolves.toEqual([]);
      expect(repository.find).not.toHaveBeenCalled();
    });

    it("loại id trùng trước khi truy vấn", async () => {
      repository.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      await expect(service.findByIds([1, 2, 2, 1])).resolves.toHaveLength(2);
      expect(repository.find.mock.calls[0][0].where.id.value).toEqual([1, 2]);
    });

    it("ném 400 khi có kỹ năng không tồn tại", async () => {
      repository.find.mockResolvedValue([{ id: 1 }]);
      await expect(service.findByIds([1, 99])).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
