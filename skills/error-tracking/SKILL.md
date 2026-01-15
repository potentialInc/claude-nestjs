---
skill_name: error-tracking
applies_to_local_project_only: true
auto_trigger_regex:
    [sentry, error tracking, performance monitoring, error handling]
tags: [sentry, errors, monitoring, nestjs, performance]
related_skills: [best-practices, middleware-guide, async-and-errors]
---

# Error Tracking with Sentry v8 - NestJS

Complete guide for integrating Sentry v8 error tracking and performance monitoring in NestJS applications. ALL ERRORS MUST BE CAPTURED TO SENTRY - no exceptions.

---

## Quick Start

### 1. Install Sentry v8

```bash
npm install @sentry/node @sentry/profiling-node
```

### 2. Create Instrument File

```typescript
// src/instrument.ts
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
});

export default Sentry;
```

### 3. Initialize BEFORE NestJS Application

```typescript
// src/main.ts
import './instrument'; // MUST be first import
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as Sentry from '@sentry/node';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Apply global exception filter that sends to Sentry
    const { SentryExceptionFilter } = await import(
        './core/filters/sentry-exception.filter'
    );
    app.useGlobalFilters(new SentryExceptionFilter());

    await app.listen(4000);
}
bootstrap();
```

---

## Exception Filter Integration

### Sentry Exception Filter

```typescript
// src/core/filters/sentry-exception.filter.ts
import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(SentryExceptionFilter.name);

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

        // Capture ALL errors to Sentry with context
        Sentry.withScope((scope) => {
            scope.setTag(
                'type',
                exception instanceof HttpException ? 'http' : 'unhandled',
            );
            scope.setTag('status_code', status.toString());
            scope.setContext('request', {
                method: request.method,
                url: request.url,
                headers: request.headers,
                body: request.body,
                query: request.query,
            });

            if (request.user) {
                scope.setUser({
                    id: (request.user as any).sub,
                    email: (request.user as any).email,
                });
            }

            Sentry.captureException(exception);
        });

        // Log the error
        this.logger.error(
            `${request.method} ${request.url} - ${status}`,
            exception instanceof Error ? exception.stack : exception,
        );

        // Send standardized response
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

---

## Controller Error Handling

### ❌ DON'T: Try/Catch in Controllers

```typescript
// ❌ BAD: Don't catch errors in controllers
@Controller('users')
export class UserController {
    @Get(':id')
    async findOne(@Param('id') id: string) {
        try {
            return await this.userService.findById(id);
        } catch (error) {
            // Don't do this! Exception filter will handle it
            Sentry.captureException(error);
            throw error;
        }
    }
}
```

### ✅ DO: Let Exception Filters Handle Errors

```typescript
// ✅ GOOD: Throw HTTP exceptions, let filter capture them
@Controller('users')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Get(':id')
    async findOne(@Param('id') id: string): Promise<User> {
        // Just throw - SentryExceptionFilter will capture it
        return await this.userService.findById(id);
    }

    @Post()
    async create(@Body() dto: CreateUserDto): Promise<User> {
        // Service throws NotFoundException, ConflictException, etc.
        // Filter captures all of them automatically
        return await this.userService.create(dto);
    }
}
```

---

## Service Error Handling

### Throw Meaningful HTTP Exceptions

```typescript
// src/modules/users/user.service.ts
import {
    Injectable,
    NotFoundException,
    ConflictException,
    InternalServerErrorException,
} from '@nestjs/common';
import { BaseService } from '@/core/base/base.service';
import { User } from './user.entity';
import { UserRepository } from './user.repository';
import * as Sentry from '@sentry/node';

@Injectable()
export class UserService extends BaseService<User> {
    constructor(protected readonly repository: UserRepository) {
        super(repository, 'User');
    }

    async findById(id: string): Promise<User> {
        const user = await this.repository.findOne({ where: { id } });

        if (!user) {
            // Throw HTTP exception - filter will capture to Sentry
            throw new NotFoundException(`User with ID ${id} not found`);
        }

        return user;
    }

    async createUser(data: CreateUserDto): Promise<User> {
        try {
            return await this.repository.save(data);
        } catch (error) {
            // Transform database errors to HTTP exceptions
            if (error.message.includes('duplicate key')) {
                throw new ConflictException('Email already exists');
            }

            // Capture unexpected errors with additional context
            Sentry.withScope((scope) => {
                scope.setTag('operation', 'create_user');
                scope.setContext('user_data', {
                    email: data.email,
                    role: data.role,
                });
                Sentry.captureException(error);
            });

            throw new InternalServerErrorException('Failed to create user');
        }
    }

    async processComplexOperation(userId: string): Promise<void> {
        const transaction = Sentry.startTransaction({
            op: 'user.process_complex_operation',
            name: 'Process Complex User Operation',
        });

        try {
            const span1 = transaction.startChild({ op: 'database.query' });
            const user = await this.findById(userId);
            span1.finish();

            const span2 = transaction.startChild({ op: 'business.logic' });
            // Complex business logic
            await this.performComplexLogic(user);
            span2.finish();

            transaction.setStatus('ok');
        } catch (error) {
            transaction.setStatus('internal_error');
            Sentry.captureException(error);
            throw error;
        } finally {
            transaction.finish();
        }
    }
}
```

---

## Database Performance Monitoring

### TypeORM Query Logging

```typescript
// src/core/monitoring/database-logger.ts
import { Logger } from 'typeorm';
import * as Sentry from '@sentry/node';
import { Logger as NestLogger } from '@nestjs/common';

export class SentryDatabaseLogger implements Logger {
    private readonly logger = new NestLogger('Database');
    private readonly slowQueryThreshold = 1000; // 1 second

    logQuery(query: string, parameters?: any[], queryRunner?: any) {
        const startTime = Date.now();

        return () => {
            const duration = Date.now() - startTime;

            if (duration > this.slowQueryThreshold) {
                this.logger.warn(
                    `Slow query detected (${duration}ms): ${query}`,
                );

                Sentry.withScope((scope) => {
                    scope.setTag('type', 'slow_query');
                    scope.setContext('query', {
                        sql: query,
                        parameters,
                        duration,
                    });
                    Sentry.captureMessage(
                        `Slow database query: ${duration}ms`,
                        'warning',
                    );
                });
            }
        };
    }

    logQueryError(error: string, query: string, parameters?: any[]) {
        this.logger.error(`Query error: ${error}`);

        Sentry.withScope((scope) => {
            scope.setTag('type', 'database_error');
            scope.setContext('query', {
                sql: query,
                parameters,
                error,
            });
            Sentry.captureException(new Error(error));
        });
    }

    logQuerySlow(time: number, query: string, parameters?: any[]) {
        this.logger.warn(`Slow query (${time}ms): ${query}`);
    }

    logSchemaBuild(message: string) {
        this.logger.log(message);
    }

    logMigration(message: string) {
        this.logger.log(message);
    }

    log(level: 'log' | 'info' | 'warn', message: any) {
        this.logger[level](message);
    }
}
```

### Configure in TypeORM Module

```typescript
// src/app.module.ts or database.config.ts
import { TypeOrmModule } from '@nestjs/typeorm';
import { SentryDatabaseLogger } from './core/monitoring/database-logger';

@Module({
    imports: [
        TypeOrmModule.forRoot({
            type: 'postgres',
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT || '5432'),
            username: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: false,
            logger: new SentryDatabaseLogger(),
            maxQueryExecutionTime: 1000, // Log queries > 1 second
        }),
    ],
})
export class AppModule {}
```

---

## Cron Job Instrumentation

### Instrument Background Jobs

```typescript
// src/modules/cron/cleanup.service.ts
import './../../instrument'; // Import at top
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as Sentry from '@sentry/node';

@Injectable()
export class CleanupService {
    private readonly logger = new Logger(CleanupService.name);

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async cleanupOldRecords() {
        const transaction = Sentry.startTransaction({
            op: 'cron.cleanup',
            name: 'Cleanup Old Records',
        });

        try {
            this.logger.log('Starting cleanup job');

            const span = transaction.startChild({ op: 'database.delete' });
            const result = await this.deleteOldRecords();
            span.finish();

            this.logger.log(`Cleaned up ${result.count} records`);

            transaction.setData('records_cleaned', result.count);
            transaction.setStatus('ok');
        } catch (error) {
            this.logger.error('Cleanup job failed', error);

            transaction.setStatus('internal_error');
            Sentry.captureException(error, {
                tags: { cron_job: 'cleanup' },
            });

            throw error;
        } finally {
            transaction.finish();
        }
    }

    @Cron('0 */6 * * *') // Every 6 hours
    async syncExternalData() {
        const checkInId = Sentry.captureCheckIn({
            monitorSlug: 'sync-external-data',
            status: 'in_progress',
        });

        try {
            await this.performSync();

            Sentry.captureCheckIn({
                checkInId,
                monitorSlug: 'sync-external-data',
                status: 'ok',
            });
        } catch (error) {
            Sentry.captureCheckIn({
                checkInId,
                monitorSlug: 'sync-external-data',
                status: 'error',
            });

            Sentry.captureException(error);
            throw error;
        }
    }
}
```

---

## Custom Context and Tags

### Add User Context in Guards

```typescript
// src/core/guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import * as Sentry from '@sentry/node';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    canActivate(context: ExecutionContext) {
        const request = context.switchToHttp().getRequest();

        // Add user context to Sentry for all authenticated requests
        const result = super.canActivate(context);

        if (result && request.user) {
            Sentry.setUser({
                id: request.user.sub,
                email: request.user.email,
                username: request.user.username,
            });
        }

        return result;
    }
}
```

### Add Custom Context in Interceptors

```typescript
// src/core/interceptors/sentry-context.interceptor.ts
import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import * as Sentry from '@sentry/node';

@Injectable()
export class SentryContextInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const handler = context.getHandler();
        const controller = context.getClass();

        // Add route context to Sentry
        Sentry.setContext('route', {
            controller: controller.name,
            handler: handler.name,
            method: request.method,
            url: request.url,
        });

        return next.handle().pipe(
            tap({
                error: (error) => {
                    // Additional context for errors
                    Sentry.setContext('error_location', {
                        controller: controller.name,
                        method: handler.name,
                    });
                },
            }),
        );
    }
}
```

---

## Testing Sentry Integration

### Test Endpoint (Development Only)

```typescript
// src/modules/health/health.controller.ts
import { Controller, Get, Post, ForbiddenException } from '@nestjs/common';
import { Public } from '@/core/decorators/public.decorator';
import * as Sentry from '@sentry/node';

@Controller('health')
export class HealthController {
    @Public()
    @Get()
    check() {
        return { status: 'ok' };
    }

    @Public()
    @Post('sentry-test')
    testSentry() {
        if (process.env.NODE_ENV === 'production') {
            throw new ForbiddenException(
                'Test endpoint disabled in production',
            );
        }

        // Test error capture
        Sentry.withScope((scope) => {
            scope.setTag('test', 'true');
            scope.setLevel('warning');
            Sentry.captureMessage('Test Sentry integration');
        });

        // Test exception capture
        try {
            throw new Error('Test error for Sentry');
        } catch (error) {
            Sentry.captureException(error);
        }

        return { message: 'Sentry test messages sent' };
    }

    @Public()
    @Get('sentry-test-error')
    testSentryError() {
        if (process.env.NODE_ENV === 'production') {
            throw new ForbiddenException(
                'Test endpoint disabled in production',
            );
        }

        // This will be caught by SentryExceptionFilter
        throw new Error('Deliberate error for Sentry testing');
    }
}
```

---

## Environment Configuration

### .env Variables

```bash
# Sentry Configuration
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Environment
NODE_ENV=development  # or production

# Performance Monitoring
SENTRY_TRACES_SAMPLE_RATE=1.0  # 100% in dev, 0.1 (10%) in production
SENTRY_PROFILES_SAMPLE_RATE=1.0  # 100% in dev, 0.1 (10%) in production
```

---

## Best Practices

### ✅ DO:

1. **Import instrument.ts FIRST** in main.ts
2. **Use exception filters** for automatic error capture
3. **Throw HTTP exceptions** from services (NotFoundException, ConflictException, etc.)
4. **Add user context** in authentication guards
5. **Use transactions** for complex operations
6. **Monitor slow queries** with TypeORM logger
7. **Instrument cron jobs** with transactions and check-ins
8. **Add custom context** for business-critical operations
9. **Use meaningful error messages** that help debugging
10. **Test Sentry integration** before deploying

### ❌ DON'T:

1. **Don't catch and log** in controllers - let filters handle it
2. **Don't expose sensitive data** in error messages
3. **Don't send test errors** to production Sentry
4. **Don't forget to instrument** background jobs
5. **Don't ignore slow queries** - they indicate performance issues
6. **Don't use console.log** for errors - use Sentry
7. **Don't sample 100%** in production - use 10-20%
8. **Don't skip user context** - it's critical for debugging
9. **Don't forget to set transaction status** (ok/error)
10. **Don't mix try/catch** unnecessarily - trust NestJS exception handling

---

## Common Patterns

### Pattern 1: Controller Error Handling

```typescript
@Controller('posts')
export class PostController extends BaseController<
    Post,
    CreatePostDto,
    UpdatePostDto
> {
    constructor(private readonly postService: PostService) {
        super(postService);
    }

    // ✅ Clean - exception filter handles everything
    @Get(':id')
    async findOne(@Param('id') id: string): Promise<Post> {
        return await this.postService.findByIdOrFail(id);
    }
}
```

### Pattern 2: Service Error Handling

```typescript
@Injectable()
export class PostService extends BaseService<Post> {
    async publishPost(id: string): Promise<Post> {
        const post = await this.findByIdOrFail(id);

        if (post.status === 'published') {
            // Meaningful HTTP exception
            throw new ConflictException('Post is already published');
        }

        try {
            post.status = 'published';
            post.publishedAt = new Date();
            return await this.repository.save(post);
        } catch (error) {
            // Additional context for unexpected errors
            Sentry.withScope((scope) => {
                scope.setTag('operation', 'publish_post');
                scope.setContext('post', { id, title: post.title });
                Sentry.captureException(error);
            });

            throw new InternalServerErrorException('Failed to publish post');
        }
    }
}
```

### Pattern 3: Complex Operation with Transaction Tracking

```typescript
async processWorkflow(workflowId: string): Promise<void> {
    const transaction = Sentry.startTransaction({
        op: 'workflow.process',
        name: 'Process Workflow',
        data: { workflowId },
    });

    try {
        const span1 = transaction.startChild({ op: 'database.fetch' });
        const workflow = await this.findByIdOrFail(workflowId);
        span1.finish();

        const span2 = transaction.startChild({ op: 'business.validate' });
        await this.validateWorkflow(workflow);
        span2.finish();

        const span3 = transaction.startChild({ op: 'external.api' });
        await this.notifyExternalSystem(workflow);
        span3.finish();

        transaction.setStatus('ok');
    } catch (error) {
        transaction.setStatus('internal_error');
        Sentry.captureException(error);
        throw error;
    } finally {
        transaction.finish();
    }
}
```

---

## Integration Checklist

- [ ] Installed @sentry/node and @sentry/profiling-node
- [ ] Created src/instrument.ts with Sentry.init()
- [ ] Imported instrument.ts FIRST in main.ts
- [ ] Created SentryExceptionFilter
- [ ] Applied SentryExceptionFilter globally
- [ ] Configured TypeORM with SentryDatabaseLogger
- [ ] Added user context in JwtAuthGuard
- [ ] Instrumented all cron jobs
- [ ] Created test endpoints for development
- [ ] Configured environment variables (SENTRY_DSN, sample rates)
- [ ] Tested error capture in development
- [ ] Verified errors appear in Sentry dashboard
- [ ] Set up Sentry alerts for critical errors
- [ ] Documented team process for monitoring Sentry

---

## Related Documentation

- **Backend Skills** (NestJS):
    - Best Practices: [.claude/nestjs/skills/best-practices.md](../../nestjs/skills/best-practices.md)
    - Exception Filters: [.claude/nestjs/skills/middleware-guide.md](../../nestjs/skills/middleware-guide.md)
    - Error Handling: [.claude/nestjs/skills/async-and-errors.md](../../nestjs/skills/async-and-errors.md)

- **NestJS Starter Kit**:
    - Exception Filter: [src/core/filters/all-exceptions.filter.ts](./../../src/core/filters/all-exceptions.filter.ts)
    - Guards: [src/core/guards/jwt-auth.guard.ts](./../../src/core/guards/jwt-auth.guard.ts)
    - Base Service: [src/core/base/base.service.ts](./../../src/core/base/base.service.ts)

---

**Remember**: ALL ERRORS MUST BE CAPTURED TO SENTRY. No exceptions.
