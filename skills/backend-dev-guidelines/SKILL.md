---
name: backend-dev-guidelines
description: Comprehensive backend development guide for NestJS/TypeScript applications. Use when creating routes, controllers, services, repositories, entities, or working with NestJS APIs, TypeORM database access, class-validator validation, JWT authentication, dependency injection, or async patterns. Covers four-layer architecture (Controller → Service → Repository → Entity), BaseController/BaseService/BaseRepository patterns, error handling, authentication, testing strategies, E2E test generation, and best practices. Auto-suggests E2E tests after creating new controllers or API endpoints.
---

# Backend Development Guidelines - NestJS

## Purpose

Establish consistency and best practices for NestJS applications using the **four-layer architecture pattern** with base classes that provide 90% of boilerplate automatically.

## When to Use This Skill

Automatically activates when working on:

- Creating or modifying controllers, services, repositories, entities
- Building REST APIs with NestJS
- Database operations with TypeORM
- Input validation with class-validator
- JWT + Cookie authentication
- Dependency injection patterns
- Backend testing and refactoring
- Error handling and global filters

---

## Quick Start

### New Feature Checklist

- [ ] **Entity**: Extend BaseEntity (UUID, timestamps, soft delete)
- [ ] **Repository**: Extend BaseRepository<Entity>
- [ ] **Service**: Extend BaseService<Entity>
- [ ] **Controller**: Extend BaseController<Entity, CreateDto, UpdateDto>
- [ ] **DTOs**: Create DTO with class-validator decorators
- [ ] **Module**: Register in feature module
- [ ] **Tests**: Unit tests for service logic
- [ ] **Swagger**: Add @ApiTags and @ApiSwagger decorators

### New NestJS Project Checklist

- [ ] Clone NestJS Starter Kit
- [ ] Configure environment (.env)
- [ ] Setup Git hooks (npm run prepare)
- [ ] Run database migrations
- [ ] Review base classes (src/core/base/)
- [ ] Read documentation (docs/)
- [ ] Verify setup (npm run lint && npm test)

---

## Architecture Overview

### Four-Layer Pattern

```
HTTP Request
    ↓
Controller (HTTP handling)
    ↓
Service (business logic)
    ↓
Repository (data access)
    ↓
Database (TypeORM + PostgreSQL)
```

**Key Principle:** Each layer extends base classes that provide 90% of functionality automatically.

See [architecture-overview.md](resources/architecture-overview.md) for complete details.

---

## Directory Structure

```
src/
├── core/                      # Framework core
│   ├── base/                  # Base classes (MUST EXTEND)
│   ├── decorators/            # @CurrentUser, @Public, @Roles
│   ├── filters/               # Exception filters
│   ├── guards/                # JWT auth guards
│   ├── interceptors/          # Transform, logging
│   └── pipes/                 # Validation pipes
├── modules/                   # Feature modules
│   ├── users/                 # User management
│   │   ├── user.entity.ts    # Extends BaseEntity
│   │   ├── user.repository.ts # Extends BaseRepository
│   │   ├── user.service.ts   # Extends BaseService
│   │   ├── user.controller.ts # Extends BaseController
│   │   ├── user.module.ts    # NestJS module
│   │   └── dtos/             # Request/Response DTOs
│   └── auth/                  # Authentication
├── shared/                    # Shared resources
│   ├── dtos/                  # Common DTOs
│   ├── constants/             # Constants
│   └── enums/                 # Enums
├── infrastructure/            # Infrastructure services
│   ├── mail/                  # Email service
│   ├── s3/                    # File storage
│   └── logging/               # Winston logger
├── database/                  # Database
│   ├── migrations/            # TypeORM migrations
│   └── seeders/               # Seeders
├── config/                    # Configuration
└── i18n/                      # Internationalization
```

---

## Core Principles (8 Key Rules)

### 1. Always Extend Base Classes

```typescript
// ✅ ALWAYS: Extend base classes
export class UserController extends BaseController<
    User,
    CreateUserDto,
    UpdateUserDto
> {
    constructor(private readonly userService: UserService) {
        super(userService);
    }
}

export class UserService extends BaseService<User> {
    constructor(protected readonly repository: UserRepository) {
        super(repository, 'User');
    }
}

export class UserRepository extends BaseRepository<User> {
    constructor() {
        super(User);
    }
}

@Entity('users')
export class User extends BaseEntity {
    @Column()
    name: string;
}
```

### 2. Use Dependency Injection (NestJS Way)

```typescript
// ✅ ALWAYS: NestJS dependency injection
@Injectable()
export class UserService extends BaseService<User> {
    constructor(
        protected readonly repository: UserRepository,
        private readonly mailService: MailService,
    ) {
        super(repository, 'User');
    }
}

// ❌ NEVER: Manual instantiation
const service = new UserService(); // Wrong!
```

### 3. Validate All Input with class-validator

```typescript
// DTOs with validation
export class CreateUserDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @MinLength(2)
    @MaxLength(100)
    name: string;
}
```

### 4. Use Custom Decorators

```typescript
// ✅ Use custom decorators
@Public()  // Bypass authentication
@Get('public-data')
async getPublicData() {}

@Roles('admin')  // Require admin role
@Delete(':id')
async deleteUser(@CurrentUser() user: IJwtPayload) {}
```

### 5. Standardized API Responses

```typescript
// All responses automatically wrapped by TransformInterceptor
return new SuccessResponseDto(user, 'User retrieved successfully');
// Returns: { success: true, statusCode: 200, message: '...', data: user, ... }
```

### 6. Error Handling with Filters

```typescript
// Throw standard NestJS exceptions
throw new NotFoundException(`User with ID ${id} not found`);
throw new BadRequestException('Invalid input');
throw new UnauthorizedException('Invalid credentials');
// Global filters handle these automatically
```

### 7. Use TypeORM Repositories

```typescript
// ✅ Extend BaseRepository
export class UserRepository extends BaseRepository<User> {
    async findByEmail(email: string): Promise<User | null> {
        return this.findOne({ where: { email } });
    }
}
```

### 8. Configure Swagger Documentation

```typescript
@ApiTags('Users')
@Controller('users')
export class UserController {
    @ApiSwagger({
        resourceName: 'User',
        operation: 'create',
        responseDto: UserResponseDto,
    })
    @Post()
    async create(@Body() dto: CreateUserDto) {}
}
```

---

## Common Imports

```typescript
// NestJS Core
import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Injectable,
    Module,
} from '@nestjs/common';

// Validation
import { IsEmail, IsString, MinLength, IsNotEmpty } from 'class-validator';

// Database
import { Entity, Column, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

// Base Classes
import {
    BaseController,
    BaseService,
    BaseRepository,
    BaseEntity,
} from 'src/core/base';

// Custom Decorators
import { CurrentUser, Public, Roles, ApiSwagger } from 'src/core/decorators';

// DTOs
import { ResponsePayloadDto, PaginatedResponseDto } from '@shared/dtos';

// Config
import { envConfigService } from 'src/config/env-config.service';
```

---

## Quick Reference

### HTTP Status Codes

| Code | Use Case     | NestJS Exception             |
| ---- | ------------ | ---------------------------- |
| 200  | Success      | -                            |
| 201  | Created      | -                            |
| 400  | Bad Request  | BadRequestException          |
| 401  | Unauthorized | UnauthorizedException        |
| 403  | Forbidden    | ForbiddenException           |
| 404  | Not Found    | NotFoundException            |
| 409  | Conflict     | ConflictException            |
| 500  | Server Error | InternalServerErrorException |

### Base Class Methods

**BaseController:**

- `create(dto)` - POST / (auto)
- `findAll(paginationDto)` - GET / (auto)
- `findOne(id)` - GET /:id (auto)
- `update(id, dto)` - PATCH /:id (auto)
- `remove(id)` - DELETE /:id (auto)

**BaseService:**

- `create(data)` - Create entity
- `findAll(options)` - Get all entities
- `findByIdOrFail(id)` - Get by ID or throw
- `update(id, data)` - Update entity
- `remove(id)` - Soft delete
- `delete(id)` - Hard delete

**BaseRepository:**

- `findAll(options)` - Find many
- `findById(id)` - Find by ID
- `create(data)` - Create entity
- `update(id, data)` - Update entity
- `softDelete(id)` - Soft delete
- `delete(id)` - Hard delete

---

## Anti-Patterns to Avoid

❌ Not extending base classes
❌ Business logic in controllers
❌ Direct TypeORM access in services (use repositories)
❌ No input validation
❌ Using process.env directly (use envConfigService)
❌ console.log instead of Winston logger
❌ Not using dependency injection
❌ Forgetting @ApiTags and @ApiSwagger decorators

---

## Navigation Guide

| Need to...              | Read this                                                              |
| ----------------------- | ---------------------------------------------------------------------- |
| Understand architecture | [architecture-overview.md](resources/architecture-overview.md)         |
| Create controllers      | [routing-and-controllers.md](resources/routing-and-controllers.md)     |
| Organize business logic | [services-and-repositories.md](resources/services-and-repositories.md) |
| Validate input          | [validation-patterns.md](resources/validation-patterns.md)             |
| Database operations     | [database-patterns.md](resources/database-patterns.md)                 |
| Configure environment   | [configuration.md](resources/configuration.md)                         |
| Handle errors           | [async-and-errors.md](resources/async-and-errors.md)                   |
| Write tests             | [testing-guide.md](resources/testing-guide.md)                         |
| Add authentication      | [middleware-guide.md](resources/middleware-guide.md)                   |
| See examples            | [complete-examples.md](resources/complete-examples.md)                 |
| Error tracking          | [sentry-and-monitoring.md](resources/sentry-and-monitoring.md)         |
| Generate API docs       | [generate-api-docs.md](resources/generate-api-docs.md)                 |

---

## Resource Files

### [architecture-overview.md](resources/architecture-overview.md)

Four-layer architecture, NestJS modules, base classes pattern

### [routing-and-controllers.md](resources/routing-and-controllers.md)

BaseController pattern, decorators, CRUD operations, Swagger

### [services-and-repositories.md](resources/services-and-repositories.md)

BaseService pattern, business logic, BaseRepository, dependency injection

### [validation-patterns.md](resources/validation-patterns.md)

class-validator, DTOs, ValidationPipe, custom validators

### [database-patterns.md](resources/database-patterns.md)

TypeORM entities, repositories, migrations, relationships

### [configuration.md](resources/configuration.md)

envConfigService, environment variables, configuration management

### [middleware-guide.md](resources/middleware-guide.md)

Guards, interceptors, pipes, JWT authentication, RBAC

### [async-and-errors.md](resources/async-and-errors.md)

Exception filters, custom errors, global error handling

### [testing-guide.md](resources/testing-guide.md)

Unit/integration tests, mocking, Jest configuration

### [sentry-and-monitoring.md](resources/sentry-and-monitoring.md)

Winston logger, error tracking, performance monitoring

### [complete-examples.md](resources/complete-examples.md)

Full CRUD examples, feature implementation guide

### [generate-api-docs.md](resources/generate-api-docs.md)

Generate Markdown API documentation from controllers and DTOs. Output: `.claude-project/docs/PROJECT_API.md`

---

## Project Documentation

The NestJS Starter Kit includes 15+ comprehensive guides in `/docs`:

**Critical Reading:**

- DEVELOPER-ONBOARDING.md - Complete setup guide
- GIT-WORKFLOW-GUIDE.md - Git hooks and commit standards (MANDATORY)
- BASE-CONTROLLER-GUIDE.md - Four-layer architecture details

**Implementation Guides:**

- AUTHENTICATION-GUIDE.md - JWT + Cookie auth
- ERROR-HANDLING-GUIDE.md - Exception patterns
- RESPONSE-SYSTEM-SUMMARY.md - API response format

---

## Related Skills

- **frontend-dev-guidelines** - Frontend patterns for NestJS APIs
- **skill-developer** - Meta-skill for creating and managing skills

---

**Skill Status**: UPDATED FOR NESTJS ✅
**Framework**: NestJS 11+ with TypeScript 5.7+ ✅
**Database**: TypeORM with PostgreSQL ✅
**Progressive Disclosure**: 11 resource files ✅
