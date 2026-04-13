import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ResponsePayload<T> {
    success: boolean;
    statusCode: number;
    message: string;
    data: T;
    timestamp: string;
    path: string;
}

/**
 * TransformInterceptor — wraps all responses in a consistent
 * { success, statusCode, message, data, timestamp, path } envelope.
 *
 * Skips wrapping if the response already has a `success` property
 * (e.g., from ResponsePayloadDto) to avoid double-wrapping.
 */
@Injectable()
export class TransformInterceptor<T>
    implements NestInterceptor<T, ResponsePayload<T>>
{
    intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Observable<ResponsePayload<T>> {
        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();

        return next.handle().pipe(
            map((data) => {
                // Skip if already wrapped (has success property)
                if (data && typeof data === 'object' && 'success' in data) {
                    return data;
                }

                return {
                    success: true,
                    statusCode: response.statusCode,
                    message: 'Success',
                    data,
                    timestamp: new Date().toISOString(),
                    path: request.url,
                };
            }),
        );
    }
}
