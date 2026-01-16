---
skill_name: debugging
applies_to_local_project_only: true
auto_trigger_regex: [fix bug, debug, nestjs error, typescript error, 500 error, 400 error, typeorm error, injection error, troubleshoot, bug fix]
tags: [debugging, nestjs, errors, troubleshooting, http-exceptions, typeorm]
related_skills: [backend-dev-guidelines, e2e-testing]
---

# Fix NestJS Bug Guide

Structured approach to debugging and fixing bugs in NestJS applications.

## Purpose

Use this guide when you encounter NestJS bugs including:
- HTTP exceptions (400, 401, 403, 404, 500)
- TypeORM/database errors
- Authentication/Guard issues
- Interceptor/Pipe failures
- Service injection errors
- Async/await problems

## Quick Diagnostic Checklist

Before diving into debugging, quickly check:

- [ ] Console output (`npm run start:dev`)
- [ ] Exception filter logs
- [ ] Database connection status
- [ ] API response body and status code
- [ ] JWT token validity
- [ ] Recent migrations (`npm run migration:show`)

## Debugging Workflow

### Step 1: Reproduce the Bug

```typescript
// Document the reproduction steps
// 1. Send request to [endpoint]
// 2. With payload [data]
// 3. Observe [unexpected response/error]
```

### Step 2: Identify the Error Type

| Error Type | Where to Look | Tools |
|------------|---------------|-------|
| 400 Bad Request | DTO validation, Pipes | ValidationPipe errors |
| 401 Unauthorized | Guards, JWT | Token inspection |
| 403 Forbidden | Guards, Permissions | RolesGuard logs |
| 404 Not Found | Service, Repository | Entity queries |
| 500 Server Error | Exception traceback | Logger output |

### Step 3: Isolate the Problem

```typescript
// Add logging to trace data flow
import { Logger } from '@nestjs/common';

@Injectable()
export class UserService {
    private readonly logger = new Logger(UserService.name);

    async findById(id: string): Promise<User> {
        this.logger.debug(`Finding user by ID: ${id}`);
        const user = await this.repository.findById(id);
        this.logger.debug(`Found user: ${JSON.stringify(user)}`);
        return user;
    }
}
```

## Common Bug Categories & Solutions

### 1. Validation Errors (400)

**Symptoms:**
- 400 Bad Request
- Validation error messages in response

**Common Causes & Fixes:**

```typescript
// ❌ Missing validation decorator
export class CreateUserDto {
    email: string;  // No validation!
}

// ✅ Add validation decorators
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class CreateUserDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @MinLength(8)
    @IsNotEmpty()
    password: string;
}

// ❌ ValidationPipe not applied
@Post()
create(@Body() dto: CreateUserDto) {}

// ✅ Apply ValidationPipe globally or per-route
// main.ts
app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
}));
```

### 2. Authentication Errors (401)

**Symptoms:**
- 401 Unauthorized
- "Unauthorized" message

**Common Causes & Fixes:**

```typescript
// ❌ Missing JwtAuthGuard
@Get('profile')
getProfile() {
    return this.userService.getProfile();
}

// ✅ Apply JwtAuthGuard
@UseGuards(JwtAuthGuard)
@Get('profile')
getProfile(@CurrentUser() user: User) {
    return this.userService.getProfile(user.id);
}

// ❌ Token expired or malformed
// Client sending: Authorization: Bearer <invalid_token>

// ✅ Check token in service
import { JwtService } from '@nestjs/jwt';

async validateToken(token: string) {
    try {
        const payload = this.jwtService.verify(token);
        this.logger.debug(`Token valid, expires: ${new Date(payload.exp * 1000)}`);
        return payload;
    } catch (error) {
        this.logger.error(`Token validation failed: ${error.message}`);
        throw new UnauthorizedException('Invalid token');
    }
}

// ❌ Wrong header format
// Authorization: <token>  // Missing "Bearer"

// ✅ Correct format
// Authorization: Bearer <token>
```

### 3. Permission Errors (403)

**Symptoms:**
- 403 Forbidden
- "Forbidden resource" message

**Common Causes & Fixes:**

```typescript
// ❌ Missing role check
@Get('admin')
adminOnly() {
    return 'Admin data';
}

// ✅ Apply RolesGuard
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Get('admin')
adminOnly() {
    return 'Admin data';
}

// ❌ Object-level permission not checked
async findOne(id: string, userId: string) {
    return this.repository.findOne({ where: { id } });
    // User can access any record!
}

// ✅ Check ownership
async findOne(id: string, userId: string) {
    const entity = await this.repository.findOne({
        where: { id, userId }
    });
    if (!entity) {
        throw new NotFoundException(`Resource not found or access denied`);
    }
    return entity;
}
```

### 4. TypeORM/Database Errors

**Symptoms:**
- EntityNotFoundError
- QueryFailedError
- Connection errors

**Common Causes & Fixes:**

```typescript
// ❌ Assuming entity exists
const user = await this.userRepository.findOneOrFail({ where: { id } });
// Throws EntityNotFoundError if not found

// ✅ Handle missing entity
const user = await this.userRepository.findOne({ where: { id } });
if (!user) {
    throw new NotFoundException(`User with ID ${id} not found`);
}

// ❌ Duplicate key error not handled
await this.userRepository.save({ email: 'existing@email.com' });
// QueryFailedError: duplicate key

// ✅ Handle duplicate
async create(dto: CreateUserDto): Promise<User> {
    try {
        return await this.userRepository.save(dto);
    } catch (error) {
        if (error.code === '23505') { // PostgreSQL unique violation
            throw new ConflictException('Email already exists');
        }
        throw error;
    }
}

// ❌ N+1 query problem
const orders = await this.orderRepository.find();
for (const order of orders) {
    console.log(order.user.name); // Query per iteration!
}

// ✅ Use relations
const orders = await this.orderRepository.find({
    relations: ['user'],
});
```

### 5. Dependency Injection Errors

**Symptoms:**
- "Nest can't resolve dependencies"
- "No provider for X"

**Common Causes & Fixes:**

```typescript
// ❌ Service not provided
@Injectable()
export class OrderService {
    constructor(private userService: UserService) {} // UserService not imported
}

// ✅ Import the module
@Module({
    imports: [UserModule], // Import module that exports UserService
    providers: [OrderService],
})
export class OrderModule {}

// ❌ Circular dependency
// UserService → OrderService → UserService

// ✅ Use forwardRef
@Injectable()
export class UserService {
    constructor(
        @Inject(forwardRef(() => OrderService))
        private orderService: OrderService,
    ) {}
}

// ❌ Missing @Injectable decorator
export class EmailService { // Missing @Injectable()!
    send() {}
}

// ✅ Add decorator
@Injectable()
export class EmailService {
    send() {}
}
```

### 6. Async/Await Issues

**Symptoms:**
- Promise returned instead of value
- Unhandled promise rejection
- Race conditions

**Common Causes & Fixes:**

```typescript
// ❌ Missing await
async createUser(dto: CreateUserDto) {
    const user = this.userRepository.save(dto); // Returns Promise!
    return user;
}

// ✅ Use await
async createUser(dto: CreateUserDto) {
    const user = await this.userRepository.save(dto);
    return user;
}

// ❌ forEach with async doesn't wait
async processUsers(ids: string[]) {
    ids.forEach(async (id) => {
        await this.processUser(id); // Won't wait!
    });
}

// ✅ Use for...of or Promise.all
async processUsers(ids: string[]) {
    for (const id of ids) {
        await this.processUser(id);
    }
    // Or parallel:
    await Promise.all(ids.map(id => this.processUser(id)));
}
```

## Debugging Tools

### Logger

```typescript
import { Logger } from '@nestjs/common';

@Injectable()
export class UserService {
    private readonly logger = new Logger(UserService.name);

    async findById(id: string) {
        this.logger.log(`Finding user: ${id}`);
        this.logger.debug(`Debug info: ${JSON.stringify(context)}`);
        this.logger.warn(`Warning: slow query`);
        this.logger.error(`Error: ${error.message}`, error.stack);
    }
}
```

### Jest Debugging

```bash
# Run specific test with verbose output
npm run test -- --verbose user.service.spec.ts

# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand

# Detect open handles (hanging tests)
npm run test -- --detectOpenHandles
```

### VS Code Debugging

```json
// .vscode/launch.json
{
    "type": "node",
    "request": "launch",
    "name": "Debug NestJS",
    "runtimeExecutable": "npm",
    "runtimeArgs": ["run", "start:debug"],
    "console": "integratedTerminal"
}
```

## After Fixing the Bug

1. **Verify the fix** - Test the reproduction steps
2. **Check for side effects** - Ensure fix doesn't break other features
3. **Run tests**: `npm run test`
4. **Run e2e tests**: `npm run test:e2e`
5. **Run linting**: `npm run lint`
6. **Create PR** - Use git workflow

## Related Resources

- [async-and-errors.md](../../guides/async-and-errors.md) - Error handling patterns
- [testing-guide.md](../../guides/testing-guide.md) - Testing strategies
- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeORM Documentation](https://typeorm.io/)
