import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class ApiResponseFilter implements ExceptionFilter {
  private readonly logger = new Logger('VelonAPI');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const msg = (body as { message?: string | string[] }).message;
        if (Array.isArray(msg)) message = msg.join(', ');
        else if (typeof msg === 'string') message = msg;
        else if ('status' in body && typeof (body as { status?: string }).status === 'string') {
          message = (body as { status: string }).status;
        }
      }
    } else if (exception instanceof Error) {
      if (exception.name === 'PayloadTooLargeError') {
        status = HttpStatus.PAYLOAD_TOO_LARGE;
        message = 'Request payload is too large. Try a smaller product image (under 512 KB).';
      } else {
        this.logger.error(exception.message, exception.stack);
        if (process.env.NODE_ENV !== 'production' && exception.message) {
          message = exception.message;
        }
      }
    }

    const isProduction = process.env.NODE_ENV === 'production';
    if (status === HttpStatus.INTERNAL_SERVER_ERROR && isProduction) {
      message = 'An unexpected error occurred.';
    } else if (status >= 500 && isProduction && !(exception instanceof HttpException)) {
      message = 'An unexpected error occurred.';
    }

    res.status(status).json({ success: false, message });
  }
}
