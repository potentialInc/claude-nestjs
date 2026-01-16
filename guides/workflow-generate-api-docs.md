# API Documentation Generator Guide

This guide explains how to generate comprehensive Markdown API documentation from NestJS controllers and DTOs.

## Quick Start

### Generate Full API Documentation

```
Generate API documentation for all modules and save to .claude-project/docs/PROJECT_API.md
```

### Generate Module-Specific Documentation

```
Generate API documentation for the exercises module
```

### Update After Changes

```
Update the API documentation after adding new endpoints
```

---

## Output Location

API documentation is generated to: `.claude-project/docs/PROJECT_API.md`

---

## Extraction Process

When generating API documentation, extract information from these sources:

### 1. Controller Metadata

**Location**: `src/modules/{module}/controllers/*.controller.ts` or `src/modules/{module}/*.controller.ts`

Extract:

- `@Controller('path')` - Base route path
- `@ApiTags('Tag')` - Module grouping
- `@ApiBearerAuth()` - Authentication requirement
- HTTP decorators (`@Get`, `@Post`, `@Patch`, `@Delete`) - Methods and paths
- `@ApiOperation({ summary })` - Endpoint description
- `@ApiResponse({ status, description })` - Response codes
- `@Public()` - Public endpoints (no auth required)
- `@Roles('role')`, `@AdminOnly()`, `@CoachOnly()`, `@PatientOnly()` - Access control

### 2. Custom @ApiSwagger Decorator

**Location**: `src/core/decorators/api-swagger.decorator.ts`

The `@ApiSwagger()` decorator provides comprehensive endpoint documentation:

```typescript
@ApiSwagger({
    resourceName: 'User',           // Resource name for auto-generated summaries
    operation: 'create',            // Operation type: create|getAll|getOne|update|delete|search|count|custom
    requestDto: CreateUserDto,      // Request body DTO
    responseDto: UserResponseDto,   // Response data DTO
    successStatus: 201,             // HTTP success status code
    requiresAuth: true,             // Authentication required (default: true)
    isArray: false,                 // Response is array
    withPagination: false,          // Include pagination query params
    paramName: 'id',                // Path parameter name
    errors: [                       // Error responses
        { status: 400, description: 'Bad request' },
        { status: 404, description: 'Not found' },
    ],
})
```

**Operation Types and Auto-Generated Summaries:**

- `create` → "Create a new {resource}"
- `getAll` → "Get all {resources}"
- `getOne` → "Get {resource} by ID"
- `update` → "Update {resource}"
- `delete` → "Delete {resource}"
- `search` → "Search {resources}"
- `count` → "Count {resources}"

### 3. DTO Field Documentation

**Location**: `src/modules/{module}/dtos/*.dto.ts`

Extract from DTOs:

- `@ApiProperty({ description, example, format })` - Required fields
- `@ApiPropertyOptional({ ... })` - Optional fields
- class-validator decorators for constraints:
    - `@IsString()`, `@IsEmail()`, `@IsUUID()` - Type
    - `@MinLength()`, `@MaxLength()` - String constraints
    - `@Min()`, `@Max()` - Number constraints
    - `@IsEnum(EnumType)` - Enum values
    - `@IsOptional()` - Optional marker

### 4. Response Wrapper

All responses are wrapped in `ResponsePayloadDto`:

```typescript
{
    success: boolean;
    statusCode: number;
    message: string;
    data?: T;
    error?: ErrorDetailDto[];
    timestamp?: string;
    path?: string;
}
```

---

## Markdown Output Template

### Full API Documentation Structure

```markdown
# Project API Reference

> Auto-generated API documentation for ActivityCoaching Backend

## Base URL

\`http://localhost:3000/api/v1\`

## Authentication

Most endpoints require Bearer token authentication via JWT.

- Header: \`Authorization: Bearer <token>\`
- Cookie: \`accessToken=<token>\`

Public endpoints are marked with **Public**.

---

## Modules

| Module                  | Description                        |
| ----------------------- | ---------------------------------- |
| [Auth](#auth)           | Authentication and authorization   |
| [Users](#users)         | User management                    |
| [Exercises](#exercises) | Exercise catalog and prescriptions |
| [Chat](#chat)           | Real-time messaging                |
| [Meetings](#meetings)   | Zoom meeting integration           |
| [Surveys](#surveys)     | Daily surveys                      |
| [Features](#features)   | Feature flags                      |
| [OTP](#otp)             | One-time passwords                 |

---

## Auth

### POST /auth/login

**Public**

Authenticate user and receive JWT tokens.

**Request Body**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | User email address |
| password | string | Yes | User password |

**Responses**
| Status | Description |
|--------|-------------|
| 200 | Login successful, tokens returned |
| 401 | Invalid credentials |

---

[Continue for each module...]
```

### Endpoint Section Template

```markdown
### {METHOD} {Path}

{Access: Public | Requires Auth | Admin Only | Coach Only | Patient Only}

{Summary/Description}

**Path Parameters** (if any)
| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Resource identifier |

**Query Parameters** (if any)
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | number | No | Page number (default: 1) |
| limit | number | No | Items per page (default: 10) |

**Request Body** (if POST/PATCH)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| field | type | Yes/No | Description |

**Responses**
| Status | Description |
|--------|-------------|
| 200 | Success description |
| 400 | Bad request |
| 401 | Unauthorized |
| 404 | Not found |

---
```

---

## Module Discovery

Scan these directories for controllers:

```
src/modules/auth/auth.controller.ts
src/modules/users/user.controller.ts
src/modules/exercises/controllers/*.controller.ts
src/modules/chat/controllers/chat.controller.ts
src/modules/meetings/controllers/zoom-meeting.controller.ts
src/modules/surveys/controllers/daily-survey.controller.ts
src/modules/features/feature.controller.ts
src/modules/otp/otp.controller.ts
```

---

## Step-by-Step Generation Process

1. **Scan Controllers**
    - Read all controller files in `src/modules/`
    - Extract class-level decorators (@Controller, @ApiTags, @ApiBearerAuth)

2. **Extract Endpoints**
    - Find all methods with HTTP decorators (@Get, @Post, @Patch, @Delete)
    - Extract @ApiSwagger or @ApiOperation metadata
    - Note authentication requirements (@Public, @Roles, etc.)

3. **Parse DTOs**
    - For each request body, read the DTO file
    - Extract @ApiProperty and @ApiPropertyOptional fields
    - Include validation constraints

4. **Generate Markdown**
    - Use the templates above
    - Group by module/controller
    - Include table of contents with anchor links

5. **Write Output**
    - Save to `.claude-project/docs/PROJECT_API.md`
    - Include generation timestamp

---

## Example: Reading a Controller

```typescript
// src/modules/exercises/controllers/exercise.controller.ts

@ApiTags('Exercises')
@Controller('exercises')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ExerciseController extends BaseController<...> {

    @ApiSwagger({
        resourceName: 'Exercise',
        operation: 'create',
        requestDto: CreateExerciseDto,
        responseDto: ExerciseResponseDto,
        successStatus: 201,
    })
    @AdminOnly()
    @Post()
    async create(@Body() dto: CreateExerciseDto) { ... }

    @ApiSwagger({
        resourceName: 'Exercise',
        operation: 'getAll',
        responseDto: ExerciseResponseDto,
        isArray: true,
    })
    @Get()
    async findAll() { ... }
}
```

**Generates:**

```markdown
## Exercises

### POST /exercises

**Admin Only**

Create a new exercise.

**Request Body**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | Yes | Exercise title |
| videoUrl | string | Yes | Video demonstration URL |
| category | ExerciseCategoryEnum | No | Exercise category |

**Responses**
| Status | Description |
|--------|-------------|
| 201 | Exercise created successfully |
| 400 | Invalid input data |
| 401 | Unauthorized |

---

### GET /exercises

**Requires Auth**

Get all exercises.

**Responses**
| Status | Description |
|--------|-------------|
| 200 | Exercises retrieved successfully |
| 401 | Unauthorized |
```

---

## Updating Documentation

When API changes are detected:

1. Re-scan affected controller(s)
2. Update the relevant section in PROJECT_API.md
3. Update the generation timestamp
4. Preserve any manual additions (marked with `<!-- MANUAL -->`)

---

## Related Resources

- [update-swagger.md](update-swagger.md) - How to write Swagger decorators
- [routing-and-controllers.md](routing-and-controllers.md) - Controller patterns
- [validation-patterns.md](validation-patterns.md) - DTO validation
