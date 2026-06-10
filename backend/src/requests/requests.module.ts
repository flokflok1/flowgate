import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManageRequestsUseCase } from './application/manage-requests.use-case';
import { RequestsController } from './application/requests.controller';
import { REQUEST_REPOSITORY } from './domain/repositories/request.repository';
import { RequestOrmEntity } from './infrastructure/persistence/request.orm-entity';
import { TypeormRequestRepository } from './infrastructure/repositories/typeorm-request.repository';

@Module({
  imports: [TypeOrmModule.forFeature([RequestOrmEntity])],
  controllers: [RequestsController],
  providers: [
    { provide: REQUEST_REPOSITORY, useClass: TypeormRequestRepository },
    ManageRequestsUseCase,
  ],
  exports: [REQUEST_REPOSITORY],
})
export class RequestsModule {}
