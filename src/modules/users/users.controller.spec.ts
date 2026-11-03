import { Test, TestingModule } from "@nestjs/testing";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { ROLES_KEY } from "commons/decorators/roles.decorator";
import { IS_PUBLIC_KEY } from "commons/decorators/public.decorator";

describe("UsersController", () => {
  let controller: UsersController;
  const usersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    unlock: jest.fn(),
    hardRemove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  const handler = (name: keyof UsersController) =>
    Object.getOwnPropertyDescriptor(UsersController.prototype, name)?.value;

  it.each(["findAll", "findOne", "unlock", "hardRemove"] as const)(
    "%s chỉ dành cho admin",
    (name) => {
      expect(Reflect.getMetadata(ROLES_KEY, handler(name))).toEqual(["admin"]);
    },
  );

  it("đăng ký tài khoản (POST /users) là API công khai", () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler("create"))).toBe(true);
  });
});
