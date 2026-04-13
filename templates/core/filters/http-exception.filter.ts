import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    catch(exception: HttpException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();
        const status = exception.getStatus
            ? exception.getStatus()
            : HttpStatus.INTERNAL_SERVER_ERROR;

        const exceptionResponse = exception.getResponse();

        // Handle validation errors (class-validator returns { message: string[] })
        let message: string | string[];
        if (typeof exceptionResponse === 'string') {
            message = exceptionResponse;
        } else if (
            typeof exceptionResponse === 'object' &&
            'message' in exceptionResponse
        ) {
            message = (exceptionResponse as any).message;
        } else {
            message = exception.message;
        }

        this.logger.warn(
            `${request.method} ${request.url} ${status} — ${JSON.stringify(message)}`,
        );

        response.status(status).json({
            success: false,
            statusCode: status,
            message,
            data: null,
            timestamp: new Date().toISOString(),
            path: request.url,
        });
    }
}
