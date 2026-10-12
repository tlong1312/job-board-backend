import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtUser } from "commons/decorators/current-user.decorator";
import { Role, ROLES_KEY } from "commons/decorators/roles.decorator";
import { ForBiddenException } from "commons/error";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;

    const user = ctx.switchToHttp().getRequest().user as JwtUser | undefined;
    if (!user || !roles.includes(user.role)) {
      throw new ForBiddenException("Bạn không có quyền thực hiện thao tác này");
    }
    return true;
  }
}
