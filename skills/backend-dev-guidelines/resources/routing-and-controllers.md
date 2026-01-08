# Routing and Controllers - NestJS Best Practices

Complete guide to NestJS controllers with BaseController pattern and decorators.

## Table of Contents

- [NestJS Controllers Overview](#nestjs-controllers-overview)
- [BaseController Pattern](#basecontroller-pattern)
- [Route Decorators](#route-decorators)
- [Custom Decorators](#custom-decorators)
- [Good Examples](#good-examples)
- [Anti-Patterns](#anti-patterns)
- [Swagger Documentation](#swagger-documentation)
- [Override Pattern](#override-pattern)

---

## NestJS Controllers Overview

### The Golden Rule

**Controllers should ONLY:**

- ✅ Define routes with decorators (@Get, @Post, etc.)
- ✅ Extract request data (@Param, @Body, @Query)
- ✅ Delegate to services
- ✅ Return responses (wrapped automatically)

**Controllers should NEVER:**

- ❌ Contain business logic
- ❌ Access database directly (use services)
- ❌ Handle complex validations (DTOs handle this)
- ❌ Format responses manually (TransformInterceptor does this)

### Clean Controller Pattern

```typescript
// src/modules/users/user.controller.ts
import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BaseController } from 'src/core/base';
import { ApiSwagger } from 'src/core/decorators';
import { UserService } from './user.service';
import { User } from './user.entity';
import { CreateUserDto, UpdateUserDto } from './dtos';

@ApiTags('Users')
@Controller('users')
export class UserController extends BaseController<
    User,
    CreateUserDto,
    UpdateUserDto
> {
    constructor(private readonly userService: UserService) {
        super(userService);
    }

    // All CRUD operations inherited automatically!
    // - POST   /users
    // - GET    /users
    // - GET    /users/:id
    // - PATCH  /users/:id
    // - DELETE /users/:id
}
```

**Key Points:**

- Extends BaseController for automatic CRUD
- Decorator-based routing (@Get, @Post, etc.)
- Type-safe with generics
- Clean, readable, maintainable
- All endpoints visible at a glance

---

## BaseController Pattern

### Why BaseController?

**Benefits:**

- ✅ **90% less code** - Full CRUD automatically
- ✅ **Consistent responses** - All wrapped in ResponsePayloadDto
- ✅ **Automatic validation** - UUID validation on :id routes
- ✅ **Swagger docs** - Auto-generated with @ApiSwagger
- ✅ **Error handling** - Inherited from base
- ✅ **Pagination support** - Built-in for GET /
- ✅ **Type-safe** - Generic types throughout

### Inherited CRUD Operations

When you extend BaseController, you automatically get:

```typescript
@Post()
@HttpCode(HttpStatus.CREATED)
@ApiSwagger({ resourceName: 'Resource', operation: 'create', successStatus: 201 })
async create(@Body() createDto: CreateDto): Promise<CreatedResponseDto<T>>

@Get()
@HttpCode(HttpStatus.OK)
@ApiSwagger({ resourceName: 'Resources', operation: 'getAll', isArray: true, withPagination: true })
async findAll(@Query() paginationDto: PaginationDto): Promise<PaginatedResponseDto<T>>

@Get(':id')
@HttpCode(HttpStatus.OK)
@ApiSwagger({ resourceName: 'Resource', operation: 'getOne' })
async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<SuccessResponseDto<T>>

@Patch(':id')
@HttpCode(HttpStatus.OK)
@ApiSwagger({ resourceName: 'Resource', operation: 'update' })
async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateDto
): Promise<UpdatedResponseDto<T>>

@Delete(':id')
@HttpCode(HttpStatus.OK)
@ApiSwagger({ resourceName: 'Resource', operation: 'delete' })
async remove(@Param('id', ParseUUIDPipe) id: string): Promise<DeletedResponseDto>
```

### Response Format

All responses are automatically wrapped by TransformInterceptor:

```typescript
{
    "success": true,
    "statusCode": 200,
    "message": "User retrieved successfully",
    "data": {
        "id": "uuid-here",
        "email": "user@example.com",
        "name": "John Doe",
        "createdAt": "2024-01-01T12:00:00.000Z",
        "updatedAt": "2024-01-01T12:00:00.000Z"
    },
    "timestamp": "2024-01-01T12:00:00.000Z",
    "path": "/api/users/uuid-here"
}
```

---

## Route Decorators

### HTTP Method Decorators

```typescript
import {
    Get,
    Post,
    Put,
    Patch,
    Delete,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';

@Controller('users')
export class UserController {
    @Get() // GET /users
    @HttpCode(HttpStatus.OK) // 200
    findAll() {}

    @Get(':id') // GET /users/:id
    findOne(@Param('id') id: string) {}

    @Post() // POST /users
    @HttpCode(HttpStatus.CREATED) // 201
    create(@Body() dto: CreateDto) {}

    @Patch(':id') // PATCH /users/:id
    update(@Param('id') id: string, @Body() dto: UpdateDto) {}

    @Delete(':id') // DELETE /users/:id
    remove(@Param('id') id: string) {}
}
```

### Parameter Decorators

```typescript
import { Param, Body, Query, Headers, Req, Res } from '@nestjs/common';

@Controller('users')
export class UserController {
    @Get(':id')
    findOne(
        @Param('id') id: string, // Route parameter
        @Query('include') include?: string, // Query parameter
        @Headers('authorization') auth?: string, // Header
    ) {}

    @Post()
    create(
        @Body() createDto: CreateUserDto, // Request body
    ) {}

    @Get()
    findAll(
        @Query() query: PaginationDto, // All query params as DTO
    ) {}
}
```

### Validation Pipes

```typescript
import { ParseUUIDPipe, ParseIntPipe, ValidationPipe } from '@nestjs/common';

@Controller('users')
export class UserController {
    @Get(':id')
    findOne(
        @Param('id', ParseUUIDPipe) id: string, // Auto-validate UUID
    ) {}

    @Get()
    findAll(
        @Query('page', ParseIntPipe) page: number, // Auto-parse to integer
    ) {}

    @Post()
    create(
        @Body() dto: CreateUserDto, // ValidationPipe runs globally
    ) {}
}
```

---

## Custom Decorators

### @Public() - Bypass Authentication

```typescript
import { Public } from 'src/core/decorators';

@Controller('users')
export class UserController {
    @Public() // This route doesn't require authentication
    @Post()
    async create(@Body() createUserDto: CreateUserDto) {
        return await this.userService.createUser(createUserDto);
    }

    @Get(':id') // This route requires authentication (default)
    async findOne(@Param('id') id: string) {
        return await this.userService.findById(id);
    }
}
```

### @Roles() - Role-Based Access Control

```typescript
import { Roles } from 'src/core/decorators';

@Controller('users')
export class UserController {
    @Roles('admin') // Only admins can access
    @Delete(':id')
    async remove(@Param('id') id: string) {
        return await this.userService.remove(id);
    }

    @Roles('admin', 'operations') // Multiple roles
    @Patch(':id')
    async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
        return await this.userService.update(id, dto);
    }
}
```

### @CurrentUser() - Get Authenticated User

```typescript
import { CurrentUser } from 'src/core/decorators';
import { IJwtPayload } from '@shared/interfaces';

@Controller('profile')
export class ProfileController {
    @Get()
    async getProfile(@CurrentUser() user: IJwtPayload) {
        // user contains: { userId, email, roles, ... }
        return await this.userService.findById(user.userId);
    }

    @Patch()
    async updateProfile(
        @CurrentUser() user: IJwtPayload,
        @Body() dto: UpdateProfileDto,
    ) {
        return await this.userService.update(user.userId, dto);
    }
}
```

### @ApiSwagger() - Swagger Documentation

```typescript
import { ApiSwagger } from 'src/core/decorators';

@Controller('users')
export class UserController {
    @Post()
    @ApiSwagger({
        resourceName: 'User',
        operation: 'create',
        requestDto: CreateUserDto,
        responseDto: UserResponseDto,
        successStatus: 201,
        errors: [
            { status: 400, description: 'Invalid input data' },
            { status: 409, description: 'Email already exists' },
        ],
    })
    async create(@Body() dto: CreateUserDto) {
        return await this.userService.create(dto);
    }
}
```

---

## Good Examples

### Example 1: User Controller (Excellent ✅)

**File:** `src/modules/users/user.controller.ts`

```typescript
import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Query,
    Delete,
    HttpCode,
    HttpStatus,
    ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BaseController } from 'src/core/base';
import { ApiSwagger, Public } from 'src/core/decorators';
import { ResponsePayloadDto } from '@shared/dtos';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './dtos';
import { User } from './user.entity';

@ApiTags('Users')
@Controller('users')
export class UserController extends BaseController<
    User,
    CreateUserDto,
    UpdateUserDto
> {
    constructor(private readonly userService: UserService) {
        super(userService);
    }

    // Override create to make it public and use custom service method
    @Public()
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiSwagger({
        resourceName: 'User',
        operation: 'create',
        requestDto: CreateUserDto,
        responseDto: UserResponseDto,
        successStatus: 201,
        errors: [
            { status: 400, description: 'Invalid input data' },
            { status: 409, description: 'User with this email already exists' },
        ],
    })
    async create(
        @Body() createUserDto: CreateUserDto,
    ): Promise<ResponsePayloadDto<User>> {
        return await this.userService.createUser(createUserDto);
    }

    // Custom endpoint: Get active users
    @Get('active')
    @HttpCode(HttpStatus.OK)
    @ApiSwagger({
        resourceName: 'Active Users',
        operation: 'getAll',
        responseDto: UserResponseDto,
        isArray: true,
    })
    async getActiveUsers() {
        return this.userService.getActiveUsers();
    }

    // Custom endpoint: Search by email
    @Get('search')
    @HttpCode(HttpStatus.OK)
    @ApiSwagger({
        resourceName: 'Users',
        operation: 'search',
        summary: 'Search users by email',
        responseDto: UserResponseDto,
        isArray: true,
    })
    async searchByEmail(@Query('email') email: string) {
        if (!email) return [];
        const user = await this.userService.findByEmail(email);
        return user ? [user] : [];
    }

    // Inherited CRUD endpoints:
    // - GET /users (with pagination)
    // - GET /users/:id
    // - PATCH /users/:id
    // - DELETE /users/:id
}
```

**What Makes This Excellent:**

- ✅ Extends BaseController for automatic CRUD
- ✅ Custom endpoints added where needed
- ✅ Proper use of @Public decorator
- ✅ Complete Swagger documentation
- ✅ Clean parameter extraction
- ✅ Zero business logic

### Example 2: Authentication Controller (Good ✅)

**File:** `src/modules/auth/auth.controller.ts`

```typescript
import {
    Body,
    Controller,
    Get,
    Post,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, SocialLoginDto } from './dtos';
import { ApiSwagger, CurrentUser, Public } from '@core/decorators';
import { JwtAuthGuard } from '@core/guards';
import { SetToken, RemoveToken } from '@core/interceptors';
import { IJwtPayload } from '@shared/interfaces';
import { LoginResponsePayloadDto, ResponsePayloadDto } from '@shared/dtos';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) {}

    @Post('login')
    @Public()
    @UseInterceptors(SetToken)
    @ApiSwagger({
        resourceName: 'Login',
        operation: 'custom',
        summary: 'User login',
        requestDto: LoginDto,
        responseDto: LoginResponsePayloadDto,
        requiresAuth: false,
        errors: [{ status: 401, description: 'Incorrect email or password' }],
    })
    async login(
        @Body() dto: LoginDto,
    ): Promise<ResponsePayloadDto<LoginResponsePayloadDto>> {
        return await this.authService.login(dto);
    }

    @Post('social-login')
    @Public()
    @UseInterceptors(SetToken)
    @ApiSwagger({
        resourceName: 'Social Login',
        operation: 'custom',
        summary: 'Social login (Google, Kakao, Naver)',
        requestDto: SocialLoginDto,
        responseDto: LoginResponsePayloadDto,
        requiresAuth: false,
    })
    async socialLogin(
        @Body() dto: SocialLoginDto,
    ): Promise<LoginResponsePayloadDto> {
        return await this.authService.socialLogin(dto);
    }

    @Get('check-login')
    @UseGuards(JwtAuthGuard)
    @ApiSwagger({
        resourceName: 'Check Login',
        operation: 'custom',
        summary: 'Check if user is logged in',
        responseDto: LoginResponsePayloadDto,
        requiresAuth: true,
    })
    async checkUserLogin(@CurrentUser() user: IJwtPayload | null) {
        if (user) {
            return await this.authService.getUserInformation(user);
        }
        return null;
    }

    @Get('logout')
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(RemoveToken)
    @ApiSwagger({
        resourceName: 'Logout',
        operation: 'custom',
        summary: 'Logout user',
        requiresAuth: true,
    })
    async logout(@CurrentUser() user: IJwtPayload | null) {
        return await this.authService.logout(user);
    }
}
```

**What Makes This Good:**

- ✅ Clear route definitions
- ✅ Proper use of @Public decorator
- ✅ Interceptors for token management
- ✅ @CurrentUser decorator for auth
- ✅ Complete Swagger documentation
- ✅ All logic delegated to service

---

## Anti-Patterns

### Anti-Pattern 1: Business Logic in Controller (Bad ❌)

```typescript
// ❌ ANTI-PATTERN: Business logic in controller
@Post()
async create(@Body() createUserDto: CreateUserDto) {
    // ❌ Email validation in controller
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(createUserDto.email)) {
        throw new BadRequestException('Invalid email format');
    }

    // ❌ Business rule checking in controller
    const existing = await this.userService.findByEmail(createUserDto.email);
    if (existing) {
        throw new ConflictException('Email already exists');
    }

    // ❌ Data transformation in controller
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const userData = {
        ...createUserDto,
        password: hashedPassword,
        isActive: true,
    };

    // Finally create user
    return await this.userService.create(userData);
}
```

**Why This Is Terrible:**

- Violates single responsibility principle
- Business logic not reusable
- Hard to test
- Mixes HTTP concerns with business rules

**How to Fix:**

```typescript
// ✅ GOOD: Delegate to service
@Post()
async create(@Body() createUserDto: CreateUserDto) {
    return await this.userService.createUser(createUserDto);
}

// Service handles all business logic:
// - Email validation (via DTO with class-validator)
// - Duplicate checking
// - Password hashing
// - Setting defaults
```

### Anti-Pattern 2: Not Using BaseController (Bad ❌)

```typescript
// ❌ ANTI-PATTERN: Reimplementing CRUD manually
@Controller('products')
export class ProductController {
    constructor(private productService: ProductService) {}

    @Post()
    async create(@Body() dto: CreateProductDto) {
        try {
            const product = await this.productService.create(dto);
            return {
                success: true,
                statusCode: 201,
                message: 'Product created',
                data: product,
            };
        } catch (error) {
            throw new InternalServerErrorException('Failed to create product');
        }
    }

    @Get()
    async findAll(@Query('page') page = 1, @Query('limit') limit = 10) {
        const products = await this.productService.findAll();
        // Manual pagination logic...
        return {
            success: true,
            data: products,
            page,
            limit,
        };
    }

    // ... 200 more lines of manual CRUD
}
```

**How to Fix:**

```typescript
// ✅ GOOD: Use BaseController
@ApiTags('Products')
@Controller('products')
export class ProductController extends BaseController<
    Product,
    CreateProductDto,
    UpdateProductDto
> {
    constructor(private readonly productService: ProductService) {
        super(productService);
    }

    // All CRUD operations inherited!
    // Only add custom endpoints if needed
}
```

---

## Swagger Documentation

### Complete Swagger Example

```typescript
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { ApiSwagger } from 'src/core/decorators';

@ApiTags('Users')
@ApiBearerAuth() // Requires authentication by default
@Controller('users')
export class UserController extends BaseController<
    User,
    CreateUserDto,
    UpdateUserDto
> {
    constructor(private readonly userService: UserService) {
        super(userService);
    }

    @Post()
    @ApiSwagger({
        resourceName: 'User',
        operation: 'create',
        requestDto: CreateUserDto,
        responseDto: UserResponseDto,
        successStatus: 201,
        errors: [
            { status: 400, description: 'Invalid input data' },
            { status: 409, description: 'User already exists' },
        ],
    })
    async create(@Body() dto: CreateUserDto) {
        return await this.userService.create(dto);
    }

    // Or use standard NestJS decorators:
    @Get(':id')
    @ApiOperation({ summary: 'Get user by ID' })
    @ApiResponse({
        status: 200,
        description: 'User found',
        type: UserResponseDto,
    })
    @ApiResponse({ status: 404, description: 'User not found' })
    async findOne(@Param('id', ParseUUIDPipe) id: string) {
        return await this.userService.findById(id);
    }
}
```

### Swagger DTO Example

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class CreateUserDto {
    @ApiProperty({
        example: 'user@example.com',
        description: 'User email address',
    })
    @IsEmail()
    email: string;

    @ApiProperty({
        example: 'John Doe',
        description: 'User full name',
        minLength: 2,
        maxLength: 100,
    })
    @IsString()
    @MinLength(2)
    @MaxLength(100)
    name: string;

    @ApiProperty({
        example: 'SecurePassword123',
        description: 'User password',
        minLength: 8,
    })
    @IsString()
    @MinLength(8)
    password: string;
}
```

---

## Override Pattern

### When to Override BaseController Methods

Override inherited methods when you need:

- Custom business logic
- Different response format
- Additional validation
- Custom error handling
- Integration with other services

### Override Example

```typescript
@ApiTags('Users')
@Controller('users')
export class UserController extends BaseController<
    User,
    CreateUserDto,
    UpdateUserDto
> {
    constructor(
        private readonly userService: UserService,
        private readonly mailService: MailService,
    ) {
        super(userService);
    }

    // Override create to add email notification
    @Public()
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiSwagger({
        resourceName: 'User',
        operation: 'create',
        responseDto: UserResponseDto,
    })
    async create(
        @Body() createUserDto: CreateUserDto,
    ): Promise<ResponsePayloadDto<User>> {
        // Create user
        const result = await this.userService.createUser(createUserDto);

        // Send welcome email (custom logic)
        await this.mailService.sendWelcome(createUserDto.email);

        return result;
    }

    // Override update to add logging
    @Patch(':id')
    @HttpCode(HttpStatus.OK)
    @ApiSwagger({
        resourceName: 'User',
        operation: 'update',
        responseDto: UserResponseDto,
    })
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateUserDto: UpdateUserDto,
        @CurrentUser() user: IJwtPayload,
    ): Promise<ResponsePayloadDto<User>> {
        // Update user
        const updatedUser = await this.userService.updateUser(
            id,
            updateUserDto,
        );

        // Log action
        console.log(`User ${user.userId} updated user ${id}`);

        return new ResponsePayloadDto({
            success: true,
            statusCode: 200,
            message: 'User updated successfully',
            data: updatedUser,
            timestamp: new Date().toISOString(),
        });
    }

    // Keep other CRUD operations from BaseController:
    // - findAll (GET /)
    // - findOne (GET /:id)
    // - remove (DELETE /:id)
}
```

---

## Best Practices Summary

### ✅ DO:

- Extend BaseController for all CRUD endpoints
- Use NestJS decorators (@Get, @Post, @Body, @Param)
- Use custom decorators (@Public, @Roles, @CurrentUser)
- Add @ApiSwagger for documentation
- Delegate all logic to services
- Override base methods only when necessary
- Use ParseUUIDPipe for ID validation
- Return DTOs from methods

### ❌ DON'T:

- Put business logic in controllers
- Access database directly
- Handle complex validations (use DTOs)
- Format responses manually (interceptor does this)
- Use process.env directly
- Implement CRUD manually (use BaseController)
- Forget @ApiTags decorator
- Mix HTTP concerns with business rules

---

**Related Files:**

- [SKILL.md](../SKILL.md) - Main guide
- [architecture-overview.md](architecture-overview.md) - Four-layer architecture
- [services-and-repositories.md](services-and-repositories.md) - Service layer patterns
- [validation-patterns.md](validation-patterns.md) - DTO validation
