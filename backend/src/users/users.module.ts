import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { USER_REPOSITORY } from './domain/repositories/user.repository';
import { UserOrmEntity } from './infrastructure/persistence/user.orm-entity';
import { TypeormUserRepository } from './infrastructure/repositories/typeorm-user.repository';

@Module({
  imports: [TypeOrmModule.forFeature([UserOrmEntity])],
  providers: [{ provide: USER_REPOSITORY, useClass: TypeormUserRepository }],
  exports: [USER_REPOSITORY],
})
export class UsersModule {}
