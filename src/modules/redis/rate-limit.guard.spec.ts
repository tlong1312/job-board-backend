import { HttpException } from "@nestjs/common";
import { RateLimitGuard } from "./rate-limit.guard";

describe("RateLimitGuard", () => {
  const reflector = { get: jest.fn() };
  const redis = { hit: jest.fn() };
  let guard: RateLimitGuard;
  let res: { setHeader: jest.Mock };

  const ctxWith = (req: Record<string, unknown>) => {
    res = { setHeader: jest.fn() };
    return {
      getHandler: () => function login() {},
      getClass: () => ({ name: "AuthController" }),
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as never;
  };

  beforeEach(() => {
    jest.resetAllMocks();
    guard = new RateLimitGuard(reflector as never, redis as never);
  });

  it("route không gắn @RateLimit thì cho qua, không chạm Redis", async () => {
    reflector.get.mockReturnValue(undefined);
    await expect(guard.canActivate(ctxWith({ ip: "1.1.1.1" }))).resolves.toBe(true);
    expect(redis.hit).not.toHaveBeenCalled();
  });

  it("Redis không dùng được (hit = null) thì cho qua", async () => {
    reflector.get.mockReturnValue({ limit: 10, windowSeconds: 60 });
    redis.hit.mockResolvedValue(null);
    await expect(guard.canActivate(ctxWith({ ip: "1.1.1.1" }))).resolves.toBe(true);
  });

  it("dưới ngưỡng: cho qua và gửi header còn lại bao nhiêu lượt", async () => {
    reflector.get.mockReturnValue({ limit: 10, windowSeconds: 60 });
    redis.hit.mockResolvedValue({ count: 3, ttl: 50 });
    const ctx = ctxWith({ ip: "1.1.1.1" });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", "10");
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", "7");
  });

  it("đúng ngưỡng (lần thứ 10 trong 10) vẫn được qua", async () => {
    reflector.get.mockReturnValue({ limit: 10, windowSeconds: 60 });
    redis.hit.mockResolvedValue({ count: 10, ttl: 5 });
    await expect(guard.canActivate(ctxWith({ ip: "1.1.1.1" }))).resolves.toBe(true);
  });

  it("vượt ngưỡng: ném 429 kèm Retry-After", async () => {
    reflector.get.mockReturnValue({ limit: 10, windowSeconds: 60 });
    redis.hit.mockResolvedValue({ count: 11, ttl: 42 });
    const ctx = ctxWith({ ip: "1.1.1.1" });
    const error = await guard.canActivate(ctx).catch((e) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(429);
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "42");
  });

  it("đếm theo user khi đã đăng nhập, theo IP khi chưa", async () => {
    reflector.get.mockReturnValue({ limit: 10, windowSeconds: 60 });
    redis.hit.mockResolvedValue({ count: 1, ttl: 60 });

    await guard.canActivate(ctxWith({ user: { id: 7 }, ip: "1.1.1.1" }));
    expect(redis.hit).toHaveBeenLastCalledWith("rl:AuthController.login:u7", 60);

    await guard.canActivate(ctxWith({ ip: "1.1.1.1" }));
    expect(redis.hit).toHaveBeenLastCalledWith("rl:AuthController.login:ip1.1.1.1", 60);
  });
});
