# Supertest Patterns for NestJS E2E Testing

API testing patterns using Supertest with NestJS applications.

## Table of Contents

- [Setup](#setup)
- [Basic Request Patterns](#basic-request-patterns)
- [Authentication Testing](#authentication-testing)
- [CRUD Testing Patterns](#crud-testing-patterns)
- [Error Response Testing](#error-response-testing)
- [Pagination Testing](#pagination-testing)
- [Best Practices](#best-practices)

---

## Setup

### Install Dependencies

```bash
npm install --save-dev supertest @types/supertest
```

### Basic E2E Test Structure

```typescript
// test/e2e/user.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { createTestApp, TestAppSetup } from '../setup/test-app.factory';
import { createTestUser, authHeader, generateAccessToken } from '../fixtures';

describe('UserController (e2e)', () => {
    let app: INestApplication;
    let setup: TestAppSetup;

    beforeAll(async () => {
        setup = await createTestApp();
        app = setup.app;
    });

    beforeEach(async () => {
        await setup.testDb.cleanDatabase();
    });

    afterAll(async () => {
        await app.close();
        await setup.testDb.close();
    });

    // Tests go here
});
```

---

## Basic Request Patterns

### GET Request

```typescript
describe('GET /users', () => {
    it('should return list of users', async () => {
        // Arrange
        const user = await createTestUser(setup.testDb.dataSource);
        const token = generateAccessToken(user);

        // Act
        const response = await request(app.getHttpServer())
            .get('/users')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        // Assert
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return 401 without auth', async () => {
        await request(app.getHttpServer())
            .get('/users')
            .expect(401);
    });
});
```

### GET with Query Parameters

```typescript
describe('GET /users with filters', () => {
    it('should filter by role', async () => {
        const user = await createTestUser(setup.testDb.dataSource);
        const token = generateAccessToken(user);

        const response = await request(app.getHttpServer())
            .get('/users')
            .query({ role: 'admin', page: 1, limit: 10 })
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(response.body.data).toBeDefined();
    });
});
```

### POST Request

```typescript
describe('POST /users', () => {
    it('should create a new user', async () => {
        const admin = await createTestUser(setup.testDb.dataSource, { role: 'admin' });
        const token = generateAccessToken(admin);

        const createUserDto = {
            email: 'newuser@example.com',
            password: 'password123',
            firstName: 'John',
            lastName: 'Doe',
        };

        const response = await request(app.getHttpServer())
            .post('/users')
            .set('Authorization', `Bearer ${token}`)
            .send(createUserDto)
            .expect(201);

        expect(response.body.data).toMatchObject({
            email: createUserDto.email,
            firstName: createUserDto.firstName,
        });
        expect(response.body.data.password).toBeUndefined(); // Should not return password
    });
});
```

### PATCH Request

```typescript
describe('PATCH /users/:id', () => {
    it('should update user', async () => {
        const user = await createTestUser(setup.testDb.dataSource);
        const token = generateAccessToken(user);

        const updateDto = {
            firstName: 'Updated',
        };

        const response = await request(app.getHttpServer())
            .patch(`/users/${user.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send(updateDto)
            .expect(200);

        expect(response.body.data.firstName).toBe('Updated');
    });
});
```

### DELETE Request

```typescript
describe('DELETE /users/:id', () => {
    it('should delete user', async () => {
        const admin = await createTestUser(setup.testDb.dataSource, { role: 'admin' });
        const userToDelete = await createTestUser(setup.testDb.dataSource);
        const token = generateAccessToken(admin);

        await request(app.getHttpServer())
            .delete(`/users/${userToDelete.id}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        // Verify deletion
        await request(app.getHttpServer())
            .get(`/users/${userToDelete.id}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(404);
    });
});
```

---

## Authentication Testing

### Login Flow

```typescript
describe('POST /auth/login', () => {
    it('should return access token for valid credentials', async () => {
        const password = 'password123';
        const user = await createTestUser(setup.testDb.dataSource, { password });

        const response = await request(app.getHttpServer())
            .post('/auth/login')
            .send({
                email: user.email,
                password: password,
            })
            .expect(200);

        expect(response.body).toHaveProperty('accessToken');
        expect(typeof response.body.accessToken).toBe('string');
    });

    it('should return 401 for invalid credentials', async () => {
        await request(app.getHttpServer())
            .post('/auth/login')
            .send({
                email: 'wrong@example.com',
                password: 'wrongpassword',
            })
            .expect(401);
    });
});
```

### Protected Route Testing

```typescript
describe('Protected Routes', () => {
    it('should allow access with valid token', async () => {
        const user = await createTestUser(setup.testDb.dataSource);
        const token = generateAccessToken(user);

        await request(app.getHttpServer())
            .get('/users/me')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
    });

    it('should reject expired token', async () => {
        const user = await createTestUser(setup.testDb.dataSource);
        const expiredToken = generateExpiredToken(user);

        await request(app.getHttpServer())
            .get('/users/me')
            .set('Authorization', `Bearer ${expiredToken}`)
            .expect(401);
    });

    it('should reject malformed token', async () => {
        await request(app.getHttpServer())
            .get('/users/me')
            .set('Authorization', 'Bearer invalid-token')
            .expect(401);
    });

    it('should reject missing Authorization header', async () => {
        await request(app.getHttpServer())
            .get('/users/me')
            .expect(401);
    });
});
```

### Role-Based Access

```typescript
describe('Role-Based Access', () => {
    it('should allow admin to access admin routes', async () => {
        const admin = await createTestUser(setup.testDb.dataSource, { role: 'admin' });
        const token = generateAccessToken(admin);

        await request(app.getHttpServer())
            .get('/admin/dashboard')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
    });

    it('should reject regular user from admin routes', async () => {
        const user = await createTestUser(setup.testDb.dataSource, { role: 'user' });
        const token = generateAccessToken(user);

        await request(app.getHttpServer())
            .get('/admin/dashboard')
            .set('Authorization', `Bearer ${token}`)
            .expect(403);
    });
});
```

---

## CRUD Testing Patterns

### Complete CRUD Test Suite

```typescript
describe('Products CRUD (e2e)', () => {
    let adminToken: string;
    let userToken: string;

    beforeEach(async () => {
        await setup.testDb.cleanDatabase();

        const admin = await createTestUser(setup.testDb.dataSource, { role: 'admin' });
        const user = await createTestUser(setup.testDb.dataSource, { role: 'user' });

        adminToken = generateAccessToken(admin);
        userToken = generateAccessToken(user);
    });

    describe('CREATE', () => {
        const createDto = {
            name: 'Test Product',
            price: 99.99,
            description: 'A test product',
        };

        it('should create product as admin', async () => {
            const response = await request(app.getHttpServer())
                .post('/products')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(createDto)
                .expect(201);

            expect(response.body.data.name).toBe(createDto.name);
            expect(response.body.data.id).toBeDefined();
        });

        it('should reject create without admin role', async () => {
            await request(app.getHttpServer())
                .post('/products')
                .set('Authorization', `Bearer ${userToken}`)
                .send(createDto)
                .expect(403);
        });
    });

    describe('READ', () => {
        let productId: string;

        beforeEach(async () => {
            const response = await request(app.getHttpServer())
                .post('/products')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Test', price: 10 });

            productId = response.body.data.id;
        });

        it('should get all products', async () => {
            const response = await request(app.getHttpServer())
                .get('/products')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(200);

            expect(response.body.data.length).toBeGreaterThan(0);
        });

        it('should get single product', async () => {
            const response = await request(app.getHttpServer())
                .get(`/products/${productId}`)
                .set('Authorization', `Bearer ${userToken}`)
                .expect(200);

            expect(response.body.data.id).toBe(productId);
        });

        it('should return 404 for non-existent product', async () => {
            await request(app.getHttpServer())
                .get('/products/non-existent-id')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(404);
        });
    });

    describe('UPDATE', () => {
        let productId: string;

        beforeEach(async () => {
            const response = await request(app.getHttpServer())
                .post('/products')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Original', price: 10 });

            productId = response.body.data.id;
        });

        it('should update product as admin', async () => {
            const response = await request(app.getHttpServer())
                .patch(`/products/${productId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Updated' })
                .expect(200);

            expect(response.body.data.name).toBe('Updated');
        });
    });

    describe('DELETE', () => {
        let productId: string;

        beforeEach(async () => {
            const response = await request(app.getHttpServer())
                .post('/products')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'ToDelete', price: 10 });

            productId = response.body.data.id;
        });

        it('should delete product as admin', async () => {
            await request(app.getHttpServer())
                .delete(`/products/${productId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            // Verify deletion
            await request(app.getHttpServer())
                .get(`/products/${productId}`)
                .set('Authorization', `Bearer ${userToken}`)
                .expect(404);
        });
    });
});
```

---

## Error Response Testing

### Validation Errors (400)

```typescript
describe('Validation Errors', () => {
    it('should return 400 for missing required fields', async () => {
        const admin = await createTestUser(setup.testDb.dataSource, { role: 'admin' });
        const token = generateAccessToken(admin);

        const response = await request(app.getHttpServer())
            .post('/users')
            .set('Authorization', `Bearer ${token}`)
            .send({}) // Missing required fields
            .expect(400);

        expect(response.body.message).toContain('email');
    });

    it('should return 400 for invalid email format', async () => {
        const admin = await createTestUser(setup.testDb.dataSource, { role: 'admin' });
        const token = generateAccessToken(admin);

        const response = await request(app.getHttpServer())
            .post('/users')
            .set('Authorization', `Bearer ${token}`)
            .send({
                email: 'invalid-email',
                password: 'password123',
            })
            .expect(400);

        expect(response.body.message).toContain('email');
    });
});
```

### Conflict Errors (409)

```typescript
describe('Conflict Errors', () => {
    it('should return 409 for duplicate email', async () => {
        const existingUser = await createTestUser(setup.testDb.dataSource);
        const admin = await createTestUser(setup.testDb.dataSource, { role: 'admin' });
        const token = generateAccessToken(admin);

        const response = await request(app.getHttpServer())
            .post('/users')
            .set('Authorization', `Bearer ${token}`)
            .send({
                email: existingUser.email, // Duplicate email
                password: 'password123',
            })
            .expect(409);

        expect(response.body.message).toContain('already exists');
    });
});
```

---

## Pagination Testing

```typescript
describe('Pagination', () => {
    beforeEach(async () => {
        await setup.testDb.cleanDatabase();
        const admin = await createTestUser(setup.testDb.dataSource, { role: 'admin' });

        // Create 25 products
        for (let i = 0; i < 25; i++) {
            await createTestProduct(setup.testDb.dataSource, { name: `Product ${i}` });
        }
    });

    it('should return paginated results', async () => {
        const user = await createTestUser(setup.testDb.dataSource);
        const token = generateAccessToken(user);

        const response = await request(app.getHttpServer())
            .get('/products')
            .query({ page: 1, limit: 10 })
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(response.body.data.length).toBe(10);
        expect(response.body.meta).toMatchObject({
            total: 25,
            page: 1,
            limit: 10,
            totalPages: 3,
        });
    });

    it('should return correct page', async () => {
        const user = await createTestUser(setup.testDb.dataSource);
        const token = generateAccessToken(user);

        const response = await request(app.getHttpServer())
            .get('/products')
            .query({ page: 3, limit: 10 })
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(response.body.data.length).toBe(5); // 25 - 20 = 5 remaining
        expect(response.body.meta.page).toBe(3);
    });
});
```

---

## Best Practices

### 1. Use Descriptive Test Names

```typescript
// ✅ GOOD
it('should return 401 when accessing protected route without token', async () => {});
it('should create user and return 201 with user data excluding password', async () => {});

// ❌ BAD
it('test create', async () => {});
it('should work', async () => {});
```

### 2. Follow AAA Pattern

```typescript
it('should update user firstName', async () => {
    // Arrange
    const user = await createTestUser(setup.testDb.dataSource);
    const token = generateAccessToken(user);

    // Act
    const response = await request(app.getHttpServer())
        .patch(`/users/${user.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'Updated' });

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data.firstName).toBe('Updated');
});
```

### 3. Test Edge Cases

```typescript
describe('Edge Cases', () => {
    it('should handle empty string fields', async () => {});
    it('should handle very long input', async () => {});
    it('should handle special characters', async () => {});
    it('should handle concurrent requests', async () => {});
});
```

### 4. Use Helper Functions

```typescript
// test/helpers/request.helpers.ts
export const authenticatedGet = (
    app: INestApplication,
    path: string,
    token: string,
) => request(app.getHttpServer())
    .get(path)
    .set('Authorization', `Bearer ${token}`);

export const authenticatedPost = (
    app: INestApplication,
    path: string,
    token: string,
    body: object,
) => request(app.getHttpServer())
    .post(path)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
```

---

## Related Files

- [jest-fixtures.md](jest-fixtures.md) - Test fixture patterns
- [testing-guide.md](../../guides/testing-guide.md) - Complete testing guide
- [Supertest Documentation](https://github.com/ladjs/supertest)
