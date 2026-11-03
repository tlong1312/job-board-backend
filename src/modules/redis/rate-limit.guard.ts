import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request, Response } from "express";
import { RedisService } from "./redis.service";

export const RATE_LIMIT_KEY = "rate_limit";

export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
}

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      ctx.getHandler(),
    );
    if (!options) return true;

    const req = ctx
      .switchToHttp()
      .getRequest<Request & { user?: { id: number } }>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const who = req.user?.id ? `u${req.user.id}` : `ip${req.ip ?? "unknown"}`;
    const route = `${ctx.getClass().name}.${ctx.getHandler().name}`;

    const result = await this.redis.hit(
      `rl:${route}:${who}`,
      options.windowSeconds,
    );
    if (!result) return true;

    res.setHeader("X-RateLimit-Limit", String(options.limit));
    res.setHeader(
      "X-RateLimit-Remaining",
      String(Math.max(0, options.limit - result.count)),
    );
    if (result.count > options.limit) {
      res.setHeader("Retry-After", String(result.ttl));
      throw new HttpException(
        {
          message: `Bạn gửi quá nhiều yêu cầu, thử lại sau ${result.ttl} giây`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
