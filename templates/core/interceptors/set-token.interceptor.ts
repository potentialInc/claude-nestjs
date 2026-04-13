import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { catchError, map, Observable, throwError } from "rxjs";

/**
 * SetTokenInterceptor — automatically sets httpOnly cookies when the service
 * returns a response containing a token.
 *
 * Usage: @UseInterceptors(SetTokenInterceptor) on login/register/refresh endpoints.
 *
 * The service must return: { success: true, data: { token: '...' } }
 * or the interceptor will pass the response through unchanged.
 */
@Injectable()
export class SetTokenInterceptor implements NestInterceptor {
  constructor(private readonly configService: ConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const res = context.switchToHttp().getResponse();
    const isProduction = this.configService.get<string>("MODE") === "PROD";

    return next.handle().pipe(
      map((value) => {
        if (value?.success && value?.data?.token) {
          res.cookie(
            this.configService.getOrThrow<string>("AUTH_TOKEN_COOKIE_NAME"),
            value.data.token,
            {
              httpOnly: true,
              secure: isProduction,
              sameSite: isProduction ? "strict" : "none",
              path: "/",
            },
          );
        }

        // Also handle refreshToken if present
        if (value?.success && value?.data?.refreshToken) {
          res.cookie(
            this.configService.getOrThrow<string>(
              "AUTH_REFRESH_TOKEN_COOKIE_NAME",
            ),
            value.data.refreshToken,
            {
              httpOnly: true,
              secure: isProduction,
              sameSite: isProduction ? "strict" : "none",
              path: "/",
            },
          );
        }

        return value;
      }),
      catchError((err) => {
        return throwError(() => err);
      }),
    );
  }
}
