---
skill_name: organize-types
applies_to_local_project_only: true
auto_trigger_regex: [organize types, typescript types, type organization, dto types, entity types, barrel exports, refactor types, type structure]
tags: [code-quality, typescript, types, organization, refactoring, dto, entity]
related_skills: [backend-dev-guidelines]
---

# Organize Types - NestJS

Analyze and maintain TypeScript type organization in NestJS backend codebase.

## What this skill does

Scans the NestJS codebase to identify type organization issues and maintain the established type structure:

1. **Find misplaced types**: Identify type definitions outside proper locations
2. **Detect duplicates**: Find duplicate type definitions across multiple files
3. **Check DTO organization**: Ensure DTOs follow naming conventions
4. **Validate entity types**: Check entity definitions are properly structured
5. **Check barrel exports**: Validate that index files are up-to-date

## When to use this skill

Run this skill when:
- **Adding new API endpoints** - to ensure DTOs are properly organized
- **Creating new modules** - to organize entity and DTO types
- **Refactoring services** - to check for duplicate types
- **Before releases** - to maintain clean type organization
- **After major changes** - to verify type organization consistency

## Type Organization Structure

NestJS uses a modular approach to organize TypeScript types:

```
backend/src/
├── core/
│   ├── types/                    # Shared types across modules
│   │   ├── index.ts              # Barrel export
│   │   ├── pagination.ts         # PaginatedResponse<T>, PaginationQuery
│   │   ├── response.ts           # ApiResponse<T>, ErrorResponse
│   │   └── common.ts             # UserRole, Status enums
│   ├── interfaces/               # Core interfaces
│   │   ├── index.ts
│   │   └── base-service.interface.ts
│   └── decorators/               # Custom decorators with types
├── modules/
│   └── {feature}/
│       ├── dto/                  # Feature DTOs
│       │   ├── index.ts          # Barrel export
│       │   ├── create-{feature}.dto.ts
│       │   ├── update-{feature}.dto.ts
│       │   └── {feature}-response.dto.ts
│       ├── entities/             # TypeORM entities
│       │   └── {feature}.entity.ts
│       └── interfaces/           # Feature-specific interfaces
│           └── {feature}.interface.ts
```

## Organization Rules

### 1. DTOs → `modules/{feature}/dto/`

```typescript
// ✅ GOOD: DTO in module's dto folder
// modules/user/dto/create-user.dto.ts
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ minLength: 8 })
    @MinLength(8)
    @IsNotEmpty()
    password: string;
}

// ❌ BAD: DTO in service file
// modules/user/user.service.ts
interface CreateUserInput { // Should be a DTO class!
    email: string;
    password: string;
}
```

### 2. Entities → `modules/{feature}/entities/`

```typescript
// ✅ GOOD: Entity with proper decorators
// modules/user/entities/user.entity.ts
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '@/core/base/base.entity';

@Entity('users')
export class User extends BaseEntity {
    @Column({ unique: true })
    email: string;

    @Column()
    password: string;
}

// ❌ BAD: Entity type inline in service
// modules/user/user.service.ts
type UserEntity = { // Should use Entity class!
    id: string;
    email: string;
}
```

### 3. Response DTOs → `modules/{feature}/dto/`

```typescript
// ✅ GOOD: Response DTO with Swagger
// modules/user/dto/user-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class UserResponseDto {
    @Expose()
    @ApiProperty()
    id: string;

    @Expose()
    @ApiProperty()
    email: string;

    @Expose()
    @ApiProperty()
    createdAt: Date;

    // password excluded by @Exclude()
}
```

### 4. Shared Types → `core/types/`

```typescript
// ✅ GOOD: Shared pagination type
// core/types/pagination.ts
export interface PaginationQuery {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}
```

### 5. Enums → `core/types/` or inline with DTO

```typescript
// ✅ GOOD: Shared enum in core
// core/types/common.ts
export enum UserRole {
    ADMIN = 'admin',
    USER = 'user',
    GUEST = 'guest',
}

export enum Status {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    PENDING = 'pending',
}

// ✅ ALSO GOOD: Feature-specific enum with DTO
// modules/order/dto/create-order.dto.ts
export enum OrderStatus {
    PENDING = 'pending',
    CONFIRMED = 'confirmed',
    SHIPPED = 'shipped',
}
```

## What to Check

### ✅ Good Practices
- DTOs in `modules/{feature}/dto/` with class-validator decorators
- Entities in `modules/{feature}/entities/` with TypeORM decorators
- Response DTOs with class-transformer decorators
- Shared types in `core/types/`
- Barrel exports (`index.ts`) in each type folder
- Swagger decorators on all DTO properties

### ❌ Issues to Flag
- Type definitions in service files
- Interface used where DTO class needed (validation won't work)
- Duplicate type definitions across modules
- Missing Swagger decorators on DTOs
- Inline types in controllers
- Missing barrel exports

## Example Output

When running this skill, provide a report like this:

```
## Type Organization Report

### ✅ Well Organized
- modules/user/dto/create-user.dto.ts - Proper DTO with validation
- modules/user/entities/user.entity.ts - Entity with TypeORM decorators
- core/types/pagination.ts - Shared pagination types

### ⚠️ Issues Found

**1. Interface Used Instead of DTO Class**
- modules/order/order.service.ts:15
  `interface CreateOrderInput { ... }`
  **Action**: Create CreateOrderDto class with class-validator decorators

**2. Duplicate Types**
- `UserRole` defined in:
  - core/types/common.ts ✅
  - modules/auth/auth.service.ts ❌
  **Action**: Remove from auth.service.ts, import from core/types

**3. Missing Swagger Decorators**
- modules/product/dto/create-product.dto.ts
  **Action**: Add @ApiProperty() to all fields

**4. Inline Type Definition**
- modules/payment/payment.controller.ts:28
  `type PaymentResult = { success: boolean; ... }`
  **Action**: Move to dto/payment-result.dto.ts

### 📊 Summary
- Total type files: 45
- Well organized: 38 (84%)
- Issues: 7 (16%)
```

## Common Patterns

### DTO Naming Convention

```typescript
// Create operations
CreateUserDto
CreateOrderDto

// Update operations
UpdateUserDto
UpdateOrderDto

// Response types
UserResponseDto
OrderResponseDto
PaginatedOrderResponseDto

// Query/Filter types
UserQueryDto
OrderFilterDto
```

### Barrel Exports

```typescript
// modules/user/dto/index.ts
export * from './create-user.dto';
export * from './update-user.dto';
export * from './user-response.dto';
export * from './user-query.dto';

// Usage in service
import { CreateUserDto, UserResponseDto } from './dto';
```

### Type Imports

```typescript
// ✅ GOOD: Import from barrel
import { CreateUserDto } from './dto';
import { User } from './entities';
import { PaginatedResponse } from '@/core/types';

// ❌ BAD: Deep imports
import { CreateUserDto } from './dto/create-user.dto';
```

## Instructions for Claude

When this skill is invoked:

1. **Scan for type definitions**:
   - Search for `interface`, `type`, `enum` in service/controller files
   - Check that DTOs use `class` with decorators

2. **Check DTO structure**:
   - Verify class-validator decorators present
   - Verify @ApiProperty decorators for Swagger
   - Check naming conventions

3. **Validate entity types**:
   - Check TypeORM decorators
   - Verify extends BaseEntity (if applicable)

4. **Check barrel exports**:
   - Ensure each dto/entities folder has index.ts
   - Verify all types are exported

5. **Generate report**:
   - List well-organized types
   - Flag issues with specific actions
   - Provide summary statistics

## Related Documentation

- [validation-patterns.md](../../guides/validation-patterns.md) - DTO validation
- [database-patterns.md](../../guides/database-patterns.md) - Entity patterns
- [NestJS DTOs](https://docs.nestjs.com/techniques/validation)
