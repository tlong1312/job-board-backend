import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { ROLES_KEY } from 'commons/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from 'commons/decorators/public.decorator';

describe('ApplicationsController', () => {
  let controller: ApplicationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApplicationsController],
      providers: [{ provide: ApplicationsService, useValue: {} }],
    }).compile();

    controller = module.get<ApplicationsController>(ApplicationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it.each(['findAll', 'findOne', 'getHistory'] as const)('requires authentication and viewer roles on %s', (method) => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, controller[method])).not.toBe(true);
    expect(Reflect.getMetadata(ROLES_KEY, controller[method])).toEqual(['candidate', 'employer', 'admin']);
  });
});
