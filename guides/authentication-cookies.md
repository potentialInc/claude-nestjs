# Authentication with HTTP-Only Cookies

This guide covers the secure authentication pattern using HTTP-only cookies instead of localStorage for JWT tokens.

## Why HTTP-Only Cookies?

### Security Benefits

| Feature | localStorage | HTTP-Only Cookie |
|---------|-------------|------------------|
| XSS Protection | ❌ Vulnerable | ✅ Protected |
| CSRF Protection | ✅ N/A | ⚠️ Needs SameSite |
| Automatic Sending | ❌ Manual | ✅ Automatic |
| JavaScript Access | ✅ Accessible | ❌ Not accessible |

**NEVER use localStorage for JWT tokens.** HTTP-only cookies prevent XSS attacks from stealing tokens.

---

## Backend Implementation

### 1. JWT Strategy (Extract from Cookie)

```typescript
// src/core/guards/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { envConfigService } from '../../config/env-config.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                // First try cookie
                JwtStrategy.extractJWTFromCookie,
                // Fallback to Bearer token (for API clients)
                ExtractJwt.fromAuthHeaderAsBearerToken(),
            ]),
            ignoreExpiration: false,
            secretOrKey: envConfigService.getAuthJWTConfig().AUTH_JWT_SECRET,
        });
    }

    private static extractJWTFromCookie(
        this: void,
        req: Request,
    ): string | null {
        const cookieName =
            envConfigService.getAuthJWTConfig().AUTH_TOKEN_COOKIE_NAME ||
            'accessToken';
        if (req.cookies && req.cookies[cookieName]) {
            return req.cookies[cookieName];
        }
        return null;
    }

    validate(payload: any) {
        if (!payload.id || !payload.email) {
            throw new UnauthorizedException('Invalid token payload');
        }

        return {
            id: payload.sub,
            email: payload.email,
            role: payload.role,
            firstName: payload.firstName,
            lastName: payload.lastName,
        };
    }
}
```

### 2. SetToken Interceptor (Set Cookies on Login)

```typescript
// src/core/interceptors/set-token.interceptor.ts
import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { envConfigService } from '../../config/env-config.service';

@Injectable()
export class SetTokenInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        return next.handle().pipe(
            tap((data) => {
                if (data?.accessToken) {
                    const response = context.switchToHttp().getResponse();
                    const authConfig = envConfigService.getAuthJWTConfig();
                    const isProduction = process.env.MODE === 'PROD';

                    // Set access token cookie
                    response.cookie(
                        authConfig.AUTH_TOKEN_COOKIE_NAME || 'accessToken',
                        data.accessToken,
                        {
                            httpOnly: true,
                            secure: isProduction,
                            sameSite: isProduction ? 'strict' : 'lax',
                            maxAge: this.parseExpireTime(authConfig.AUTH_TOKEN_EXPIRE_TIME),
                            path: '/',
                        },
                    );

                    // Set refresh token cookie (longer expiration)
                    if (data.refreshToken) {
                        response.cookie(
                            authConfig.AUTH_REFRESH_TOKEN_COOKIE_NAME || 'refreshToken',
                            data.refreshToken,
                            {
                                httpOnly: true,
                                secure: isProduction,
                                sameSite: isProduction ? 'strict' : 'lax',
                                maxAge: this.parseExpireTime(authConfig.AUTH_REFRESH_TOKEN_EXPIRE_TIME),
                                path: '/',
                            },
                        );
                    }
                }
            }),
        );
    }

    private parseExpireTime(expireTime: string): number {
        const match = expireTime.match(/^(\d+)(h|d|m|s)?$/);
        if (!match) return 24 * 60 * 60 * 1000; // Default 24h

        const value = parseInt(match[1], 10);
        const unit = match[2] || 'h';

        switch (unit) {
            case 's': return value * 1000;
            case 'm': return value * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            case 'd': return value * 24 * 60 * 60 * 1000;
            default: return value * 60 * 60 * 1000;
        }
    }
}
```

### 3. Auth Controller (Apply Interceptor)

```typescript
// src/modules/auth/auth.controller.ts
import { Controller, Post, Body, Get, UseInterceptors, Res } from '@nestjs/common';
import { Response } from 'express';
import { SetTokenInterceptor } from '@core/interceptors/set-token.interceptor';
import { Public } from '@core/decorators/public.decorator';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Public()
    @Post('login')
    @UseInterceptors(SetTokenInterceptor)
    async login(@Body() loginDto: LoginDto) {
        // Service returns { accessToken, refreshToken, user }
        return this.authService.login(loginDto);
    }

    @Public()
    @Post('register')
    @UseInterceptors(SetTokenInterceptor)
    async register(@Body() registerDto: RegisterDto) {
        return this.authService.register(registerDto);
    }

    @Public()
    @Get('refresh-access-token')
    @UseInterceptors(SetTokenInterceptor)
    async refreshToken(@Req() req: Request) {
        const refreshToken = req.cookies?.refreshToken;
        return this.authService.refreshAccessToken(refreshToken);
    }

    @Post('logout')
    async logout(@Res({ passthrough: true }) response: Response) {
        // Clear cookies on logout
        response.clearCookie('accessToken', { path: '/' });
        response.clearCookie('refreshToken', { path: '/' });
        return { success: true, message: 'Logged out successfully' };
    }
}
```

### 4. Main.ts Configuration

```typescript
// src/main.ts
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Enable cookie parsing
    app.use(cookieParser());

    // CORS configuration for cookies
    app.enableCors({
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        credentials: true, // Required for cookies
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    });

    await app.listen(3000);
}
```

---

## Frontend Implementation

### HTTP Service with Cookie Support

```typescript
// frontend/app/services/httpService.ts
import axios from 'axios';
import type {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';

class HttpService {
  private api: AxiosInstance;
  private isRefreshing = false;
  private refreshSubscribers: (() => void)[] = [];

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
      withCredentials: true, // CRITICAL: Enable cookies
    });

    // Request interceptor - NO TOKEN HANDLING NEEDED
    // httpOnly cookies are automatically included
    this.api.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        if (config.data instanceof FormData) {
          delete config.headers['Content-Type'];
        }
        return config;
      },
      (error: AxiosError) => Promise.reject(error)
    );

    // Response interceptor with token refresh
    this.api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // Skip refresh for auth endpoints
        const authEndpoints = ['/auth/login', '/auth/register', '/auth/refresh-access-token'];
        const isAuthEndpoint = authEndpoints.some(endpoint =>
          originalRequest?.url?.includes(endpoint)
        );

        if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
          if (this.isRefreshing) {
            return new Promise((resolve) => {
              this.refreshSubscribers.push(() => resolve(this.api(originalRequest)));
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            // Backend sets new cookie automatically
            await this.api.get('/auth/refresh-access-token');

            this.refreshSubscribers.forEach((callback) => callback());
            this.refreshSubscribers = [];

            return this.api(originalRequest);
          } catch (refreshError) {
            const authPaths = ['/login', '/register', '/forgot-password'];
            if (!authPaths.some(path => window.location.pathname === path)) {
              window.location.href = '/login';
            }
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // HTTP methods...
}

export const httpService = new HttpService();
```

---

## Environment Configuration

### Backend (.env)

```env
# JWT Configuration
AUTH_JWT_SECRET=your-secure-secret-key
AUTH_TOKEN_COOKIE_NAME=accessToken
AUTH_TOKEN_EXPIRE_TIME=24h
AUTH_TOKEN_EXPIRED_TIME_REMEMBER_ME=30d
AUTH_REFRESH_TOKEN_COOKIE_NAME=refreshToken
AUTH_REFRESH_TOKEN_EXPIRE_TIME=7d

# CORS
FRONTEND_URL=http://localhost:5173
MODE=DEV
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:3000/api
```

---

## Cookie Settings Reference

| Setting | Development | Production |
|---------|-------------|------------|
| httpOnly | true | true |
| secure | false | true |
| sameSite | 'lax' | 'strict' |
| path | '/' | '/' |

---

## Checklist

### Backend
- [ ] Install `cookie-parser`: `npm install cookie-parser`
- [ ] Add `app.use(cookieParser())` in main.ts
- [ ] Configure CORS with `credentials: true`
- [ ] JWT Strategy extracts token from cookie
- [ ] SetTokenInterceptor sets httpOnly cookies
- [ ] Logout endpoint clears cookies

### Frontend
- [ ] Axios configured with `withCredentials: true`
- [ ] NO localStorage token handling
- [ ] Token refresh interceptor implemented
- [ ] Redirect to login on refresh failure

---

**Related Guides:**
- [middleware-guide.md](middleware-guide.md) - Guards and interceptors
- [routing-and-controllers.md](routing-and-controllers.md) - Controller patterns
