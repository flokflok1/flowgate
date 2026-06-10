import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user';
import { UserRepository } from '../../domain/repositories/user.repository';
import { UserOrmEntity } from '../persistence/user.orm-entity';

@Injectable()
export class TypeormUserRepository implements UserRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly repo: Repository<UserOrmEntity>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.toDomain(await this.repo.findOneBy({ email }));
  }

  async findById(id: string): Promise<User | null> {
    return this.toDomain(await this.repo.findOneBy({ id }));
  }

  async findAll(): Promise<User[]> {
    const rows = await this.repo.find({ order: { createdAt: 'ASC' } });
    return rows.map(
      (row) =>
        new User(row.id, row.email, row.passwordHash, row.role, row.createdAt),
    );
  }

  private toDomain(row: UserOrmEntity | null): User | null {
    if (!row) return null;
    return new User(
      row.id,
      row.email,
      row.passwordHash,
      row.role,
      row.createdAt,
    );
  }
}
