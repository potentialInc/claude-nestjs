import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { catchError, map, Observable, throwError } from "rxjs";

/**
 * RemoveTokenInterceptor — clears httpOnly auth cookies on logout.
 *
 * Usage: @UseInterceptors(RemoveTokenInterceptor) on the logout endpoint.
 *
 * Sets both access and refresh token cookies to empty strings,
 * and strips sensitive data from the response.
 */
@Injectable()
export class RemoveTokenInterceptor implements NestInterceptor {
  constructor(private readonly configService: ConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const res = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((value) => {
        if (value?.success) {
          // Clear access token cookie
          res.cookie(
            this.configService.getOrThrow<string>("AUTH_TOKEN_COOKIE_NAME"),
            "",
            {
              httpOnly: true,
              path: "/",
            },
          );

          // Clear refresh token cookie
          res.cookie(
            this.configService.getOrThrow<string>(
              "AUTH_REFRESH_TOKEN_COOKIE_NAME",
            ),
            "",
            {
              httpOnly: true,
              path: "/",
            },
          );

          // Strip sensitive data — only return success + message
          return {
            success: true,
            message: value.message || "Logged out successfully",
          };
        }

        return value;
      }),
      catchError((err) => {
        return throwError(() => err);
      }),
    );
  }
}
