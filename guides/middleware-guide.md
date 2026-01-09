# Middleware Guide - NestJS Guards, Interceptors & Pipes

Complete guide to NestJS middleware patterns including guards, interceptors, pipes, and exception filters.

## Table of Contents

- [NestJS Middleware Overview](#nestjs-middleware-overview)
- [Guards](#guards)
- [Interceptors](#interceptors)
- [Pipes](#pipes)
- [Exception Filters](#exception-filters)
- [Execution Order](#execution-order)
- [Custom Decorators](#custom-decorators)

---

## NestJS Middleware Overview

### Four Types of Middleware

NestJS uses different middleware types, each serving a specific purpose:

```
Request Flow:
1. Middleware (Express-style)
2. Guards (authentication/authorization)
3. Interceptors (before)
4. Pipes (validation/transformation)
5. Controller Method
6. Interceptors (after)
7. Exception Filters (if error)
```

---

## Guards

### Purpose of Guards

Guards determine whether a request should be handled by the route handler:

- ✅ Authentication (is user logged in?)
- ✅ Authorization (does user have permission?)
- ✅ Role-based access control

### JwtAuthGuard Implementation

```typescript
// src/core/guards/jwt-auth.guard.ts
import {
    Injectable,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(private reflector: Reflector) {
        super();
    }

    canActivate(context: ExecutionContext) {
        // Check if route is marked as @Public()
        const isPublic = this.reflector.getAllAndOverride<boolean>(
            IS_PUBLIC_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (isPublic) {
            return true; // Skip authentication for public routes
        }

        // Execute passport JWT strategy
        return super.canActivate(context);
    }

    handleRequest(err: any, user: any, info: any) {
        if (err || !user) {
            throw err || new UnauthorizedException('Invalid or expired token');
        }
        return user;
    }
}
```

### JWT Strategy

```typescript
// src/modules/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { envConfigService } from 'src/config/env-config.service';
import { IJwtPayload } from '@shared/interfaces';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                (request: Request) => {
                    // Extract JWT from httpOnly cookie
                    return request?.cookies?.access_token;
                },
            ]),
            ignoreExpiration: false,
            secretOrKey: envConfigService.get('JWT_SECRET'),
        });
    }

    async validate(payload: any): Promise<IJwtPayload> {
        if (!payload.userId) {
            throw new UnauthorizedException('Invalid token payload');
        }

        return {
            userId: payload.userId,
            email: payload.email,
            roles: payload.roles || [],
        };
    }
}
```

### RolesGuard Implementation

```typescript
// src/core/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<string[]>(
            ROLES_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (!requiredRoles) {
            return true; // No roles required
        }

        const { user } = context.switchToHttp().getRequest();

        if (!user) {
            return false; // No user in request
        }

        // Check if user has at least one required role
        return requiredRoles.some((role) => user.roles?.includes(role));
    }
}
```

### Using Guards

```typescript
// Apply globally in main.ts
import { APP_GUARD } from '@nestjs/core';

@Module({
    providers: [
        {
            provide: APP_GUARD,
            useClass: JwtAuthGuard,
        },
        {
            provide: APP_GUARD,
            useClass: RolesGuard,
        },
    ],
})
export class AppModule {}

// Use @Public() to bypass authentication
@Public()
@Post('register')
async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
}

// Use @Roles() for authorization
@Roles('admin')
@Delete(':id')
async remove(@Param('id') id: string) {
    return this.userService.remove(id);
}
```

---

## Interceptors

### Purpose of Interceptors

Interceptors can:

- ✅ Transform responses
- ✅ Add extra logic before/after method execution
- ✅ Handle errors
- ✅ Override return values
- ✅ Add logging/timing

### TransformInterceptor (Response Wrapper)

```typescript
// src/core/interceptors/transform.interceptor.ts
import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ResponsePayloadDto } from '@shared/dtos';

@Injectable()
export class TransformInterceptor<T>
    implements NestInterceptor<T, ResponsePayloadDto<T>>
{
    intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Observable<ResponsePayloadDto<T>> {
        const request = context.switchToHttp().getRequest();

        return next.handle().pipe(
            map((data) => {
                // If data is already wrapped in ResponsePayloadDto, return as is
                if (data?.success !== undefined) {
                    return data;
                }

                // Wrap response in standard format
                return {
                    success: true,
                    statusCode: context.switchToHttp().getResponse().statusCode,
                    message: data?.message || 'Operation successful',
                    data: data?.data || data,
                    timestamp: new Date().toISOString(),
                    path: request.url,
                };
            }),
        );
    }
}
```

### LoggingInterceptor

```typescript
// src/core/interceptors/logging.interceptor.ts
import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger(LoggingInterceptor.name);

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const method = request.method;
        const url = request.url;
        const now = Date.now();

        return next.handle().pipe(
            tap({
                next: () => {
                    const response = context.switchToHttp().getResponse();
                    const delay = Date.now() - now;
                    this.logger.log(
                        `${method} ${url} ${response.statusCode} - ${delay}ms`,
                    );
                },
                error: (error) => {
                    const delay = Date.now() - now;
                    this.logger.error(
                        `${method} ${url} ${error.status || 500} - ${delay}ms`,
                    );
                },
            }),
        );
    }
}
```

### SetToken Interceptor (Cookie Management)

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

@Injectable()
export class SetTokenInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        return next.handle().pipe(
            tap((data) => {
                if (data?.accessToken) {
                    const response = context.switchToHttp().getResponse();

                    // Set access token cookie
                    response.cookie('access_token', data.accessToken, {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'strict',
                        maxAge: 15 * 60 * 1000, // 15 minutes
                    });

                    // Set refresh token cookie
                    if (data.refreshToken) {
                        response.cookie('refresh_token', data.refreshToken, {
                            httpOnly: true,
                            secure: process.env.NODE_ENV === 'production',
                            sameSite: 'strict',
                            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
                        });
                    }
                }
            }),
        );
    }
}
```

### Using Interceptors

```typescript
// Apply globally in main.ts
app.useGlobalInterceptors(
    new TransformInterceptor(),
    new LoggingInterceptor(),
);

// Apply to specific controller
@UseInterceptors(SetTokenInterceptor)
@Post('login')
async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
}

// Apply to specific method
@UseInterceptors(CacheInterceptor)
@Get()
async findAll() {
    return this.userService.findAll();
}
```

---

## Pipes

### Purpose of Pipes

Pipes can:

- ✅ Validate input data
- ✅ Transform input data
- ✅ Parse parameters

### ValidationPipe (Global)

```typescript
// src/main.ts
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true, // Strip non-DTO properties
            forbidNonWhitelisted: true, // Throw error on extra properties
            transform: true, // Auto-transform to DTO class
            transformOptions: {
                enableImplicitConversion: true,
            },
        }),
    );

    await app.listen(4000);
}
```

### Built-in Pipes

```typescript
import { ParseUUIDPipe, ParseIntPipe, ParseBoolPipe } from '@nestjs/common';

@Get(':id')
async findOne(
    @Param('id', ParseUUIDPipe) id: string,  // Validates UUID format
) {
    return this.userService.findById(id);
}

@Get()
async findAll(
    @Query('page', ParseIntPipe) page: number,  // Parses string to number
    @Query('active', ParseBoolPipe) active: boolean,
) {
    return this.userService.findAll(page, active);
}
```

### Custom Pipe

```typescript
// src/core/pipes/trim.pipe.ts
import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class TrimPipe implements PipeTransform {
    transform(value: any, metadata: ArgumentMetadata) {
        if (typeof value === 'string') {
            return value.trim();
        }

        if (typeof value === 'object' && value !== null) {
            Object.keys(value).forEach((key) => {
                if (typeof value[key] === 'string') {
                    value[key] = value[key].trim();
                }
            });
        }

        return value;
    }
}

// Usage
@Post()
async create(@Body(TrimPipe) dto: CreateUserDto) {
    return this.userService.create(dto);
}
```

---

## Exception Filters

### Purpose of Exception Filters

Filters handle exceptions and format error responses:

- ✅ Catch all unhandled exceptions
- ✅ Format error responses
- ✅ Log errors
- ✅ Send to error tracking (Sentry)

### AllExceptionsFilter

```typescript
// src/core/filters/all-exceptions.filter.ts
import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        const message =
            exception instanceof HttpException
                ? exception.message
                : 'Internal server error';

        // Log error
        this.logger.error(
            `${request.method} ${request.url}`,
            exception instanceof Error ? exception.stack : exception,
        );

        // Send response
        response.status(status).json({
            success: false,
            statusCode: status,
            message,
            timestamp: new Date().toISOString(),
            path: request.url,
        });
    }
}
```

### HttpExceptionFilter

```typescript
// src/core/filters/http-exception.filter.ts
import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
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
        const status = exception.getStatus();
        const exceptionResponse = exception.getResponse();

        // Log error
        this.logger.warn(
            `${request.method} ${request.url} - ${status} - ${exception.message}`,
        );

        // Format response
        response.status(status).json({
            success: false,
            statusCode: status,
            message:
                typeof exceptionResponse === 'string'
                    ? exceptionResponse
                    : (exceptionResponse as any).message,
            errors:
                typeof exceptionResponse === 'object'
                    ? (exceptionResponse as any).errors
                    : undefined,
            timestamp: new Date().toISOString(),
            path: request.url,
        });
    }
}
```

### Using Exception Filters

```typescript
// Apply globally in main.ts
app.useGlobalFilters(
    new AllExceptionsFilter(),
    new HttpExceptionFilter(),
);

// Apply to specific controller
@UseFilters(HttpExceptionFilter)
@Controller('users')
export class UserController {}

// Apply to specific method
@UseFilters(new HttpExceptionFilter())
@Get(':id')
async findOne(@Param('id') id: string) {}
```

---

## Execution Order

### Complete Request Lifecycle

```typescript
// 1. Middleware (Express-style)
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        console.log('Request...');
        next();
    }
}

// 2. Guards
@UseGuards(JwtAuthGuard, RolesGuard)

// 3. Interceptors (before)
@UseInterceptors(LoggingInterceptor)

// 4. Pipes
@UsePipes(ValidationPipe)

// 5. Controller Method Execution
async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
}

// 6. Interceptors (after)
// TransformInterceptor wraps response

// 7. Exception Filters (if error occurs)
// HttpExceptionFilter or AllExceptionsFilter
```

### Global vs Local Application

```typescript
// Global (main.ts)
app.useGlobalGuards(new JwtAuthGuard());
app.useGlobalInterceptors(new TransformInterceptor());
app.useGlobalPipes(new ValidationPipe());
app.useGlobalFilters(new AllExceptionsFilter());

// Controller-level
@UseGuards(RolesGuard)
@UseInterceptors(LoggingInterceptor)
@Controller('users')
export class UserController {}

// Method-level
@UseGuards(SpecificGuard)
@UseInterceptors(CacheInterceptor)
@Get(':id')
async findOne() {}
```

---

## Custom Decorators

### @Public() Decorator

```typescript
// src/core/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

### @Roles() Decorator

```typescript
// src/core/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

### @CurrentUser() Decorator

```typescript
// src/core/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { IJwtPayload } from '@shared/interfaces';

export const CurrentUser = createParamDecorator(
    (data: unknown, ctx: ExecutionContext): IJwtPayload => {
        const request = ctx.switchToHttp().getRequest();
        return request.user;
    },
);
```

### @ApiSwagger() Decorator

```typescript
// src/core/decorators/api-swagger.decorator.ts
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

export function ApiSwagger(options: {
    resourceName: string;
    operation: string;
    responseDto?: any;
    requiresAuth?: boolean;
}) {
    const decorators = [
        ApiOperation({
            summary: `${options.operation} ${options.resourceName}`,
        }),
        ApiResponse({
            status: 200,
            description: 'Success',
            type: options.responseDto,
        }),
    ];

    if (options.requiresAuth !== false) {
        decorators.push(ApiBearerAuth());
    }

    return applyDecorators(...decorators);
}
```

---

## Best Practices Summary

### ✅ DO:

- Use guards for authentication/authorization
- Use interceptors for response transformation
- Use pipes for validation/transformation
- Use exception filters for error handling
- Apply middleware in correct order
- Use custom decorators for cleaner code
- Log errors appropriately
- Use global configurations in main.ts
- Implement proper error responses

### ❌ DON'T:

- Put business logic in guards/interceptors
- Skip validation on user input
- Forget to handle errors
- Mix concerns between middleware types
- Apply guards/interceptors unnecessarily
- Expose sensitive error details
- Skip logging important events
- Use synchronous operations in middleware
- Forget to call next() in middleware

---

**Related Files:**

- [SKILL.md](../SKILL.md) - Main guide
- [routing-and-controllers.md](routing-and-controllers.md) - Controllers and decorators
- [async-and-errors.md](async-and-errors.md) - Error handling patterns
- [authentication-guide.md](../../docs/AUTHENTICATION-GUIDE.md) - JWT authentication details
