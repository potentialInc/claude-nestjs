# Architecture Overview - NestJS Applications

Complete guide to the four-layer architecture pattern used in NestJS applications with TypeORM.

## Table of Contents

- [Four-Layer Architecture Pattern](#four-layer-architecture-pattern)
- [Request Lifecycle](#request-lifecycle)
- [Base Classes Pattern](#base-classes-pattern)
- [NestJS Module System](#nestjs-module-system)
- [Directory Structure Rationale](#directory-structure-rationale)
- [Separation of Concerns](#separation-of-concerns)

---

## Four-Layer Architecture Pattern

### The Four Layers with Base Classes

```
┌─────────────────────────────────────┐
│         HTTP Request                │
└───────────────┬─────────────────────┘
                ↓
┌─────────────────────────────────────┐
│  Layer 1: CONTROLLER                │
│  extends BaseController             │
│  - HTTP request/response handling   │
│  - Input validation (auto)          │
│  - Delegates to service             │
│  - Swagger documentation            │
│  - CRUD operations (auto)           │
└───────────────┬─────────────────────┘
                ↓
┌─────────────────────────────────────┐
│  Layer 2: SERVICE                   │
│  extends BaseService                │
│  - Business logic                   │
│  - Business rules enforcement       │
│  - Orchestration                    │
│  - Delegates to repository          │
│  - CRUD operations (auto)           │
└───────────────┬─────────────────────┘
                ↓
┌─────────────────────────────────────┐
│  Layer 3: REPOSITORY                │
│  extends BaseRepository             │
│  - Data access abstraction          │
│  - TypeORM query operations         │
│  - Query optimization               │
│  - CRUD operations (auto)           │
└───────────────┬─────────────────────┘
                ↓
┌─────────────────────────────────────┐
│  Layer 4: ENTITY                    │
│  extends BaseEntity                 │
│  - Database schema definition       │
│  - UUID primary key (auto)          │
│  - Timestamps (auto)                │
│  - Soft delete (auto)               │
└───────────────┬─────────────────────┘
                ↓
┌─────────────────────────────────────┐
│    Database (PostgreSQL + TypeORM)  │
└─────────────────────────────────────┘
```

### Why This Architecture?

**90% Boilerplate Reduction:**

- Base classes provide full CRUD automatically
- Create 4 files, get 15+ endpoints
- Consistent patterns across all features
- Type-safe throughout

**Testability:**

- Each layer independently testable
- Easy to mock dependencies (DI)
- Clear test boundaries
- NestJS testing utilities

**Maintainability:**

- Changes isolated to specific layers
- Business logic separate from HTTP
- Easy to locate bugs
- Consistent structure

**Scalability:**

- Easy to add new features
- Clear patterns to follow
- Dependency injection
- Module-based organization

---

## Request Lifecycle

### Complete Flow Example

```typescript
1. HTTP POST /api/users
   ↓
2. NestJS Router matches Controller route
   ↓
3. Guard chain executes:
   - JwtAuthGuard (authentication)
   - RolesGuard (authorization)
   ↓
4. Interceptor executes (before):
   - LoggingInterceptor
   - TransformInterceptor
   ↓
5. Pipe executes:
   - ValidationPipe (validates DTO with class-validator)
   ↓
6. Controller method executes:
   @Post()
   async create(@Body() createUserDto: CreateUserDto) {
       return this.service.create(createUserDto);
   }
   ↓
7. Service executes business logic:
   async create(data: DeepPartial<User>) {
       // Business rules check
       // Call repository
       return this.repository.create(data);
   }
   ↓
8. Repository performs database operation:
   async create(data: DeepPartial<User>) {
       const entity = this.repository.create(data);
       return await this.repository.save(entity);
   }
   ↓
9. Response flows back:
   Repository → Service → Controller
   ↓
10. Interceptor executes (after):
    - TransformInterceptor wraps in ResponsePayloadDto
    - LoggingInterceptor logs response
   ↓
11. Response sent to client:
    {
        "success": true,
        "statusCode": 201,
        "message": "User created successfully",
        "data": { ...user },
        "timestamp": "2024-01-01T12:00:00.000Z",
        "path": "/api/users"
    }
```

### Middleware Execution Order

**Critical:** NestJS middleware/guards/interceptors execute in specific order

```typescript
// main.ts - Global configuration
app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());
app.useGlobalInterceptors(new TransformInterceptor());
app.useGlobalPipes(
    new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }),
);

// Execution order per request:
// 1. Middleware (Express-style)
// 2. Guards (@UseGuards, global guards)
// 3. Interceptors (before) (@UseInterceptors, global interceptors)
// 4. Pipes (@UsePipes, global pipes)
// 5. Controller method
// 6. Service method
// 7. Interceptors (after)
// 8. Exception filters (if error thrown)
```

---

## Base Classes Pattern

### The Power of Base Classes

**Instead of writing:**

- 500+ lines for full CRUD
- Manual validation
- Error handling
- Swagger documentation
- Response formatting

**You write:**

- 50 lines that extend base classes
- Get everything automatically
- Consistent patterns
- Type-safe operations

### BaseController Example

```typescript
// Only need to write this:
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

    // All CRUD operations are inherited automatically:
    // - create(dto)     → POST /
    // - findAll(query)  → GET /
    // - findOne(id)     → GET /:id
    // - update(id, dto) → PATCH /:id
    // - remove(id)      → DELETE /:id
}
```

**What you get automatically:**

- ✅ Full CRUD endpoints
- ✅ UUID validation on :id routes
- ✅ Swagger documentation
- ✅ Standardized responses
- ✅ Error handling
- ✅ Pagination support

### BaseService Example

```typescript
@Injectable()
export class UserService extends BaseService<User> {
    constructor(protected readonly repository: UserRepository) {
        super(repository, 'User');
    }

    // Inherited methods:
    // - create(data)
    // - findAll(options)
    // - findByIdOrFail(id)
    // - update(id, data)
    // - remove(id)      // soft delete
    // - delete(id)      // hard delete

    // Add custom business logic:
    async findByEmail(email: string): Promise<User | null> {
        return this.repository.findOne({ where: { email } });
    }

    async getActiveUsers(): Promise<User[]> {
        return this.repository.findAll({
            where: { isActive: true },
        });
    }
}
```

### BaseRepository Example

```typescript
@Injectable()
export class UserRepository extends BaseRepository<User> {
    constructor(
        @InjectRepository(User)
        repository: Repository<User>,
    ) {
        super(repository);
    }

    // Inherited methods:
    // - findAll(options)
    // - findById(id)
    // - findOne(options)
    // - create(data)
    // - update(id, data)
    // - softDelete(id)
    // - delete(id)

    // Add custom queries:
    async findByEmail(email: string): Promise<User | null> {
        return this.findOne({ where: { email } });
    }
}
```

### BaseEntity Example

```typescript
@Entity('users')
export class User extends BaseEntity {
    // Inherited from BaseEntity:
    // - id: string (UUID, primary key)
    // - createdAt: Date
    // - updatedAt: Date
    // - deletedAt: Date (for soft delete)

    @Column({ unique: true })
    email: string;

    @Column()
    name: string;

    @Column({ default: true })
    isActive: boolean;

    @Column('simple-array', { default: [] })
    roles: string[];
}
```

---

## NestJS Module System

### Feature Module Pattern

Every feature should be organized as a NestJS module:

```typescript
// user.module.ts
@Module({
    imports: [
        TypeOrmModule.forFeature([User]), // Register entity
    ],
    controllers: [UserController], // Register controllers
    providers: [
        UserService, // Register service
        UserRepository, // Register repository
    ],
    exports: [UserService], // Export for use in other modules
})
export class UserModule {}
```

### Module Organization

```
src/modules/users/
├── user.entity.ts           # Database entity
├── user.repository.ts       # Data access layer
├── user.service.ts          # Business logic
├── user.controller.ts       # HTTP layer
├── user.module.ts           # NestJS module
├── dtos/
│   ├── create-user.dto.ts   # Create DTO
│   ├── update-user.dto.ts   # Update DTO
│   └── user-response.dto.ts # Response DTO
└── user.service.spec.ts     # Tests
```

### Dependency Injection

NestJS uses constructor-based dependency injection:

```typescript
@Injectable()
export class UserService extends BaseService<User> {
    constructor(
        protected readonly repository: UserRepository,
        private readonly mailService: MailService, // Inject other services
        private readonly tokenService: TokenService, // Inject more services
    ) {
        super(repository, 'User');
    }

    async createUser(data: CreateUserDto): Promise<User> {
        // Create user
        const user = await this.repository.create(data);

        // Send welcome email
        await this.mailService.sendWelcome(user.email);

        // Generate token
        const token = await this.tokenService.generate(user);

        return user;
    }
}
```

---

## Directory Structure Rationale

### Core Directory

**Purpose:** Framework-level code that ALL features use

```
src/core/
├── base/                      # Base classes (MUST EXTEND)
│   ├── base.entity.ts        # UUID, timestamps, soft delete
│   ├── base.repository.ts    # CRUD operations
│   ├── base.service.ts       # Business logic methods
│   └── base.controller.ts    # HTTP endpoints
├── decorators/                # Custom decorators
│   ├── current-user.decorator.ts  # @CurrentUser()
│   ├── public.decorator.ts        # @Public()
│   ├── roles.decorator.ts         # @Roles('admin')
│   └── api-swagger.decorator.ts   # @ApiSwagger()
├── filters/                   # Exception filters
│   └── http-exception.filter.ts
├── guards/                    # Guards
│   ├── jwt-auth.guard.ts     # JWT authentication
│   └── roles.guard.ts        # Role-based access
├── interceptors/              # Interceptors
│   ├── transform.interceptor.ts   # Wrap responses
│   └── logging.interceptor.ts     # Log requests
└── pipes/                     # Pipes
    └── validation.pipe.ts    # Validate DTOs
```

### Modules Directory

**Purpose:** Feature-specific code organized by domain

```
src/modules/
├── auth/                      # Authentication
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.module.ts
│   └── dtos/
├── users/                     # User management
│   ├── user.entity.ts
│   ├── user.repository.ts
│   ├── user.service.ts
│   ├── user.controller.ts
│   ├── user.module.ts
│   └── dtos/
└── features/                  # Demo feature (can be removed)
```

### Infrastructure Directory

**Purpose:** External services and utilities

```
src/infrastructure/
├── mail/                      # Email service
│   ├── mail.service.ts
│   └── mail.module.ts
├── s3/                        # File storage
│   ├── s3.service.ts
│   └── s3.module.ts
├── token/                     # Token management
│   ├── token.service.ts
│   └── token.module.ts
└── logging/                   # Winston logger
    └── winston.logger.ts
```

---

## Separation of Concerns

### What Goes Where

**Controller Layer:**

- ✅ Route definitions (@Get, @Post, etc.)
- ✅ HTTP decorators (@Param, @Body, @Query)
- ✅ Swagger decorators (@ApiTags, @ApiSwagger)
- ✅ Custom decorators (@Public, @Roles, @CurrentUser)
- ✅ Delegate to service
- ❌ Business logic
- ❌ Database operations
- ❌ Complex validations (use service)

**Service Layer:**

- ✅ Business logic
- ✅ Business rules enforcement
- ✅ Orchestrate multiple repositories
- ✅ Transaction management
- ✅ Complex calculations
- ✅ External service calls
- ❌ HTTP concerns (Request/Response)
- ❌ Direct TypeORM queries (use repository)
- ❌ Route-specific logic

**Repository Layer:**

- ✅ TypeORM operations
- ✅ Query construction
- ✅ Query optimization (select, relations)
- ✅ Database error handling
- ✅ Custom queries
- ❌ Business logic
- ❌ HTTP concerns
- ❌ Business decisions

**Entity Layer:**

- ✅ Database schema definition
- ✅ Column definitions
- ✅ Relationships
- ✅ Database constraints
- ❌ Business logic
- ❌ Validation logic (use DTOs)

### Example: User Creation Flow

**Controller:**

```typescript
@Post()
@ApiSwagger({
    resourceName: 'User',
    operation: 'create',
    responseDto: UserResponseDto,
})
async create(@Body() createUserDto: CreateUserDto): Promise<CreatedResponseDto<User>> {
    const entity = await this.service.create(createUserDto);
    return new CreatedResponseDto(entity, 'User created successfully');
}
```

**Service:**

```typescript
async create(data: DeepPartial<User>): Promise<User> {
    // Business rule: Check if email already exists
    const existing = await this.repository.findOne({
        where: { email: data.email }
    });

    if (existing) {
        throw new ConflictException('Email already exists');
    }

    // Business rule: Validate roles
    if (data.roles && !this.areValidRoles(data.roles)) {
        throw new BadRequestException('Invalid roles');
    }

    // Create user
    return this.repository.create(data);
}

private areValidRoles(roles: string[]): boolean {
    const validRoles = ['user', 'admin', 'operations'];
    return roles.every(role => validRoles.includes(role));
}
```

**Repository:**

```typescript
async create(data: DeepPartial<User>): Promise<User> {
    const entity = this.repository.create(data);
    return await this.repository.save(entity);
}
```

**Notice:** Each layer has clear, distinct responsibilities!

---

## Example: Complete Feature Implementation

### 1. Entity (Database Schema)

```typescript
import { Entity, Column } from 'typeorm';
import { BaseEntity } from 'src/core/base';

@Entity('products')
export class Product extends BaseEntity {
    @Column()
    name: string;

    @Column('text')
    description: string;

    @Column('decimal', { precision: 10, scale: 2 })
    price: number;

    @Column({ default: true })
    isActive: boolean;
}
```

### 2. Repository (Data Access)

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from 'src/core/base';
import { Product } from './product.entity';

@Injectable()
export class ProductRepository extends BaseRepository<Product> {
    constructor(
        @InjectRepository(Product)
        repository: Repository<Product>,
    ) {
        super(repository);
    }

    async findActive(): Promise<Product[]> {
        return this.findAll({ where: { isActive: true } });
    }
}
```

### 3. Service (Business Logic)

```typescript
import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/core/base';
import { Product } from './product.entity';
import { ProductRepository } from './product.repository';

@Injectable()
export class ProductService extends BaseService<Product> {
    constructor(protected readonly repository: ProductRepository) {
        super(repository, 'Product');
    }

    async getActiveProducts(): Promise<Product[]> {
        return this.repository.findActive();
    }
}
```

### 4. Controller (HTTP Layer)

```typescript
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BaseController } from 'src/core/base';
import { Product } from './product.entity';
import { ProductService } from './product.service';
import { CreateProductDto, UpdateProductDto } from './dtos';

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

    // All CRUD operations inherited automatically!
    // - POST   /products
    // - GET    /products
    // - GET    /products/:id
    // - PATCH  /products/:id
    // - DELETE /products/:id
}
```

### 5. Module (NestJS Module)

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './product.entity';
import { ProductRepository } from './product.repository';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Product])],
    controllers: [ProductController],
    providers: [ProductService, ProductRepository],
    exports: [ProductService],
})
export class ProductModule {}
```

**Total:** 5 files, ~100 lines of code → Full CRUD API with validation, error handling, Swagger docs!

---

**Related Files:**

- [SKILL.md](../SKILL.md) - Main guide
- [routing-and-controllers.md](routing-and-controllers.md) - Controller details
- [services-and-repositories.md](services-and-repositories.md) - Service/Repository patterns
- [database-patterns.md](database-patterns.md) - TypeORM and entity details
