import { RedisService } from "./redis.service";

const mockClient = {
  get: jest.fn(),
  set: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  on: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock("ioredis", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => mockClient),
}));

describe("RedisService", () => {
  const config = { get: jest.fn((_key: string, def?: unknown) => def) };
  let service: RedisService;
  /** Kho giả lập: get đọc từ đây, set ghi vào đây. */
  let store: Map<string, string>;

  beforeEach(() => {
    jest.clearAllMocks();
    store = new Map();
    mockClient.get.mockImplementation(async (k: string) => store.get(k) ?? null);
    mockClient.set.mockImplementation(async (k: string, v: string) => {
      store.set(k, v);
    });
    mockClient.incr.mockImplementation(async (k: string) => {
      const n = Number(store.get(k) ?? 0) + 1;
      store.set(k, String(n));
      return n;
    });
    service = new RedisService(config as never);
  });

  it("ngắt kết nối khi module huỷ", () => {
    service.onModuleDestroy();
    expect(mockClient.disconnect).toHaveBeenCalled();
  });

  describe("getJson / setJson", () => {
    it("lưu với TTL rồi đọc lại được", async () => {
      await service.setJson("k", { a: 1 }, 30);
      expect(mockClient.set).toHaveBeenCalledWith("k", '{"a":1}', "EX", 30);
      await expect(service.getJson("k")).resolves.toEqual({ a: 1 });
    });

    it("khoá không có thì trả null", async () => {
      await expect(service.getJson("khong-co")).resolves.toBeNull();
    });

    it("Redis lỗi thì getJson trả null, setJson không ném lỗi", async () => {
      mockClient.get.mockRejectedValue(new Error("down"));
      mockClient.set.mockRejectedValue(new Error("down"));
      await expect(service.getJson("k")).resolves.toBeNull();
      await expect(service.setJson("k", 1, 5)).resolves.toBeUndefined();
    });
  });

  describe("getNumber / incr", () => {
    it("khoá chưa có thì là 0, incr tăng dần", async () => {
      await expect(service.getNumber("n")).resolves.toBe(0);
      await service.incr("n");
      await service.incr("n");
      await expect(service.getNumber("n")).resolves.toBe(2);
    });

    it("Redis lỗi thì getNumber trả 0 và incr không ném lỗi", async () => {
      mockClient.get.mockRejectedValue(new Error("down"));
      mockClient.incr.mockRejectedValue(new Error("down"));
      await expect(service.getNumber("n")).resolves.toBe(0);
      await expect(service.incr("n")).resolves.toBeUndefined();
    });
  });

  describe("hit (đếm cho rate limit)", () => {
    it("lần đầu đặt thời hạn cho bộ đếm", async () => {
      mockClient.ttl.mockResolvedValue(60);
      await expect(service.hit("rl:x", 60)).resolves.toEqual({ count: 1, ttl: 60 });
      expect(mockClient.expire).toHaveBeenCalledWith("rl:x", 60);
    });

    it("các lần sau không đặt lại thời hạn", async () => {
      mockClient.ttl.mockResolvedValue(42);
      await service.hit("rl:x", 60);
      mockClient.expire.mockClear();
      await expect(service.hit("rl:x", 60)).resolves.toEqual({ count: 2, ttl: 42 });
      expect(mockClient.expire).not.toHaveBeenCalled();
    });

    it("ttl không hợp lệ thì dùng độ dài cửa sổ", async () => {
      mockClient.ttl.mockResolvedValue(-1);
      await expect(service.hit("rl:x", 60)).resolves.toEqual({ count: 1, ttl: 60 });
    });

    it("Redis lỗi thì trả null (guard sẽ cho qua)", async () => {
      mockClient.incr.mockRejectedValue(new Error("down"));
      await expect(service.hit("rl:x", 60)).resolves.toBeNull();
    });
  });

  describe("remember (cache-aside có số phiên bản)", () => {
    it("lần đầu chạy loader và lưu, lần sau lấy từ cache", async () => {
      const loader = jest.fn().mockResolvedValue({ n: 1 });
      await expect(service.remember("jobs", 60, loader)).resolves.toEqual({ n: 1 });
      await expect(service.remember("jobs", 60, loader)).resolves.toEqual({ n: 1 });
      expect(loader).toHaveBeenCalledTimes(1);
      expect(mockClient.set).toHaveBeenCalledWith(
        "cache:v0:jobs",
        '{"n":1}',
        "EX",
        60,
      );
    });

    it("invalidatePublicCache làm cache cũ không còn được dùng", async () => {
      const loader = jest.fn().mockResolvedValueOnce("cũ").mockResolvedValueOnce("mới");
      await service.remember("jobs", 60, loader);
      await service.invalidatePublicCache();
      await expect(service.remember("jobs", 60, loader)).resolves.toBe("mới");
      expect(loader).toHaveBeenCalledTimes(2);
      expect(store.has("cache:v1:jobs")).toBe(true);
    });

    it("Redis chết thì vẫn trả dữ liệu từ loader", async () => {
      mockClient.get.mockRejectedValue(new Error("down"));
      mockClient.set.mockRejectedValue(new Error("down"));
      const loader = jest.fn().mockResolvedValue("từ DB");
      await expect(service.remember("jobs", 60, loader)).resolves.toBe("từ DB");
    });

    it("lỗi của loader được ném ra, không bị nuốt", async () => {
      await expect(
        service.remember("jobs", 60, async () => {
          throw new Error("DB lỗi");
        }),
      ).rejects.toThrow("DB lỗi");
    });
  });
});
