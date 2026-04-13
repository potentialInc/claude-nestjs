import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

/**
 * LoggingInterceptor — logs incoming requests and response times.
 *
 * Output: [HTTP] GET /api/users 200 +45ms
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger('HTTP');

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const { method, url } = request;
        const now = Date.now();

        return next.handle().pipe(
            tap(() => {
                const response = context.switchToHttp().getResponse();
                const duration = Date.now() - now;
                this.logger.log(
                    `${method} ${url} ${response.statusCode} +${duration}ms`,
                );
            }),
            catchError((err) => {
                const duration = Date.now() - now;
                this.logger.error(
                    `${method} ${url} ${err.status || 500} +${duration}ms — ${err.message}`,
                );
                return throwError(() => err);
            }),
        );
    }
}
