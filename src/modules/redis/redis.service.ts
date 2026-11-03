import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

const PUBLIC_CACHE_VERSION_KEY = "cache:public:version";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;
  private lastErrorLog = 0;

  constructor(config: ConfigService) {
    this.client = new Redis({
      host: config.get<string>("redis.host", "localhost"),
      port: config.get<number>("redis.port", 6381),
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => Math.min(times * 500, 5000),
    });
    this.client.on("error", (e) => {
      const now = Date.now();
      if (now - this.lastErrorLog > 30_000) {
        this.lastErrorLog = now;
        this.logger.warn(`Redis lỗi: ${e.message}`);
      }
    });
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }

  async getJson<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch {
      /* bỏ qua: không có cache thì vẫn chạy bằng DB */
    }
  }

  async getNumber(key: string): Promise<number> {
    try {
      return Number((await this.client.get(key)) ?? 0) || 0;
    } catch {
      return 0;
    }
  }

  async incr(key: string): Promise<void> {
    try {
      await this.client.incr(key);
    } catch {
      /* bỏ qua */
    }
  }

  /**
   * Cache-aside: có trong Redis thì trả luôn, chưa có thì chạy loader (truy vấn DB)
   * rồi lưu lại. Khoá chứa "số phiên bản" chung; khi dữ liệu đổi ta tăng số này
   * (invalidatePublicCache) nên mọi khoá cũ tự bị bỏ qua, chờ hết TTL rồi Redis xoá.
   * Redis chết thì getNumber/getJson/setJson đều im lặng, hệ thống chạy thẳng bằng DB.
   */
  async remember<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const version = await this.getNumber(PUBLIC_CACHE_VERSION_KEY);
    const fullKey = `cache:v${version}:${key}`;
    const cached = await this.getJson<T>(fullKey);
    if (cached !== null) return cached;
    const fresh = await loader();
    await this.setJson(fullKey, fresh, ttlSeconds);
    return fresh;
  }

  async invalidatePublicCache(): Promise<void> {
    await this.incr(PUBLIC_CACHE_VERSION_KEY);
  }

  async hit(
    key: string,
    windowSeconds: number,
  ): Promise<{ count: number; ttl: number } | null> {
    try {
      const count = await this.client.incr(key);
      if (count === 1) await this.client.expire(key, windowSeconds);
      const ttl = await this.client.ttl(key);
      return { count, ttl: ttl > 0 ? ttl : windowSeconds };
    } catch {
      return null;
    }
  }
}
