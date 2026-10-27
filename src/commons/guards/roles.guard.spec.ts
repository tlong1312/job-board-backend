import { RolesGuard } from "./roles.guard";
import { ForBiddenException } from "commons/error";

describe("RolesGuard", () => {
  const reflector = { getAllAndOverride: jest.fn() };
  let guard: RolesGuard;

  const ctxWith = (user?: { id: number; role: string }) =>
    ({
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as never;

  beforeEach(() => {
    jest.resetAllMocks();
    guard = new RolesGuard(reflector as never);
  });

  it("cho qua khi route không khai báo @Roles", () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(ctxWith(undefined))).toBe(true);
  });

  it("cho qua khi danh sách role rỗng", () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    expect(guard.canActivate(ctxWith({ id: 1, role: "candidate" }))).toBe(true);
  });

  it("cho qua khi role của user nằm trong danh sách", () => {
    reflector.getAllAndOverride.mockReturnValue(["employer", "admin"]);
    expect(guard.canActivate(ctxWith({ id: 1, role: "employer" }))).toBe(true);
  });

  it("ném 403 khi role không phù hợp", () => {
    reflector.getAllAndOverride.mockReturnValue(["admin"]);
    expect(() => guard.canActivate(ctxWith({ id: 1, role: "candidate" }))).toThrow(
      ForBiddenException,
    );
  });

  it("ném 403 khi chưa có user trong request", () => {
    reflector.getAllAndOverride.mockReturnValue(["admin"]);
    expect(() => guard.canActivate(ctxWith(undefined))).toThrow(ForBiddenException);
  });
});
