import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationsService } from './applications.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ApplicationEntity } from './entities/application.entity';
import { ApplicationStatusHistory } from './entities/application-status-history.entity';
import { JobsService } from '../jobs/jobs.service';
import { CompaniesService } from '../companies/companies.service';
import { ForBiddenException } from 'commons/error';
import { JwtUser } from 'commons/decorators/current-user.decorator';

describe('ApplicationsService', () => {
  let service: ApplicationsService;
  const repository = { findOne: jest.fn(), find: jest.fn() };
  const history = { find: jest.fn() };
  const jobs = { findOne: jest.fn() };
  const companies = { findOne: jest.fn() };
  const application = { id: 10, jobId: 20, candidateId: 30 };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        { provide: getRepositoryToken(ApplicationEntity), useValue: repository },
        { provide: getRepositoryToken(ApplicationStatusHistory), useValue: history },
        { provide: JobsService, useValue: jobs },
        { provide: CompaniesService, useValue: companies },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<ApplicationsService>(ApplicationsService);
    repository.findOne.mockResolvedValue(application);
    repository.find.mockResolvedValue([application]);
    history.find.mockResolvedValue([]);
    jobs.findOne.mockResolvedValue({ id: 20, companyId: 60, createdBy: 99 });
    companies.findOne.mockResolvedValue({ id: 60, ownerId: 40 });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it.each([
    { id: 30, role: 'candidate' },
    { id: 40, role: 'employer' },
    { id: 50, role: 'admin' },
  ] as JwtUser[])('allows an authorized $role to read detail and history', async (user) => {
    await expect(service.findOneForViewer(10, user)).resolves.toEqual(application);
    await expect(service.getHistory(10, user)).resolves.toEqual([]);
  });

  it.each([
    { id: 31, role: 'candidate' },
    { id: 41, role: 'employer' },
  ] as JwtUser[])('rejects an unrelated $role for detail and history', async (user) => {
    await expect(service.findOneForViewer(10, user)).rejects.toBeInstanceOf(ForBiddenException);
    await expect(service.getHistory(10, user)).rejects.toBeInstanceOf(ForBiddenException);
    expect(history.find).not.toHaveBeenCalled();
  });

  it('limits candidate lists to the current user even with another jobId', async () => {
    await service.findAll({ id: 30, role: 'candidate' }, 999);
    expect(repository.find).toHaveBeenCalledWith({ where: { candidateId: 30 }, order: { createdAt: 'DESC' } });
  });

  it('uses company ownership instead of the job creator for employer lists', async () => {
    await service.findAll({ id: 40, role: 'employer' }, 20);
    expect(companies.findOne).toHaveBeenCalledWith(60);
    expect(repository.find).toHaveBeenCalledWith({ where: { jobId: 20 }, order: { createdAt: 'DESC' } });
  });

  it('rejects employer lists for another company', async () => {
    await expect(service.findAll({ id: 41, role: 'employer' }, 20)).rejects.toBeInstanceOf(ForBiddenException);
    expect(repository.find).not.toHaveBeenCalled();
  });

  it('allows admin to list all applications or filter by job', async () => {
    await service.findAll({ id: 50, role: 'admin' });
    expect(repository.find).toHaveBeenLastCalledWith({ where: {}, order: { createdAt: 'DESC' } });
    await service.findAll({ id: 50, role: 'admin' }, 20);
    expect(repository.find).toHaveBeenLastCalledWith({ where: { jobId: 20 }, order: { createdAt: 'DESC' } });
    expect(jobs.findOne).not.toHaveBeenCalled();
  });
});
