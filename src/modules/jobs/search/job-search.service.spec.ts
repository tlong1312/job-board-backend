import { JobSearchService, tokenize } from "./job-search.service";

describe("tokenize", () => {
  it("hạ chữ thường, bỏ trùng và bỏ ký tự đặc biệt", () => {
    expect(tokenize("NestJS, Backend! nestjs")).toEqual(["nestjs", "backend"]);
  });

  it("bỏ từ dừng và từ 1 ký tự", () => {
    expect(tokenize("việc làm cho a backend")).toEqual(["việc", "làm", "backend"]);
  });

  it("giữ nguyên tiếng Việt có dấu", () => {
    expect(tokenize("Hà Nội")).toEqual(["hà", "nội"]);
  });

  it("nếu toàn từ dừng thì giữ lại các từ đó thay vì trả rỗng", () => {
    expect(tokenize("và của")).toEqual(["và", "của"]);
  });

  it("chỉ lấy tối đa 12 từ", () => {
    const q = Array.from({ length: 20 }, (_, i) => `tu${i}`).join(" ");
    expect(tokenize(q)).toHaveLength(12);
  });

  it("chuỗi chỉ có ký hiệu thì trả mảng rỗng", () => {
    expect(tokenize(" !!! ")).toEqual([]);
  });
});

describe("JobSearchService", () => {
  const dataSource = { query: jest.fn() };
  const redis = { remember: jest.fn() };

  beforeEach(() => {
    jest.resetAllMocks();
    redis.remember.mockImplementation((_k, _ttl, loader) => loader());
  });

  it("từ khoá rỗng thì không truy vấn", async () => {
    const service = new JobSearchService(dataSource as never);
    await expect(service.search("  !!! ")).resolves.toEqual([]);
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it("truyền tsquery nối bằng | và limit, chỉ lấy tin open còn hạn", async () => {
    dataSource.query.mockResolvedValue([]);
    const service = new JobSearchService(dataSource as never);
    await service.search("nestjs backend", 5);
    const [sql, params] = dataSource.query.mock.calls[0];
    expect(params).toEqual(["nestjs | backend", 5]);
    expect(sql).toContain("j.status = 'open'");
    expect(sql).toContain("deadline");
  });

  it("chuyển đổi kiểu dữ liệu của từng dòng kết quả", async () => {
    dataSource.query.mockResolvedValue([
      { id: "3", title: "Dev", level: null, province: "HCM", location: undefined, score: "0.5" },
    ]);
    const service = new JobSearchService(dataSource as never);
    await expect(service.search("dev")).resolves.toEqual([
      { id: 3, title: "Dev", level: null, province: "HCM", location: null, score: 0.5 },
    ]);
  });

  it("có Redis: bọc trong remember với khoá theo từ khoá và limit, TTL 60 giây", async () => {
    dataSource.query.mockResolvedValue([]);
    const service = new JobSearchService(dataSource as never, redis as never);
    await service.search("NestJS Backend", 7);
    expect(redis.remember).toHaveBeenCalledWith(
      "search:7:nestjs backend",
      60,
      expect.any(Function),
    );
    expect(dataSource.query).toHaveBeenCalledTimes(1);
  });

  it("cache trúng thì không chạm DB", async () => {
    redis.remember.mockResolvedValue([{ id: 1 }]);
    const service = new JobSearchService(dataSource as never, redis as never);
    await expect(service.search("dev")).resolves.toEqual([{ id: 1 }]);
    expect(dataSource.query).not.toHaveBeenCalled();
  });
});
