import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtUser } from "commons/decorators/current-user.decorator";
import { IS_PUBLIC_KEY } from "commons/decorators/public.decorator";
import { UnAuthorizedException } from "commons/error";
import { AuthService } from "src/modules/auth/auth.service";

interface AuthRequest {
  headers: Record<string, string | undefined>;
  user?: JwtUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    const [type, token] = req.headers["authorization"]?.split(" ") ?? [];
    if (type !== "Bearer" || !token) {
      throw new UnAuthorizedException("Thiếu access token");
    }

    try {
      const payload = await this.authService.verifyAccessToken(token);
      req.user = { id: payload.sub, role: payload.role };
    } catch {
      throw new UnAuthorizedException(
        "Access token không hợp lệ hoặc đã hết hạn",
      );
    }
    return true;
  }
}
