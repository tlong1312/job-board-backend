import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Role } from "./roles.decorator";

export interface JwtUser {
  id: number;
  role: Role;
}

export const CurrentUser = createParamDecorator(
  (field: keyof JwtUser | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest().user as JwtUser;
    return field ? user?.[field] : user;
  },
);
