import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthUser } from '../../shared/types/auth-user';
import { USER_REPOSITORY } from '../../users/domain/repositories/user.repository';
import type { UserRepository } from '../../users/domain/repositories/user.repository';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly jwt: JwtService,
  ) {}

  async execute(dto: LoginDto): Promise<{ accessToken: string }> {
    const user = await this.users.findByEmail(dto.email.toLowerCase());
    const passwordOk =
      user !== null && (await bcrypt.compare(dto.password, user.passwordHash));
    if (!user || !passwordOk) {
      // same error for both cases — don't leak which emails exist
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload: AuthUser = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return { accessToken: await this.jwt.signAsync({ ...payload }) };
  }
}
