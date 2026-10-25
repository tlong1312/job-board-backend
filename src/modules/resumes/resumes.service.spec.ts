import { Test, TestingModule } from '@nestjs/testing';
import { ResumesService } from './resumes.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Resume } from './entities/resume.entity';
import { UsersService } from '../users/users.service';

describe('ResumesService', () => {
  let service: ResumesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResumesService,
        {
          provide: getRepositoryToken(Resume),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            delete: jest.fn(),
          },
        },
        { provide: UsersService, useValue: { findOne: jest.fn() } },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
      ],
    }).compile();

    service = module.get<ResumesService>(ResumesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
