import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Public } from '../shared/decorators/public.decorator';
import { LoginDto } from './application/dto/login.dto';
import { LoginUseCase } from './application/login.use-case';

@Controller('auth')
export class AuthController {
  constructor(private readonly loginUseCase: LoginUseCase) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto): Promise<{ accessToken: string }> {
    return this.loginUseCase.execute(dto);
  }
}
