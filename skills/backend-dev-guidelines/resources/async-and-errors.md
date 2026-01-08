# Async Patterns and Error Handling - NestJS

Complete guide to async/await patterns and error handling in NestJS applications.

## Table of Contents

- [Async/Await Best Practices](#asyncawait-best-practices)
- [NestJS Exception Types](#nestjs-exception-types)
- [Custom Exceptions](#custom-exceptions)
- [Exception Filters](#exception-filters)
- [Error Propagation](#error-propagation)
- [Common Async Pitfalls](#common-async-pitfalls)

---

## Async/Await Best Practices

### Always Use Async/Await in NestJS

```typescript
// ✅ GOOD: Async/await in controllers
@Get(':id')
async findOne(@Param('id') id: string): Promise<User> {
    return await this.userService.findById(id);
}

// ❌ BAD: Promise chains
@Get(':id')
findOne(@Param('id') id: string): Promise<User> {
    return this.userService.findById(id)
        .then(user => user)
        .catch(error => { throw error });
}
```

### Error Handling in Services

```typescript
// ✅ GOOD: Let NestJS exceptions bubble up
@Injectable()
export class UserService extends BaseService<User> {
    async findByIdOrFail(id: string): Promise<User> {
        const user = await this.repository.findById(id);

        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }

        return user;
    }

    async createUser(data: CreateUserDto): Promise<User> {
        try {
            return await this.repository.create(data);
        } catch (error) {
            if (error.message.includes('duplicate key')) {
                throw new ConflictException('Email already exists');
            }
            throw error; // Re-throw unknown errors
        }
    }
}
```

---

## NestJS Exception Types

### Built-in HTTP Exceptions

```typescript
import {
    BadRequestException,
    UnauthorizedException,
    NotFoundException,
    ForbiddenException,
    ConflictException,
    InternalServerErrorException,
    ServiceUnavailableException,
} from '@nestjs/common';

// 400 - Bad Request
throw new BadRequestException('Invalid input data');

// 401 - Unauthorized
throw new UnauthorizedException('Invalid credentials');

// 403 - Forbidden
throw new ForbiddenException('Insufficient permissions');

// 404 - Not Found
throw new NotFoundException('Resource not found');

// 409 - Conflict
throw new ConflictException('Email already exists');

// 500 - Internal Server Error
throw new InternalServerErrorException('Database connection failed');

// 503 - Service Unavailable
throw new ServiceUnavailableException('Service temporarily unavailable');
```

### Exception with Custom Message

```typescript
// Single message
throw new NotFoundException('User not found');

// Object with details
throw new BadRequestException({
    statusCode: 400,
    message: 'Validation failed',
    errors: [
        { field: 'email', message: 'Invalid email format' },
        { field: 'password', message: 'Password too weak' },
    ],
});
```

---

## Custom Exceptions

### Domain-Specific Exceptions

```typescript
// src/core/exceptions/user-not-found.exception.ts
import { NotFoundException } from '@nestjs/common';

export class UserNotFoundException extends NotFoundException {
    constructor(userId: string) {
        super(`User with ID ${userId} not found`);
    }
}

// src/core/exceptions/email-already-exists.exception.ts
import { ConflictException } from '@nestjs/common';

export class EmailAlreadyExistsException extends ConflictException {
    constructor(email: string) {
        super(`User with email ${email} already exists`);
    }
}

// Usage in service
async createUser(data: CreateUserDto): Promise<User> {
    const existing = await this.findByEmail(data.email);

    if (existing) {
        throw new EmailAlreadyExistsException(data.email);
    }

    return this.repository.create(data);
}
```

### Business Logic Exceptions

```typescript
// src/core/exceptions/business-logic.exception.ts
import { BadRequestException } from '@nestjs/common';

export class InsufficientBalanceException extends BadRequestException {
    constructor(balance: number, required: number) {
        super(`Insufficient balance. Available: ${balance}, Required: ${required}`);
    }
}

export class InvalidWorkflowStateException extends BadRequestException {
    constructor(currentState: string, requiredState: string) {
        super(`Invalid workflow state. Current: ${currentState}, Required: ${requiredState}`);
    }
}

// Usage
async transfer(from: string, to: string, amount: number): Promise<void> {
    const account = await this.findAccount(from);

    if (account.balance < amount) {
        throw new InsufficientBalanceException(account.balance, amount);
    }

    // Proceed with transfer
}
```

---

## Exception Filters

### Global Exception Filter

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

        // Log the error
        this.logger.error(
            `${request.method} ${request.url}`,
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

### HTTP Exception Filter

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

        // Log warning for HTTP exceptions
        this.logger.warn(
            `${request.method} ${request.url} - ${status} - ${exception.message}`,
        );

        // Extract error details
        const errorResponse = {
            success: false,
            statusCode: status,
            message: this.getErrorMessage(exceptionResponse),
            errors: this.getValidationErrors(exceptionResponse),
            timestamp: new Date().toISOString(),
            path: request.url,
        };

        response.status(status).json(errorResponse);
    }

    private getErrorMessage(response: string | object): string {
        if (typeof response === 'string') {
            return response;
        }
        return (response as any).message || 'An error occurred';
    }

    private getValidationErrors(response: string | object): any[] | undefined {
        if (typeof response === 'object' && (response as any).errors) {
            return (response as any).errors;
        }
        return undefined;
    }
}
```

### Apply Filters Globally

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AllExceptionsFilter } from './core/filters/all-exceptions.filter';
import { HttpExceptionFilter } from './core/filters/http-exception.filter';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Apply exception filters
    app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());

    await app.listen(4000);
}
bootstrap();
```

---

## Error Propagation

### Controller → Service → Repository

```typescript
// ❌ BAD: Catching and logging but not re-throwing
@Injectable()
export class UserService {
    async findById(id: string): Promise<User> {
        try {
            return await this.repository.findById(id);
        } catch (error) {
            console.error('Error finding user:', error);
            // Error swallowed! Controller won't know about it
        }
    }
}

// ✅ GOOD: Let errors bubble up
@Injectable()
export class UserService {
    async findById(id: string): Promise<User> {
        const user = await this.repository.findById(id);

        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }

        return user;
    }
}

// ✅ GOOD: Transform database errors into HTTP exceptions
@Injectable()
export class UserService {
    async createUser(data: CreateUserDto): Promise<User> {
        try {
            return await this.repository.create(data);
        } catch (error) {
            // Transform database error to HTTP exception
            if (error.message.includes('duplicate key')) {
                throw new ConflictException('Email already exists');
            }

            if (error.message.includes('foreign key')) {
                throw new BadRequestException('Invalid reference');
            }

            // Re-throw unknown errors
            throw error;
        }
    }
}
```

### Parallel Operations

```typescript
// Handle errors in Promise.all
async getUserData(userId: string): Promise<UserData> {
    try {
        const [user, profile, settings] = await Promise.all([
            this.userService.findById(userId),
            this.profileService.findByUserId(userId),
            this.settingsService.findByUserId(userId),
        ]);

        return { user, profile, settings };
    } catch (error) {
        // One failure fails all
        this.logger.error('Failed to fetch user data', error);
        throw new InternalServerErrorException('Failed to load user data');
    }
}

// Handle errors individually with Promise.allSettled
async getUserDataSafe(userId: string): Promise<Partial<UserData>> {
    const results = await Promise.allSettled([
        this.userService.findById(userId),
        this.profileService.findByUserId(userId),
        this.settingsService.findByUserId(userId),
    ]);

    const data: Partial<UserData> = {};

    if (results[0].status === 'fulfilled') {
        data.user = results[0].value;
    } else {
        this.logger.error('Failed to fetch user', results[0].reason);
    }

    if (results[1].status === 'fulfilled') {
        data.profile = results[1].value;
    }

    if (results[2].status === 'fulfilled') {
        data.settings = results[2].value;
    }

    return data;
}
```

---

## Common Async Pitfalls

### 1. Forgetting await

```typescript
// ❌ BAD: Missing await
async createUser(data: CreateUserDto): Promise<User> {
    const user = this.repository.create(data);  // Returns Promise!
    return user;  // Returns Promise<Promise<User>>
}

// ✅ GOOD: Use await
async createUser(data: CreateUserDto): Promise<User> {
    const user = await this.repository.create(data);
    return user;
}
```

### 2. Sequential Operations That Could Be Parallel

```typescript
// ❌ BAD: Sequential (slow)
async loadDashboard(userId: string) {
    const user = await this.userService.findById(userId);       // 100ms
    const posts = await this.postService.findByUser(userId);   // 100ms
    const stats = await this.statsService.getStats(userId);    // 100ms
    // Total: 300ms
}

// ✅ GOOD: Parallel (fast)
async loadDashboard(userId: string) {
    const [user, posts, stats] = await Promise.all([
        this.userService.findById(userId),
        this.postService.findByUser(userId),
        this.statsService.getStats(userId),
    ]);
    // Total: 100ms
}
```

### 3. Async Functions in Array Methods

```typescript
// ❌ BAD: forEach doesn't wait
async processUsers(userIds: string[]) {
    userIds.forEach(async (id) => {
        await this.processUser(id);  // Won't wait!
    });
}

// ✅ GOOD: Use for...of
async processUsers(userIds: string[]) {
    for (const id of userIds) {
        await this.processUser(id);
    }
}

// ✅ GOOD: Process in parallel
async processUsers(userIds: string[]) {
    await Promise.all(
        userIds.map(id => this.processUser(id))
    );
}
```

### 4. Error Handling in Loops

```typescript
// ❌ BAD: One error stops everything
async processUsers(userIds: string[]) {
    for (const id of userIds) {
        await this.processUser(id);  // If one fails, stops processing
    }
}

// ✅ GOOD: Handle errors individually
async processUsers(userIds: string[]) {
    const results = await Promise.allSettled(
        userIds.map(id => this.processUser(id))
    );

    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
        this.logger.warn(`${failed.length} users failed to process`);
    }

    return results.filter(r => r.status === 'fulfilled')
                 .map(r => r.value);
}
```

### 5. Transaction Management

```typescript
// ❌ BAD: No transaction, partial updates possible
async transferFunds(fromId: string, toId: string, amount: number) {
    await this.deductBalance(fromId, amount);
    // If this fails, first operation completed!
    await this.addBalance(toId, amount);
}

// ✅ GOOD: Use transaction
async transferFunds(fromId: string, toId: string, amount: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        await queryRunner.manager.decrement(Account, { id: fromId }, 'balance', amount);
        await queryRunner.manager.increment(Account, { id: toId }, 'balance', amount);
        await queryRunner.commitTransaction();
    } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
    } finally {
        await queryRunner.release();
    }
}
```

---

## Best Practices Summary

### ✅ DO:

- Use async/await instead of Promise chains
- Throw NestJS HTTP exceptions from services
- Let errors bubble up to exception filters
- Use try-catch for database operations
- Transform database errors to HTTP exceptions
- Use Promise.all for parallel operations
- Use Promise.allSettled when failures are acceptable
- Use transactions for multi-step database operations
- Log errors at appropriate levels
- Provide helpful error messages to users

### ❌ DON'T:

- Swallow errors without re-throwing
- Use .then().catch() chains
- Forget await keyword
- Expose internal error details to users
- Use console.log for error logging
- Mix HTTP concerns in business logic
- Process arrays sequentially when parallel is possible
- Skip transaction management for critical operations
- Return generic error messages
- Forget to release database connections

---

**Related Files:**

- [SKILL.md](../SKILL.md) - Main guide
- [middleware-guide.md](middleware-guide.md) - Exception filters
- [services-and-repositories.md](services-and-repositories.md) - Service error handling
- [database-patterns.md](database-patterns.md) - Transaction patterns
