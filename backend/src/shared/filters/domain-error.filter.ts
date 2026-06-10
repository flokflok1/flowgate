import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  NotRequestOwner,
  RequestNotEditable,
} from '../../requests/domain/errors';

// Translates framework-free domain errors into HTTP responses at the edge,
// so the domain layer never needs to know about status codes.
@Catch(NotRequestOwner, RequestNotEditable)
export class DomainErrorFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const [status, message] =
      exception instanceof NotRequestOwner
        ? [HttpStatus.FORBIDDEN, 'Not your request']
        : [
            HttpStatus.UNPROCESSABLE_ENTITY,
            'Request is not editable in its current status',
          ];
    response.status(status).json({ statusCode: status, message });
  }
}
