import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { Company } from './entities/company.entity';
import { UsersModule } from '../users/users.module';
import { RedisModule } from "../redis/redis.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Company]),
    UsersModule,
    RedisModule,
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}