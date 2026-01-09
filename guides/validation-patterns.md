# Validation Patterns - class-validator in NestJS

Complete guide to input validation using class-validator and DTOs in NestJS applications.

## Table of Contents

- [Validation Overview](#validation-overview)
- [class-validator Decorators](#class-validator-decorators)
- [DTO Patterns](#dto-patterns)
- [Global ValidationPipe](#global-validationpipe)
- [Custom Validators](#custom-validators)
- [Swagger Integration](#swagger-integration)
- [Common Validation Patterns](#common-validation-patterns)

---

## Validation Overview

### Why class-validator?

NestJS uses **class-validator** with **class-transformer** for validation:

**Benefits:**

- ✅ **Decorator-based** - Clean, declarative syntax
- ✅ **Type-safe** - Works with TypeScript classes
- ✅ **Automatic** - ValidationPipe handles everything
- ✅ **Swagger integration** - Auto-generates API docs
- ✅ **Comprehensive** - 100+ built-in validators
- ✅ **Custom validators** - Easy to extend

### Validation Flow

```
1. HTTP Request → Controller endpoint
2. ValidationPipe intercepts @Body(), @Query(), @Param()
3. class-transformer transforms plain object to class instance
4. class-validator validates decorators
5. If valid → Continue to controller
   If invalid → Throw BadRequestException automatically
```

---

## class-validator Decorators

### String Validators

```typescript
import {
    IsString,
    IsEmail,
    IsUrl,
    IsUUID,
    MinLength,
    MaxLength,
    Matches,
    IsNotEmpty,
    IsOptional,
} from 'class-validator';

export class CreateUserDto {
    @IsEmail({}, { message: 'Invalid email format' })
    @IsNotEmpty({ message: 'Email is required' })
    email: string;

    @IsString()
    @MinLength(2, { message: 'Name must be at least 2 characters' })
    @MaxLength(100, { message: 'Name must not exceed 100 characters' })
    name: string;

    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters' })
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
        message: 'Password must contain uppercase, lowercase, and number',
    })
    password: string;

    @IsUrl({}, { message: 'Invalid URL format' })
    @IsOptional() // Field is optional
    website?: string;

    @IsUUID('4', { message: 'Invalid UUID format' })
    @IsOptional()
    referrerId?: string;
}
```

### Number Validators

```typescript
import {
    IsNumber,
    IsInt,
    IsPositive,
    Min,
    Max,
    IsDecimal,
} from 'class-validator';

export class CreateProductDto {
    @IsNumber({}, { message: 'Price must be a number' })
    @IsPositive({ message: 'Price must be positive' })
    @Min(0.01, { message: 'Price must be at least 0.01' })
    @Max(999999, { message: 'Price must not exceed 999999' })
    price: number;

    @IsInt({ message: 'Stock must be an integer' })
    @Min(0, { message: 'Stock cannot be negative' })
    stock: number;

    @IsDecimal(
        { decimal_digits: '2' },
        { message: 'Discount must have 2 decimal places' },
    )
    @IsOptional()
    discount?: number;
}
```

### Boolean Validators

```typescript
import { IsBoolean } from 'class-validator';

export class UpdateUserDto {
    @IsBoolean({ message: 'isActive must be a boolean' })
    @IsOptional()
    isActive?: boolean;

    @IsBoolean()
    @IsOptional()
    emailVerified?: boolean;
}
```

### Date Validators

```typescript
import { IsDate, MinDate, MaxDate } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEventDto {
    @IsDate({ message: 'Start date must be a valid date' })
    @Type(() => Date) // Transform string to Date
    startDate: Date;

    @IsDate()
    @MinDate(new Date(), { message: 'End date must be in the future' })
    @Type(() => Date)
    endDate: Date;
}
```

### Array Validators

```typescript
import {
    IsArray,
    ArrayMinSize,
    ArrayMaxSize,
    ArrayNotEmpty,
    IsString,
    IsIn,
} from 'class-validator';

export class CreateUserDto {
    @IsArray({ message: 'Roles must be an array' })
    @ArrayNotEmpty({ message: 'At least one role is required' })
    @ArrayMinSize(1)
    @ArrayMaxSize(5)
    @IsString({ each: true, message: 'Each role must be a string' })
    @IsIn(['user', 'admin', 'operations'], {
        each: true,
        message: 'Invalid role',
    })
    roles: string[];

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    tags?: string[];
}
```

### Enum Validators

```typescript
import { IsEnum } from 'class-validator';

enum UserRole {
    USER = 'user',
    ADMIN = 'admin',
    OPERATIONS = 'operations',
}

enum OrderStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
}

export class CreateUserDto {
    @IsEnum(UserRole, { message: 'Invalid role' })
    role: UserRole;
}

export class UpdateOrderDto {
    @IsEnum(OrderStatus, { message: 'Invalid order status' })
    status: OrderStatus;
}
```

### Nested Object Validators

```typescript
import { ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

class AddressDto {
    @IsString()
    @IsNotEmpty()
    street: string;

    @IsString()
    @IsNotEmpty()
    city: string;

    @IsString()
    @MinLength(5)
    @MaxLength(10)
    zipCode: string;
}

export class CreateUserDto {
    @IsString()
    name: string;

    @ValidateNested()
    @Type(() => AddressDto)
    @IsOptional()
    address?: AddressDto;
}
```

---

## DTO Patterns

### Create DTO

```typescript
// src/modules/users/dtos/create-user.dto.ts
import {
    IsEmail,
    IsString,
    MinLength,
    MaxLength,
    IsArray,
    IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
    @ApiProperty({
        example: 'user@example.com',
        description: 'User email address',
    })
    @IsEmail({}, { message: 'Invalid email format' })
    @IsNotEmpty()
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
        description: 'User password (min 8 characters)',
        minLength: 8,
    })
    @IsString()
    @MinLength(8)
    password: string;

    @ApiProperty({
        example: ['user'],
        description: 'User roles',
        type: [String],
        default: ['user'],
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    roles?: string[];
}
```

### Update DTO with PartialType

```typescript
// src/modules/users/dtos/update-user.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { OmitType } from '@nestjs/swagger';

// Makes all fields optional
export class UpdateUserDto extends PartialType(CreateUserDto) {}

// Or exclude specific fields:
export class UpdateUserDto extends PartialType(
    OmitType(CreateUserDto, ['email', 'password'] as const),
) {}
```

### Query DTO for Filtering

```typescript
// src/shared/dtos/pagination.dto.ts
import { IsInt, Min, Max, IsOptional, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PaginationDto {
    @ApiProperty({
        required: false,
        default: 1,
        minimum: 1,
    })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @IsOptional()
    page?: number = 1;

    @ApiProperty({
        required: false,
        default: 10,
        minimum: 1,
        maximum: 100,
    })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    @IsOptional()
    limit?: number = 10;

    @ApiProperty({
        required: false,
        example: 'name',
    })
    @IsString()
    @IsOptional()
    sortBy?: string;

    @ApiProperty({
        required: false,
        enum: ['ASC', 'DESC'],
        default: 'ASC',
    })
    @IsIn(['ASC', 'DESC'])
    @IsOptional()
    order?: 'ASC' | 'DESC' = 'ASC';
}
```

### Response DTO

```typescript
// src/modules/users/dtos/user-response.dto.ts
import { Exclude, Expose } from 'class-transformer';

export class UserResponseDto {
    @Expose()
    id: string;

    @Expose()
    email: string;

    @Expose()
    name: string;

    @Exclude() // Never expose password in response
    password: string;

    @Expose()
    roles: string[];

    @Expose()
    createdAt: Date;

    @Expose()
    updatedAt: Date;
}
```

---

## Global ValidationPipe

### Configuration in main.ts

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Global ValidationPipe
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true, // Strip non-DTO properties
            forbidNonWhitelisted: true, // Throw error on extra properties
            transform: true, // Auto-transform to DTO class
            transformOptions: {
                enableImplicitConversion: true, // Convert types automatically
            },
            disableErrorMessages: false, // Keep error messages in production
        }),
    );

    await app.listen(4000);
}
bootstrap();
```

### ValidationPipe Options Explained

```typescript
{
    // Remove properties not defined in DTO
    whitelist: true,

    // Throw error if extra properties sent
    forbidNonWhitelisted: true,

    // Auto-transform plain objects to DTO instances
    transform: true,

    // Auto-convert types (string "123" → number 123)
    transformOptions: {
        enableImplicitConversion: true,
    },

    // Show validation errors (even in production)
    disableErrorMessages: false,

    // Stop at first error (vs validate all)
    stopAtFirstError: false,

    // Skip missing properties validation
    skipMissingProperties: false,
}
```

---

## Custom Validators

### Custom Decorator Example

```typescript
// src/core/validators/is-strong-password.validator.ts
import {
    registerDecorator,
    ValidationOptions,
    ValidatorConstraint,
    ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class IsStrongPasswordConstraint
    implements ValidatorConstraintInterface
{
    validate(password: string): boolean {
        // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special char
        const strongPasswordRegex =
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        return strongPasswordRegex.test(password);
    }

    defaultMessage(): string {
        return 'Password must be at least 8 characters with uppercase, lowercase, number, and special character';
    }
}

export function IsStrongPassword(validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [],
            validator: IsStrongPasswordConstraint,
        });
    };
}

// Usage:
export class CreateUserDto {
    @IsStrongPassword()
    password: string;
}
```

### Async Custom Validator (Check Database)

```typescript
// src/modules/users/validators/is-email-unique.validator.ts
import { Injectable } from '@nestjs/common';
import {
    registerDecorator,
    ValidationOptions,
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments,
} from 'class-validator';
import { UserRepository } from '../user.repository';

@ValidatorConstraint({ async: true })
@Injectable()
export class IsEmailUniqueConstraint implements ValidatorConstraintInterface {
    constructor(private readonly userRepository: UserRepository) {}

    async validate(email: string, args: ValidationArguments): Promise<boolean> {
        const user = await this.userRepository.findOne({ where: { email } });
        return !user; // Return true if email doesn't exist
    }

    defaultMessage(): string {
        return 'Email $value already exists';
    }
}

export function IsEmailUnique(validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [],
            validator: IsEmailUniqueConstraint,
        });
    };
}

// Usage:
export class CreateUserDto {
    @IsEmail()
    @IsEmailUnique() // Checks database
    email: string;
}

// Register in module:
@Module({
    providers: [IsEmailUniqueConstraint],
})
export class UserModule {}
```

### Conditional Validation

```typescript
import { ValidateIf } from 'class-validator';

export class CreateOrderDto {
    @IsEnum(PaymentMethod)
    paymentMethod: PaymentMethod;

    // Only validate if paymentMethod is 'credit_card'
    @ValidateIf((o) => o.paymentMethod === 'credit_card')
    @IsString()
    @MinLength(16)
    @MaxLength(16)
    cardNumber?: string;

    @ValidateIf((o) => o.paymentMethod === 'credit_card')
    @IsString()
    @Matches(/^(0[1-9]|1[0-2])\/\d{2}$/)
    expiryDate?: string;
}
```

---

## Swagger Integration

### Complete DTO with Swagger

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsEmail,
    IsString,
    MinLength,
    IsOptional,
    IsArray,
} from 'class-validator';

export class CreateUserDto {
    @ApiProperty({
        description: 'User email address',
        example: 'user@example.com',
        format: 'email',
    })
    @IsEmail({}, { message: 'Invalid email format' })
    email: string;

    @ApiProperty({
        description: 'User full name',
        example: 'John Doe',
        minLength: 2,
        maxLength: 100,
    })
    @IsString()
    @MinLength(2)
    @MaxLength(100)
    name: string;

    @ApiProperty({
        description: 'User password',
        example: 'SecurePassword123',
        minLength: 8,
        format: 'password',
    })
    @IsString()
    @MinLength(8)
    password: string;

    @ApiPropertyOptional({
        description: 'User roles',
        example: ['user'],
        type: [String],
        default: ['user'],
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    roles?: string[];
}
```

---

## Common Validation Patterns

### Email Validation

```typescript
@IsEmail({}, { message: 'Invalid email format' })
@IsNotEmpty()
email: string;
```

### Password Validation

```typescript
@IsString()
@MinLength(8, { message: 'Password must be at least 8 characters' })
@Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain uppercase, lowercase, and number',
})
password: string;
```

### UUID Validation

```typescript
@IsUUID('4', { message: 'Invalid UUID format' })
id: string;
```

### Phone Number Validation

```typescript
@IsString()
@Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Invalid phone number format (E.164)',
})
@IsOptional()
phone?: string;
```

### URL Validation

```typescript
@IsUrl({}, { message: 'Invalid URL format' })
@IsOptional()
website?: string;
```

### Date Range Validation

```typescript
@IsDate()
@Type(() => Date)
@MinDate(new Date(), { message: 'Start date must be in the future' })
startDate: Date;

@IsDate()
@Type(() => Date)
@MinDate(new Date(), { message: 'End date must be after start date' })
endDate: Date;
```

### File Upload Validation

```typescript
import { IsNotEmpty, IsString, IsMimeType } from 'class-validator';

export class FileUploadDto {
    @IsString()
    @IsNotEmpty()
    filename: string;

    @IsString()
    @IsMimeType({ message: 'Invalid file type' })
    mimetype: string;

    @IsNumber()
    @Max(5242880, { message: 'File size must not exceed 5MB' })
    size: number;
}
```

---

## Validation Error Response

When validation fails, NestJS automatically returns:

```json
{
    "success": false,
    "statusCode": 400,
    "message": "Validation failed",
    "errors": [
        {
            "field": "email",
            "constraints": {
                "isEmail": "Invalid email format",
                "isNotEmpty": "Email is required"
            }
        },
        {
            "field": "password",
            "constraints": {
                "minLength": "Password must be at least 8 characters"
            }
        }
    ],
    "timestamp": "2024-01-01T12:00:00.000Z",
    "path": "/api/users"
}
```

---

## Best Practices Summary

### ✅ DO:

- Use class-validator decorators on all DTOs
- Enable global ValidationPipe with whitelist
- Provide custom error messages
- Use @ApiProperty for Swagger documentation
- Create separate DTOs for create/update/response
- Use PartialType for update DTOs
- Transform types with @Type() decorator
- Validate nested objects with @ValidateNested
- Use @IsOptional for optional fields
- Create custom validators for complex rules

### ❌ DON'T:

- Skip validation on user input
- Use plain objects instead of class DTOs
- Forget to enable transform: true
- Mix validation logic in services
- Expose sensitive fields in response DTOs
- Use any type
- Skip Swagger decorators
- Forget @Type() for dates and nested objects
- Allow arbitrary extra properties (use whitelist)
- Write validation logic in controllers

---

**Related Files:**

- [SKILL.md](../SKILL.md) - Main guide
- [routing-and-controllers.md](routing-and-controllers.md) - DTO usage in controllers
- [services-and-repositories.md](services-and-repositories.md) - Service layer
- [database-patterns.md](database-patterns.md) - Entity validation
