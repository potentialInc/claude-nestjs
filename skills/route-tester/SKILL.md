---
skill_name: route-tester
applies_to_local_project_only: true
auto_trigger_regex:
    [test route, test endpoint, test api, route testing, endpoint testing]
tags: [testing, routes, api, nestjs, jwt, authentication]
related_skills: [backend-dev-guidelines, error-tracking]
---

# NestJS Route Testing Guide

Complete guide for testing NestJS API endpoints with JWT authentication. Use this skill when testing controllers, validating route functionality, or debugging authentication issues.

---

## Quick Start

### Method 1: Using REST Client (RECOMMENDED)

Create a `.http` file to test your endpoints with JWT authentication:

```http
### Login to get JWT token
POST http://localhost:4000/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "Admin@123"
}

### Extract the access_token from the response and use it below
@accessToken = <PASTE_TOKEN_HERE>

### Test authenticated endpoint
GET http://localhost:4000/users/me
Authorization: Bearer {{accessToken}}

### Create a new user (admin only)
POST http://localhost:4000/users
Authorization: Bearer {{accessToken}}
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "Password@123",
  "firstName": "John",
  "lastName": "Doe",
  "role": "user"
}

### Get user by ID
GET http://localhost:4000/users/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer {{accessToken}}

### Update user
PATCH http://localhost:4000/users/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer {{accessToken}}
Content-Type: application/json

{
  "firstName": "Jane"
}

### Delete user
DELETE http://localhost:4000/users/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer {{accessToken}}
```

### Method 2: curl Commands

```bash
# 1. Login to get JWT token
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin@123"}' \
  | jq -r '.data.access_token')

# 2. Test authenticated endpoint
curl http://localhost:4000/users/me \
  -H "Authorization: Bearer $TOKEN"

# 3. Create resource
curl -X POST http://localhost:4000/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test@123",
    "firstName": "Test",
    "lastName": "User"
  }'

# 4. Get all resources with pagination
curl "http://localhost:4000/users?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# 5. Update resource
curl -X PATCH http://localhost:4000/users/USER_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firstName": "Updated"}'

# 6. Delete resource
curl -X DELETE http://localhost:4000/users/USER_ID \
  -H "Authorization: Bearer $TOKEN"
```

### Method 3: Postman/Insomnia

1. **Create Environment Variables**:
    - `baseUrl`: `http://localhost:4000`
    - `accessToken`: (will be set from login response)

2. **Login Request**:
    - Method: `POST`
    - URL: `{{baseUrl}}/auth/login`
    - Body:
        ```json
        {
            "email": "admin@example.com",
            "password": "Admin@123"
        }
        ```
    - Test Script (Postman):
        ```javascript
        pm.environment.set('accessToken', pm.response.json().data.access_token);
        ```

3. **Authenticated Request**:
    - Add header: `Authorization: Bearer {{accessToken}}`

---

## NestJS Authentication Overview

This NestJS starter kit uses:

- **JWT Tokens** (not cookie-based)
- **Bearer Token** in Authorization header
- **Guard**: `JwtAuthGuard` for protected routes
- **Decorator**: `@Public()` to bypass authentication
- **Decorator**: `@Roles()` for role-based access
- **Strategy**: Passport JWT strategy

### Default Test Users

The seed data creates these test users:

```typescript
// Admin user
{
  email: "admin@example.com",
  password: "Admin@123",
  role: "admin"
}

// Regular user
{
  email: "user@example.com",
  password: "User@123",
  role: "user"
}
```

---

## Testing Patterns by HTTP Method

### GET Requests

```bash
# Get all (with pagination)
curl http://localhost:4000/users?page=1&limit=10 \
  -H "Authorization: Bearer $TOKEN"

# Get by ID
curl http://localhost:4000/users/USER_ID \
  -H "Authorization: Bearer $TOKEN"

# Get with filters
curl "http://localhost:4000/users?role=admin&isActive=true" \
  -H "Authorization: Bearer $TOKEN"

# Get with sorting
curl "http://localhost:4000/users?sortBy=createdAt&sortOrder=DESC" \
  -H "Authorization: Bearer $TOKEN"
```

### POST Requests

```bash
# Create resource
curl -X POST http://localhost:4000/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "new@example.com",
    "password": "Password@123",
    "firstName": "New",
    "lastName": "User",
    "role": "user"
  }'

# Nested resource creation
curl -X POST http://localhost:4000/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Post",
    "content": "Post content here",
    "authorId": "USER_ID"
  }'
```

### PATCH Requests

```bash
# Partial update
curl -X PATCH http://localhost:4000/users/USER_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Updated Name"
  }'

# Update with nested data
curl -X PATCH http://localhost:4000/users/USER_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "profile": {
      "bio": "Updated bio",
      "avatar": "https://example.com/avatar.jpg"
    }
  }'
```

### DELETE Requests

```bash
# Soft delete (sets deletedAt)
curl -X DELETE http://localhost:4000/users/USER_ID \
  -H "Authorization: Bearer $TOKEN"

# Verify soft delete
curl http://localhost:4000/users/USER_ID \
  -H "Authorization: Bearer $TOKEN"
# Should return 404 or empty result
```

---

## Testing BaseController CRUD Operations

The `BaseController` provides automatic CRUD endpoints. Here's how to test them:

### Test findAll (GET /)

```bash
# Basic pagination
curl "http://localhost:4000/users?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Expected response:
# {
#   "success": true,
#   "statusCode": 200,
#   "data": {
#     "data": [...],
#     "meta": {
#       "page": 1,
#       "limit": 10,
#       "total": 50,
#       "totalPages": 5
#     }
#   }
# }
```

### Test findOne (GET /:id)

```bash
# Get by UUID
curl http://localhost:4000/users/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer $TOKEN"

# Expected 404 for non-existent ID
curl http://localhost:4000/users/00000000-0000-0000-0000-000000000000 \
  -H "Authorization: Bearer $TOKEN"
# Should return 404 error
```

### Test create (POST /)

```bash
# Valid creation
curl -X POST http://localhost:4000/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test@123",
    "firstName": "Test",
    "lastName": "User"
  }'

# Validation error (missing required fields)
curl -X POST http://localhost:4000/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "invalid-email"
  }'
# Should return 400 with validation errors
```

### Test update (PATCH /:id)

```bash
# Partial update
curl -X PATCH http://localhost:4000/users/USER_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Updated"
  }'

# Update non-existent resource
curl -X PATCH http://localhost:4000/users/00000000-0000-0000-0000-000000000000 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firstName": "Test"}'
# Should return 404
```

### Test remove (DELETE /:id)

```bash
# Soft delete
curl -X DELETE http://localhost:4000/users/USER_ID \
  -H "Authorization: Bearer $TOKEN"

# Verify it's deleted
curl http://localhost:4000/users/USER_ID \
  -H "Authorization: Bearer $TOKEN"
# Should return 404

# Delete already deleted resource
curl -X DELETE http://localhost:4000/users/USER_ID \
  -H "Authorization: Bearer $TOKEN"
# Should return 404
```

---

## Testing Authentication & Authorization

### Test Public Routes (No Auth Required)

```bash
# Health check (public)
curl http://localhost:4000/health

# Login (public)
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin@123"}'

# Register (public)
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "new@example.com",
    "password": "Password@123",
    "firstName": "New",
    "lastName": "User"
  }'
```

### Test Protected Routes

```bash
# Without token (should fail with 401)
curl http://localhost:4000/users/me
# Expected: 401 Unauthorized

# With valid token
curl http://localhost:4000/users/me \
  -H "Authorization: Bearer $TOKEN"
# Expected: User profile data

# With expired token
curl http://localhost:4000/users/me \
  -H "Authorization: Bearer EXPIRED_TOKEN"
# Expected: 401 Unauthorized

# With invalid token format
curl http://localhost:4000/users/me \
  -H "Authorization: InvalidToken"
# Expected: 401 Unauthorized
```

### Test Role-Based Access (@Roles decorator)

```bash
# Login as regular user
USER_TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"User@123"}' \
  | jq -r '.data.access_token')

# Try admin-only endpoint (should fail with 403)
curl -X DELETE http://localhost:4000/users/SOME_ID \
  -H "Authorization: Bearer $USER_TOKEN"
# Expected: 403 Forbidden

# Login as admin
ADMIN_TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin@123"}' \
  | jq -r '.data.access_token')

# Try admin-only endpoint (should succeed)
curl -X DELETE http://localhost:4000/users/SOME_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Expected: 200 OK
```

---

## Testing Custom Controller Methods

For controllers that extend `BaseController` with custom methods:

```typescript
// Example controller
@Controller('users')
export class UserController extends BaseController<
    User,
    CreateUserDto,
    UpdateUserDto
> {
    // Custom method beyond CRUD
    @Post(':id/reset-password')
    async resetPassword(@Param('id') id: string) {
        // ...
    }
}
```

Test the custom method:

```bash
# Test custom route
curl -X POST http://localhost:4000/users/USER_ID/reset-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "newPassword": "NewPassword@123"
  }'
```

---

## Verifying Database Changes

After testing routes that modify data:

### Using TypeORM CLI

```bash
# Connect to PostgreSQL
docker exec -it postgres psql -U postgres -d nestjs_dev

# Check specific table
SELECT * FROM users WHERE email = 'test@example.com';

# Check soft deletes
SELECT * FROM users WHERE "deletedAt" IS NOT NULL;

# Check relationships
SELECT u.*, p.* FROM users u
LEFT JOIN posts p ON p."authorId" = u.id
WHERE u.id = 'USER_ID';

# Exit
\q
```

### Using Database GUI

- **pgAdmin**: http://localhost:5050 (if configured in docker-compose.yml)
- **DBeaver**: Connect to localhost:5432
- **TablePlus**: Connect to localhost:5432

---

## Debugging Failed Tests

### 400 Bad Request

**Possible causes**:

1. Validation errors (class-validator)
2. Missing required fields
3. Invalid data format
4. Type mismatch

**Solutions**:

```bash
# Check validation in DTO
# src/modules/users/dto/create-user.dto.ts

# Response shows validation errors:
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "constraints": {
        "isEmail": "Invalid email format"
      }
    }
  ]
}
```

### 401 Unauthorized

**Possible causes**:

1. Missing Authorization header
2. Invalid token format
3. Expired token
4. Invalid JWT secret

**Solutions**:

```bash
# Regenerate token
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin@123"}' \
  | jq -r '.data.access_token')

# Check token format
echo $TOKEN
# Should be: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Verify JWT secret in .env
grep JWT_SECRET .env
```

### 403 Forbidden

**Possible causes**:

1. User lacks required role
2. @Roles() guard blocking access
3. Custom authorization logic

**Solutions**:

```bash
# Login as admin
ADMIN_TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin@123"}' \
  | jq -r '.data.access_token')

# Try with admin token
curl http://localhost:4000/admin-only-route \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 404 Not Found

**Possible causes**:

1. Incorrect URL/route
2. Resource doesn't exist
3. Soft deleted resource
4. Route not registered

**Solutions**:

```bash
# Check if service is running
curl http://localhost:4000/health

# Verify route exists
# Check src/modules/*/controller.ts

# Check Swagger docs
open http://localhost:4000/api

# Test with valid ID
curl http://localhost:4000/users \
  -H "Authorization: Bearer $TOKEN"
# Get an ID from the response, then test findOne
```

### 500 Internal Server Error

**Possible causes**:

1. Database connection issue
2. Unhandled exception
3. Application error
4. Missing environment variables

**Solutions**:

```bash
# Check service logs
docker logs nestjs-app -f

# Check database connection
docker exec -it postgres psql -U postgres -d nestjs_dev -c "SELECT 1;"

# Check Sentry for error details (if configured)

# Verify environment variables
docker exec nestjs-app env | grep DB_
```

---

## Testing Checklist

Before testing a route:

- [ ] Service is running (`docker ps` or `npm run start:dev`)
- [ ] Database is running and migrated
- [ ] You have a valid JWT token
- [ ] You know the correct HTTP method (GET/POST/PATCH/DELETE)
- [ ] You have the correct route path
- [ ] Request body matches DTO validation rules
- [ ] You have required permissions/roles
- [ ] You're using the correct base URL and port

After testing a route:

- [ ] Response status code is as expected
- [ ] Response body structure is correct
- [ ] Database was updated correctly
- [ ] Soft deletes work (deletedAt is set)
- [ ] Validation errors are clear
- [ ] No errors in Sentry (if configured)

---

## Common Test Scenarios

### Test New Controller

```bash
# 1. Test findAll
curl http://localhost:4000/posts?page=1&limit=10 \
  -H "Authorization: Bearer $TOKEN"

# 2. Test create
curl -X POST http://localhost:4000/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Post",
    "content": "Test content",
    "published": false
  }'

# 3. Save the ID from response
POST_ID="PASTE_ID_HERE"

# 4. Test findOne
curl http://localhost:4000/posts/$POST_ID \
  -H "Authorization: Bearer $TOKEN"

# 5. Test update
curl -X PATCH http://localhost:4000/posts/$POST_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"published": true}'

# 6. Test delete
curl -X DELETE http://localhost:4000/posts/$POST_ID \
  -H "Authorization: Bearer $TOKEN"

# 7. Verify it's deleted
curl http://localhost:4000/posts/$POST_ID \
  -H "Authorization: Bearer $TOKEN"
# Should return 404
```

### Test Validation

```bash
# Test each validation rule
# 1. Missing required field
curl -X POST http://localhost:4000/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

# 2. Invalid email format
curl -X POST http://localhost:4000/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "invalid"}'

# 3. Password too weak
curl -X POST http://localhost:4000/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "123"}'

# 4. Duplicate email
curl -X POST http://localhost:4000/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Test@123"
  }'
# Should return 409 Conflict
```

### Test Relationships

```bash
# Create parent resource
USER_RESPONSE=$(curl -s -X POST http://localhost:4000/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "parent@example.com",
    "password": "Test@123",
    "firstName": "Parent",
    "lastName": "User"
  }')

USER_ID=$(echo $USER_RESPONSE | jq -r '.data.id')

# Create child resource with relationship
curl -X POST http://localhost:4000/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"User Post\",
    \"content\": \"Content here\",
    \"authorId\": \"$USER_ID\"
  }"

# Verify relationship in database
docker exec -it postgres psql -U postgres -d nestjs_dev \
  -c "SELECT p.*, u.email FROM posts p JOIN users u ON p.\"authorId\" = u.id WHERE p.\"authorId\" = '$USER_ID';"
```

---

## Environment Variables

```bash
# .env file
NODE_ENV=development
PORT=4000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=nestjs_dev

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRATION=7d

# OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback
```

---

## Swagger API Documentation

The starter kit includes Swagger documentation:

```bash
# Open Swagger UI
open http://localhost:4000/api

# Features:
# - All routes documented
# - Try it out functionality
# - Schema definitions
# - Authentication via "Authorize" button
```

Using Swagger to test:

1. Click "Authorize" button
2. Paste your JWT token (without "Bearer " prefix)
3. Click "Authorize" again
4. Navigate to any endpoint
5. Click "Try it out"
6. Fill in parameters
7. Click "Execute"

---

## Related Documentation

- **Backend Dev Guidelines**: [.claude/skills/backend-dev-guidelines/SKILL.md](./../backend-dev-guidelines/SKILL.md)
    - Controllers: [.claude/skills/backend-dev-guidelines/resources/routing-and-controllers.md](./../backend-dev-guidelines/resources/routing-and-controllers.md)
    - Validation: [.claude/skills/backend-dev-guidelines/resources/validation-patterns.md](./../backend-dev-guidelines/resources/validation-patterns.md)

- **Error Tracking**: [.claude/skills/error-tracking/SKILL.md](./../error-tracking/SKILL.md)

- **NestJS Starter Kit**:
    - Auth Module: [src/modules/auth/](./../../src/modules/auth/)
    - User Controller: [src/modules/users/user.controller.ts](./../../src/modules/users/user.controller.ts)
    - Base Controller: [src/core/base/base.controller.ts](./../../src/core/base/base.controller.ts)

---

## Quick Reference

```bash
# Get JWT token
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin@123"}' \
  | jq -r '.data.access_token')

# Test GET
curl http://localhost:4000/ROUTE \
  -H "Authorization: Bearer $TOKEN"

# Test POST
curl -X POST http://localhost:4000/ROUTE \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"field":"value"}'

# Test PATCH
curl -X PATCH http://localhost:4000/ROUTE/ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"field":"newValue"}'

# Test DELETE
curl -X DELETE http://localhost:4000/ROUTE/ID \
  -H "Authorization: Bearer $TOKEN"
```
