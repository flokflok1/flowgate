import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import type { AuthUser } from '../../shared/types/auth-user';
import { Request } from '../domain/entities/request';
import { CreateRequestDto } from './dto/create-request.dto';
import { ManageRequestsUseCase } from './manage-requests.use-case';

@Controller('requests')
export class RequestsController {
  constructor(private readonly useCase: ManageRequestsUseCase) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<Request[]> {
    return this.useCase.list(user);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Request> {
    return this.useCase.get(user, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateRequestDto,
  ): Promise<Request> {
    return this.useCase.create(user, dto);
  }

  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateRequestDto,
  ): Promise<Request> {
    return this.useCase.update(user, id, dto);
  }

  @Post(':id/submit')
  @HttpCode(200)
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Request> {
    return this.useCase.submit(user, id);
  }
}
