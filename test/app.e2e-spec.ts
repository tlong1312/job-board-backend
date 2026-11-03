import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AuthService } from './../src/modules/auth/auth.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // This test covers the root HTTP response; token verification is mocked.
    jest.spyOn(moduleFixture.get(AuthService), 'verifyAccessToken')
      .mockResolvedValue({ sub: 1, email: 'candidate@example.com', role: 'candidate' });

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .set('Authorization', 'Bearer e2e-test-token')
      .expect(200)
      .expect('Hello World!');
  });

  afterEach(async () => {
    await app?.close();
    jest.restoreAllMocks();
  });
});
