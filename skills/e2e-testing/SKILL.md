---
skill_name: e2e-testing
applies_to_local_project_only: true
auto_trigger_regex: [e2e test, e2e-test, end-to-end test, generate test, create test, write test, test generator, integration test, test controller, test endpoint, test api, jest fixtures, test fixtures, test data, test factory, test setup, supertest, api testing, http test, endpoint testing]
tags: [testing, e2e, jest, supertest, nestjs, integration, fixtures, api-testing]
related_skills: [backend-dev-guidelines]
---

# E2E Testing for NestJS

Comprehensive guide for end-to-end testing in NestJS applications including test generation, fixtures, and API testing patterns.

## Table of Contents

- [Quick Start](#quick-start)
- [Test Infrastructure](#test-infrastructure)
- [Test Fixtures](#test-fixtures)
- [API Testing Patterns](#api-testing-patterns)
- [Reference Documentation](#reference-documentation)

---

## Quick Start

### 1. Generate E2E Test

```bash
# Create test file
touch backend/test/e2e/[module].e2e-spec.ts
```

### 2. Basic Test Template

```typescript
// backend/test/e2e/[module].e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import {
    createTestApp,
    closeTestApp,
    TestAppContext,
} from '../setup/test-app.factory';
import {
    getTestDataSource,
    cleanDatabase,
    closeDatabase,
} from '../setup/test-database';
import { createTestUser, testUsers } from '../fixtures/user.fixture';
import { generateAccessToken, authHeader } from '../fixtures/auth.fixture';

describe('[ModuleName] E2E Tests', () => {
    let app: INestApplication;
    let module: TestingModule;
    let dataSource: DataSource;

    beforeAll(async () => {
        dataSource = await getTestDataSource();
        const context: TestAppContext = await createTestApp();
        app = context.app;
        module = context.module;
    });

    afterAll(async () => {
        await closeTestApp({ app, module });
        await closeDatabase();
    });

    beforeEach(async () => {
        await cleanDatabase(dataSource);
    });

    // Tests here
});
```

### 3. Common Test Patterns

#### CRUD Operations

```typescript
describe('POST /resource', () => {
    it('should create resource', async () => {
        const user = await createTestUser(dataSource, testUsers.admin);
        const token = generateAccessToken(user);

        const response = await request(app.getHttpServer())
            .post('/resource')
            .set(authHeader(token))
            .send({ name: 'Test' })
            .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('id');
    });
});

describe('GET /resource', () => {
    it('should list resources', async () => {
        const user = await createTestUser(dataSource, testUsers.user);
        const token = generateAccessToken(user);

        const response = await request(app.getHttpServer())
            .get('/resource')
            .set(authHeader(token))
            .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
    });
});
```

#### Authentication Tests

```typescript
describe('Authentication', () => {
    it('should return 401 without token', async () => {
        await request(app.getHttpServer())
            .get('/protected-route')
            .expect(401);
    });

    it('should accept valid token', async () => {
        const user = await createTestUser(dataSource, testUsers.user);
        const token = generateAccessToken(user);

        await request(app.getHttpServer())
            .get('/protected-route')
            .set(authHeader(token))
            .expect(200);
    });
});
```

---

## Test Infrastructure

### Test App Factory

```typescript
// test/setup/test-app.factory.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '@/app.module';

export interface TestAppContext {
    app: INestApplication;
    module: TestingModule;
}

export async function createTestApp(): Promise<TestAppContext> {
    const module = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();

    const app = module.createNestApplication();

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    await app.init();
    return { app, module };
}

export async function closeTestApp(context: TestAppContext): Promise<void> {
    await context.app.close();
}
```

### Test Database

```typescript
// test/setup/test-database.ts
import { DataSource } from 'typeorm';

export class TestDatabase {
    dataSource: DataSource;

    async connect(): Promise<void> {
        this.dataSource = new DataSource({
            type: 'postgres',
            host: process.env.TEST_DB_HOST || 'localhost',
            port: parseInt(process.env.TEST_DB_PORT) || 5433,
            username: process.env.TEST_DB_USER || 'test',
            password: process.env.TEST_DB_PASS || 'test',
            database: process.env.TEST_DB_NAME || 'test_db',
            entities: ['src/**/*.entity.ts'],
            synchronize: true,
        });
        await this.dataSource.initialize();
    }

    async cleanDatabase(): Promise<void> {
        const entities = this.dataSource.entityMetadatas;
        for (const entity of entities) {
            const repository = this.dataSource.getRepository(entity.name);
            await repository.query(`TRUNCATE TABLE "${entity.tableName}" CASCADE`);
        }
    }

    async close(): Promise<void> {
        if (this.dataSource?.isInitialized) {
            await this.dataSource.destroy();
        }
    }
}
```

---

## Test Fixtures

### User Fixture

```typescript
// test/fixtures/user.fixture.ts
import { DataSource } from 'typeorm';
import { User } from '@/modules/user/entities/user.entity';
import * as bcrypt from 'bcrypt';

export const testUsers = {
    admin: { email: 'admin@test.com', role: 'admin' },
    user: { email: 'user@test.com', role: 'user' },
};

export async function createTestUser(
    dataSource: DataSource,
    options: { email?: string; password?: string; role?: string } = {},
): Promise<User> {
    const repository = dataSource.getRepository(User);
    const user = repository.create({
        email: options.email || `test-${Date.now()}@example.com`,
        password: await bcrypt.hash(options.password || 'password123', 10),
        role: options.role || 'user',
        isActive: true,
    });
    return repository.save(user);
}
```

### Auth Fixture

```typescript
// test/fixtures/auth.fixture.ts
import { JwtService } from '@nestjs/jwt';
import { User } from '@/modules/user/entities/user.entity';

const jwtService = new JwtService({
    secret: process.env.JWT_SECRET || 'test-secret',
    signOptions: { expiresIn: '1h' },
});

export function generateAccessToken(user: User): string {
    return jwtService.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
    });
}

export function authHeader(token: string): { Authorization: string } {
    return { Authorization: `Bearer ${token}` };
}
```

### Entity Factory

```typescript
// test/fixtures/factory.ts
import { DataSource } from 'typeorm';

export class EntityFactory<T> {
    constructor(
        private dataSource: DataSource,
        private entityClass: new () => T,
        private defaultValues: Partial<T>,
    ) {}

    async create(overrides: Partial<T> = {}): Promise<T> {
        const repository = this.dataSource.getRepository(this.entityClass);
        const entity = repository.create({
            ...this.defaultValues,
            ...overrides,
        } as T);
        return repository.save(entity);
    }

    async createMany(count: number, overrides: Partial<T> = {}): Promise<T[]> {
        const entities: T[] = [];
        for (let i = 0; i < count; i++) {
            entities.push(await this.create(overrides));
        }
        return entities;
    }
}
```

---

## API Testing Patterns

### HTTP Methods

```typescript
// GET Request
await request(app.getHttpServer())
    .get('/resource')
    .query({ page: 1, limit: 10 })
    .set(authHeader(token))
    .expect(200);

// POST Request
await request(app.getHttpServer())
    .post('/resource')
    .set(authHeader(token))
    .send({ name: 'Test' })
    .expect(201);

// PATCH Request
await request(app.getHttpServer())
    .patch(`/resource/${id}`)
    .set(authHeader(token))
    .send({ name: 'Updated' })
    .expect(200);

// DELETE Request
await request(app.getHttpServer())
    .delete(`/resource/${id}`)
    .set(authHeader(token))
    .expect(200);
```

### Response Assertions

```typescript
// Standard Response
expect(response.body).toMatchObject({
    success: true,
    statusCode: 200,
    message: expect.any(String),
    data: expect.any(Object),
});

// Paginated Response
expect(response.body).toMatchObject({
    success: true,
    data: expect.any(Array),
    meta: {
        page: expect.any(Number),
        limit: expect.any(Number),
        total: expect.any(Number),
    },
});

// Error Response
expect(response.body).toMatchObject({
    success: false,
    statusCode: 400,
    message: expect.any(String),
});
```

### Test Checklist

For every endpoint, verify:

**Authentication:**
- [ ] Returns 401 without token
- [ ] Returns 401 with invalid token
- [ ] Accepts valid token

**Authorization:**
- [ ] Allows authorized roles
- [ ] Returns 403 for unauthorized roles

**Validation:**
- [ ] Returns 400 for missing required fields
- [ ] Returns 400 for invalid formats
- [ ] Accepts valid input

**Success Cases:**
- [ ] Returns correct status code
- [ ] Returns expected response structure
- [ ] Data persists correctly

**Error Cases:**
- [ ] Returns 404 for non-existent resources
- [ ] Returns 409 for conflicts

---

## Reference Documentation

For detailed patterns and advanced techniques, see:

### Core Documentation
- [Mock Factories](./resources/mock-factories.md) - Service and repository mocks
- [CRUD Patterns](./resources/crud-patterns.md) - Complete CRUD test suites
- [Auth Patterns](./resources/auth-patterns.md) - Authentication & authorization tests

### Related Skills
- [backend-dev-guidelines](../../agents/backend-developer.md) - Backend development workflow
- [debugging](../debugging/fix-bug.md) - Debugging guide

### Official Documentation
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/ladjs/supertest)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)

---

## Best Practices

1. **Clean Database Between Tests**
   ```typescript
   beforeEach(async () => {
       await cleanDatabase(dataSource);
   });
   ```

2. **Use Descriptive Test Names**
   ```typescript
   // ✅ GOOD
   it('should return 401 when accessing protected route without token', async () => {});

   // ❌ BAD
   it('test auth', async () => {});
   ```

3. **Follow AAA Pattern** (Arrange-Act-Assert)
   ```typescript
   it('should update user', async () => {
       // Arrange
       const user = await createTestUser(dataSource);
       const token = generateAccessToken(user);

       // Act
       const response = await request(app.getHttpServer())
           .patch(`/users/${user.id}`)
           .set(authHeader(token))
           .send({ firstName: 'Updated' });

       // Assert
       expect(response.status).toBe(200);
       expect(response.body.data.firstName).toBe('Updated');
   });
   ```

4. **Use Fixtures for Test Data**
   ```typescript
   // ✅ GOOD - Reusable
   const user = await createTestUser(dataSource, testUsers.admin);

   // ❌ BAD - Hardcoded
   const user = { id: '1', email: 'test@test.com' };
   ```

5. **Test Edge Cases**
   ```typescript
   describe('Edge Cases', () => {
       it('should handle empty string fields', async () => {});
       it('should handle very long input', async () => {});
       it('should handle special characters', async () => {});
   });
   ```

---

**Line Count**: ~490 lines (under 500 limit ✅)
