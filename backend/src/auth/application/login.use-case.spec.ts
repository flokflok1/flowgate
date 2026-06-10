import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../../users/domain/entities/user';
import { Role } from '../../users/domain/value-objects/role';
import { UserRepository } from '../../users/domain/repositories/user.repository';
import { LoginUseCase } from './login.use-case';

describe('LoginUseCase', () => {
  const jwt = {
    signAsync: jest.fn().mockResolvedValue('signed.jwt'),
  } as unknown as JwtService;
  let user: User;

  beforeAll(async () => {
    user = new User(
      'u1',
      'admin@flowgate.demo',
      await bcrypt.hash('Demo1234!', 4),
      Role.Admin,
      new Date(),
    );
  });

  const repoWith = (found: User | null): UserRepository => ({
    findByEmail: jest.fn().mockResolvedValue(found),
    findById: jest.fn(),
    findAll: jest.fn(),
  });

  it('returns an access token for valid credentials', async () => {
    const useCase = new LoginUseCase(repoWith(user), jwt);
    const result = await useCase.execute({
      email: 'admin@flowgate.demo',
      password: 'Demo1234!',
    });
    expect(result).toEqual({ accessToken: 'signed.jwt' });
  });

  it('rejects a wrong password', async () => {
    const useCase = new LoginUseCase(repoWith(user), jwt);
    await expect(
      useCase.execute({ email: 'admin@flowgate.demo', password: 'wrong-pass' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an unknown email', async () => {
    const useCase = new LoginUseCase(repoWith(null), jwt);
    await expect(
      useCase.execute({ email: 'ghost@flowgate.demo', password: 'Demo1234!' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
