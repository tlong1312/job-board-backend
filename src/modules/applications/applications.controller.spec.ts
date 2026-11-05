import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { RedisService } from "../redis/redis.service";
import { ROLES_KEY } from 'commons/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from 'commons/decorators/public.decorator';

describe('ApplicationsController', () => {
  let controller: ApplicationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApplicationsController],
      providers: [
        { provide: ApplicationsService, useValue: {} },
        { provide: RedisService, useValue: { hit: jest.fn() } },
      ],
    }).compile();

    controller = module.get<ApplicationsController>(ApplicationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it.each(['findAll', 'findOne', 'getHistory'] as const)('requires authentication and viewer roles on %s', (method) => {
    // Read the original handler for metadata inspection without invoking it.
    const handler: unknown = Object.getOwnPropertyDescriptor(ApplicationsController.prototype, method)?.value;
    if (typeof handler !== 'function') {
      throw new Error(`Missing controller handler: ${method}`);
    }
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).not.toBe(true);
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(['candidate', 'employer', 'admin']);
  });
});
