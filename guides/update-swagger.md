# Swagger Documentation Guide

This guide explains how to properly document APIs with Swagger in this NestJS project. Follow these patterns to ensure consistent, high-quality API documentation.

## Quick Reference

### Good Examples to Follow

- **Authentication**: `src/modules/auth/dtos/*.dto.ts`, `src/modules/auth/auth.controller.ts`
- **Users**: `src/modules/users/dtos/*.dto.ts`, `src/modules/users/user.controller.ts`
- **Features**: `src/modules/features/dto/*.dto.ts`, `src/modules/features/feature.controller.ts`
- **OTP**: `src/modules/otp/dtos/*.dto.ts`, `src/modules/otp/otp.controller.ts`

---

## 1. DTO Property Documentation

### Required Properties

Use `@ApiProperty()` with meaningful examples and descriptions:

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
    @ApiProperty({
        description: 'User email address',
        example: 'user@example.com',
        format: 'email',
    })
    @IsEmail()
    email: string;

    @ApiProperty({
        description: 'User password (minimum 8 characters)',
        example: 'SecurePassword123!',
        minLength: 8,
    })
    @IsString()
    @MinLength(8)
    password: string;
}
```

### Optional Properties

Use `@ApiPropertyOptional()` for optional fields:

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
    @ApiPropertyOptional({
        description: 'User first name',
        example: 'John',
    })
    @IsOptional()
    @IsString()
    firstName?: string;
}
```

### Property Options Reference

| Option                    | Usage                                  | Example                                               |
| ------------------------- | -------------------------------------- | ----------------------------------------------------- |
| `example`                 | **Required** - Realistic example value | `'user@example.com'`                                  |
| `description`             | **Required** - Clear field description | `'User email address'`                                |
| `format`                  | Standard format hint                   | `'email'`, `'uuid'`, `'date-time'`, `'date'`, `'uri'` |
| `enum`                    | Enum type reference                    | `enum: RolesEnum`                                     |
| `minLength` / `maxLength` | String length constraints              | `minLength: 8`                                        |
| `minimum` / `maximum`     | Number range constraints               | `minimum: 0, maximum: 100`                            |
| `pattern`                 | Regex pattern                          | `'^([01]\\d\|2[0-3]):([0-5]\\d)$'`                    |
| `default`                 | Default value                          | `default: true`                                       |
| `type`                    | Array item type                        | `type: [String]`                                      |
| `nullable`                | Allow null                             | `nullable: true`                                      |

---

## 2. Realistic Example Values by Type

### UUIDs

```typescript
@ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'User unique identifier (UUID)',
    format: 'uuid',
})
id: string;
```

### Emails

```typescript
@ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
    format: 'email',
})
email: string;
```

### Passwords

```typescript
@ApiProperty({
    example: 'SecurePassword123!',
    description: 'User password (minimum 8 characters)',
    minLength: 8,
})
password: string;
```

### URLs

```typescript
@ApiProperty({
    example: 'https://example.com/images/photo.jpg',
    description: 'Profile image URL',
    format: 'uri',
})
imageUrl: string;

// Video URLs
@ApiProperty({
    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    description: 'Exercise demonstration video URL',
})
videoUrl: string;

// Zoom links
@ApiProperty({
    example: 'https://zoom.us/j/1234567890?pwd=abc123',
    description: 'Zoom meeting link',
})
zoomLink: string;
```

### Dates and Times

```typescript
// ISO DateTime
@ApiProperty({
    example: '2025-01-20T14:30:00.000Z',
    description: 'Scheduled date and time',
    format: 'date-time',
})
scheduledAt: string;

// Date only
@ApiProperty({
    example: '2025-01-15',
    description: 'Survey date',
    format: 'date',
})
date: string;

// Time only (HH:MM)
@ApiProperty({
    example: '22:30',
    description: 'Bedtime (HH:MM format)',
    pattern: '^([01]\\d|2[0-3]):([0-5]\\d)$',
})
bedtime: string;

// Timestamp fields
@ApiProperty({
    example: '2024-11-02T10:30:00.000Z',
    description: 'Record creation timestamp',
})
createdAt: Date;
```

### Numbers

```typescript
// Price
@ApiProperty({
    example: 199.99,
    description: 'Price in USD',
    minimum: 0,
    maximum: 999999.99,
})
price: number;

// Count/Quantity
@ApiProperty({
    example: 150,
    description: 'Stock quantity',
    minimum: 0,
})
stock: number;

// Rating (scale)
@ApiProperty({
    example: 4,
    description: 'Sleep quality rating (1-5 scale)',
    minimum: 1,
    maximum: 5,
})
sleepQuality: number;

// Steps
@ApiProperty({
    example: 7500,
    description: 'Total steps walked during the day',
    minimum: 0,
})
dailyStepCount: number;
```

### Booleans

```typescript
@ApiPropertyOptional({
    example: false,
    description: 'Keep user logged in for 30 days',
    required: false,
})
rememberMe?: boolean;

@ApiPropertyOptional({
    example: true,
    description: 'Whether the exercise is active',
    default: true,
})
isActive?: boolean;
```

### Enums

```typescript
@ApiProperty({
    enum: RolesEnum,
    example: RolesEnum.USER,
    description: 'User role',
    default: RolesEnum.USER,
})
role: RolesEnum;

@ApiProperty({
    enum: MessageTypeEnum,
    example: MessageTypeEnum.TEXT,
    description: 'Message type',
})
messageType: MessageTypeEnum;
```

### Arrays

```typescript
@ApiPropertyOptional({
    example: ['electronics', 'audio', 'wireless'],
    description: 'Tags for categorization',
    type: [String],
})
tags?: string[];
```

### Text/Description Fields

```typescript
@ApiPropertyOptional({
    example: 'High-quality wireless headphones with active noise cancellation',
    description: 'Detailed description of the feature',
    maxLength: 2000,
})
description?: string;

@ApiPropertyOptional({
    example: 'Monthly check-up to review exercise progress',
    description: 'Optional memo or notes for the meeting',
})
memo?: string;
```

---

## 3. Controller Documentation with @ApiSwagger

### Import Statement

```typescript
import { ApiSwagger } from 'src/core/decorators/api-swagger.decorator';
```

### Operation Types

| Type     | Auto-Generated Summary    | Auto Error Codes        |
| -------- | ------------------------- | ----------------------- |
| `create` | "Create a new {resource}" | 400, 409                |
| `getAll` | "Get all {resource}"      | -                       |
| `getOne` | "Get {resource} by id"    | 404                     |
| `update` | "Update {resource}"       | 400, 404, 409           |
| `delete` | "Delete {resource}"       | 404                     |
| `search` | "Search {resource}"       | -                       |
| `count`  | "Count {resource}"        | -                       |
| `custom` | Uses `summary` option     | None (specify manually) |

### CRUD Operation Examples

#### Create

```typescript
@Post()
@ApiSwagger({
    resourceName: 'Exercise',
    operation: 'create',
    requestDto: CreateExerciseDto,
    responseDto: Exercise,
    successStatus: 201,
    requiresAuth: true,
})
async create(@Body() dto: CreateExerciseDto): Promise<CreatedResponseDto<Exercise>> {
    // ...
}
```

#### Get All (with pagination)

```typescript
@Get()
@Public()
@ApiSwagger({
    resourceName: 'Exercises',
    operation: 'getAll',
    responseDto: Exercise,
    isArray: true,
    requiresAuth: false,
    withPagination: true,
})
async findAll(@Query() pagination: PaginationDto): Promise<PaginatedResponseDto<Exercise>> {
    // ...
}
```

#### Get One

```typescript
@Get(':id')
@ApiSwagger({
    resourceName: 'Exercise',
    operation: 'getOne',
    responseDto: Exercise,
    requiresAuth: true,
})
async findOne(@Param('id') id: string): Promise<SuccessResponseDto<Exercise>> {
    // ...
}
```

#### Update

```typescript
@Patch(':id')
@ApiSwagger({
    resourceName: 'Exercise',
    operation: 'update',
    requestDto: UpdateExerciseDto,
    responseDto: Exercise,
    requiresAuth: true,
})
async update(
    @Param('id') id: string,
    @Body() dto: UpdateExerciseDto,
): Promise<UpdatedResponseDto<Exercise>> {
    // ...
}
```

#### Delete

```typescript
@Delete(':id')
@ApiSwagger({
    resourceName: 'Exercise',
    operation: 'delete',
    requiresAuth: true,
})
async remove(@Param('id') id: string): Promise<DeletedResponseDto> {
    // ...
}
```

### Custom Operations

For non-standard endpoints, use `operation: 'custom'` with a specific `summary`:

```typescript
@Post('social-login')
@Public()
@ApiSwagger({
    resourceName: 'Social Login',
    operation: 'custom',
    summary: 'Social login (Google, Kakao, Naver)',
    requestDto: SocialLoginDto,
    responseDto: LoginResponsePayloadDto,
    requiresAuth: false,
    errors: [
        { status: 400, description: 'Invalid token or missing required fields' },
        { status: 401, description: 'Token verification failed' },
    ],
})
async socialLogin(@Body() dto: SocialLoginDto): Promise<LoginResponsePayloadDto> {
    // ...
}
```

```typescript
@Patch(':id/toggle-featured')
@Roles(RolesEnum.ADMIN)
@ApiSwagger({
    resourceName: 'Feature',
    operation: 'custom',
    summary: 'Toggle featured status',
    responseDto: Feature,
    requiresAuth: true,
})
async toggleFeatured(@Param('id') id: string): Promise<UpdatedResponseDto<Feature>> {
    // ...
}
```

### ApiSwagger Options Reference

| Option           | Type    | Default      | Description                               |
| ---------------- | ------- | ------------ | ----------------------------------------- |
| `resourceName`   | string  | **required** | Resource name (e.g., 'User', 'Exercise')  |
| `operation`      | string  | `'custom'`   | Operation type for auto-generated summary |
| `summary`        | string  | auto         | Custom operation summary                  |
| `requestDto`     | Type    | -            | Request body DTO class                    |
| `responseDto`    | Type    | -            | Response data DTO class                   |
| `successStatus`  | number  | 200          | HTTP success status code                  |
| `isArray`        | boolean | false        | Response is an array                      |
| `requiresAuth`   | boolean | true         | Requires authentication                   |
| `withPagination` | boolean | false        | Add pagination query params               |
| `errors`         | array   | []           | Custom error responses                    |
| `paramName`      | string  | `'id'`       | Path parameter name                       |

---

## 4. Response DTOs

Create dedicated response DTOs for complex response structures:

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RolesEnum, ActiveStatusEnum } from '@shared/enums';

export class UserResponseDto {
    @ApiProperty({
        example: '550e8400-e29b-41d4-a716-446655440000',
        description: 'User unique identifier (UUID)',
    })
    id: string;

    @ApiProperty({
        example: 'user@example.com',
        description: 'User email address',
    })
    email: string;

    @ApiPropertyOptional({
        example: 'John',
        description: 'User first name',
    })
    firstName?: string;

    @ApiProperty({
        enum: RolesEnum,
        example: RolesEnum.USER,
        description: 'User role',
    })
    role: RolesEnum;

    @ApiProperty({
        example: '2024-11-02T10:30:00.000Z',
        description: 'Record creation timestamp',
    })
    createdAt: Date;

    @ApiPropertyOptional({
        example: null,
        description: 'Record deletion timestamp (soft delete)',
        nullable: true,
    })
    deletedAt?: Date | null;
}
```

---

## 5. Controller-Level Documentation

Always add `@ApiTags()` to group endpoints:

```typescript
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Exercises')
@Controller('exercises')
export class ExerciseController {
    // ...
}
```

---

## 6. Checklist for New APIs

When creating or updating API documentation:

### DTOs

- [ ] Every property has `@ApiProperty` or `@ApiPropertyOptional`
- [ ] Every property has a meaningful `description`
- [ ] Every property has a realistic `example` value
- [ ] Enums use `enum:` option with actual enum reference
- [ ] Optional fields use `@ApiPropertyOptional`
- [ ] Constraints match validators (`minLength`, `minimum`, etc.)
- [ ] Format hints added where applicable (`email`, `uuid`, `date-time`)

### Controllers

- [ ] Controller has `@ApiTags('ResourceName')`
- [ ] Every endpoint has `@ApiSwagger()` decorator
- [ ] `operation` type matches the endpoint purpose
- [ ] `requestDto` specified for POST/PATCH endpoints
- [ ] `responseDto` specified for data-returning endpoints
- [ ] `requiresAuth` correctly set (use `@Public()` + `requiresAuth: false` for public endpoints)
- [ ] Custom endpoints have descriptive `summary`
- [ ] Error responses documented for business logic errors

### Response DTOs

- [ ] Complex responses have dedicated response DTOs
- [ ] All fields documented with examples
- [ ] Enum fields reference actual enums
- [ ] Nullable fields marked with `nullable: true`

---

## 7. Common Patterns

### Public Endpoints

```typescript
@Get()
@Public()
@ApiSwagger({
    resourceName: 'Exercises',
    operation: 'getAll',
    responseDto: Exercise,
    isArray: true,
    requiresAuth: false,  // Important: matches @Public()
})
```

### Role-Protected Endpoints

```typescript
@Post()
@Roles(RolesEnum.ADMIN)
@ApiSwagger({
    resourceName: 'Exercise',
    operation: 'create',
    requestDto: CreateExerciseDto,
    responseDto: Exercise,
    successStatus: 201,
    requiresAuth: true,  // Default, but explicit is good
})
```

### Endpoints with Custom Errors

```typescript
@Post('forgot-password')
@Public()
@ApiSwagger({
    resourceName: 'Forgot Password',
    operation: 'custom',
    summary: 'Request password reset OTP',
    requestDto: ForgotPasswordDto,
    responseDto: ForgotPasswordResponseDto,
    requiresAuth: false,
    errors: [
        { status: 404, description: 'User not found' },
        { status: 429, description: 'Too many requests - please try again later' },
    ],
})
```

---

## 8. Verifying Documentation

1. Start the development server: `npm run start:dev`
2. Open Swagger UI: `http://localhost:3000/api-docs`
3. Check each endpoint:
    - Request body schema shows examples
    - Response schema is properly structured
    - Error responses are documented
    - Try "Try it out" to validate examples work
