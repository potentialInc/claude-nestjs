# Jest Fixtures for NestJS E2E Testing

Patterns and templates for creating reusable test fixtures in NestJS applications.

## Table of Contents

- [Setup](#setup)
- [Test Module Factory](#test-module-factory)
- [Database Fixtures](#database-fixtures)
- [Authentication Fixtures](#authentication-fixtures)
- [Mock Factories](#mock-factories)
- [Best Practices](#best-practices)

---

## Setup

### Project Structure

```
backend/
├── test/
│   ├── setup/
│   │   ├── test-app.factory.ts     # Test app bootstrap
│   │   ├── test-database.ts        # Database utilities
│   │   └── global-setup.ts         # Jest global setup
│   ├── fixtures/
│   │   ├── index.ts                # Barrel export
│   │   ├── user.fixture.ts         # User test data
│   │   ├── auth.fixture.ts         # Auth helpers
│   │   └── common.fixture.ts       # Shared utilities
│   ├── e2e/
│   │   ├── user.e2e-spec.ts
│   │   └── auth.e2e-spec.ts
│   └── jest-e2e.json
```

### Jest E2E Configuration

```json
// test/jest-e2e.json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "moduleNameMapper": {
    "^@/(.*)$": "<rootDir>/../src/$1"
  },
  "setupFilesAfterEnv": ["<rootDir>/setup/global-setup.ts"],
  "testTimeout": 30000
}
```

---

## Test Module Factory

### Base Test App Factory

```typescript
// test/setup/test-app.factory.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '@/app.module';
import { TestDatabase } from './test-database';

export interface TestAppSetup {
    app: INestApplication;
    moduleRef: TestingModule;
    testDb: TestDatabase;
}

export async function createTestApp(): Promise<TestAppSetup> {
    const testDb = new TestDatabase();
    await testDb.connect();

    const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
    })
        .overrideProvider('DATABASE_CONNECTION')
        .useValue(testDb.dataSource)
        .compile();

    const app = moduleRef.createNestApplication();

    // Apply same middleware as production
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    await app.init();

    return { app, moduleRef, testDb };
}
```

### Test Database Utility

```typescript
// test/setup/test-database.ts
import { DataSource } from 'typeorm';
import { User } from '@/modules/user/entities/user.entity';

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
            entities: [User, /* other entities */],
            synchronize: true, // OK for test DB
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

### Global Setup

```typescript
// test/setup/global-setup.ts
import { TestDatabase } from './test-database';

let testDb: TestDatabase;

beforeAll(async () => {
    testDb = new TestDatabase();
    await testDb.connect();
});

afterAll(async () => {
    await testDb.close();
});

// Export for use in tests
export { testDb };
```

---

## Database Fixtures

### User Fixture

```typescript
// test/fixtures/user.fixture.ts
import { DataSource } from 'typeorm';
import { User } from '@/modules/user/entities/user.entity';
import * as bcrypt from 'bcrypt';

export interface CreateTestUserOptions {
    email?: string;
    password?: string;
    role?: string;
    isActive?: boolean;
}

export async function createTestUser(
    dataSource: DataSource,
    options: CreateTestUserOptions = {},
): Promise<User> {
    const repository = dataSource.getRepository(User);

    const user = repository.create({
        email: options.email || `test-${Date.now()}@example.com`,
        password: await bcrypt.hash(options.password || 'password123', 10),
        role: options.role || 'user',
        isActive: options.isActive ?? true,
    });

    return repository.save(user);
}

export async function createTestUsers(
    dataSource: DataSource,
    count: number,
): Promise<User[]> {
    const users: User[] = [];

    for (let i = 0; i < count; i++) {
        const user = await createTestUser(dataSource, {
            email: `user-${i}@example.com`,
        });
        users.push(user);
    }

    return users;
}

export async function createAdminUser(dataSource: DataSource): Promise<User> {
    return createTestUser(dataSource, {
        email: 'admin@example.com',
        role: 'admin',
    });
}
```

### Entity Factory Pattern

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

// Usage
const userFactory = new EntityFactory(dataSource, User, {
    email: 'default@example.com',
    role: 'user',
    isActive: true,
});

const user = await userFactory.create({ email: 'custom@example.com' });
```

---

## Authentication Fixtures

### JWT Token Generator

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

export function generateExpiredToken(user: User): string {
    return jwtService.sign(
        { sub: user.id, email: user.email },
        { expiresIn: '-1h' }, // Already expired
    );
}

export function authHeader(token: string): { Authorization: string } {
    return { Authorization: `Bearer ${token}` };
}

// Convenience function
export async function createAuthenticatedUser(
    dataSource: DataSource,
): Promise<{ user: User; token: string; headers: object }> {
    const user = await createTestUser(dataSource);
    const token = generateAccessToken(user);

    return {
        user,
        token,
        headers: authHeader(token),
    };
}
```

### Auth Test Helpers

```typescript
// test/fixtures/auth.fixture.ts (continued)
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';

export async function loginUser(
    app: INestApplication,
    email: string,
    password: string,
): Promise<string> {
    const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200);

    return response.body.accessToken;
}

export async function registerAndLogin(
    app: INestApplication,
    userData: { email: string; password: string },
): Promise<{ user: any; token: string }> {
    // Register
    await request(app.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(201);

    // Login
    const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userData)
        .expect(200);

    return {
        user: loginResponse.body.user,
        token: loginResponse.body.accessToken,
    };
}
```

---

## Mock Factories

### Service Mocks

```typescript
// test/fixtures/mocks/user-service.mock.ts
export const mockUserService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
};

export function createMockUserService(overrides = {}) {
    return {
        ...mockUserService,
        ...overrides,
    };
}

// Reset all mocks between tests
export function resetMocks() {
    Object.values(mockUserService).forEach(mock => mock.mockReset());
}
```

### Repository Mocks

```typescript
// test/fixtures/mocks/repository.mock.ts
export function createMockRepository<T>() {
    return {
        find: jest.fn(),
        findOne: jest.fn(),
        findOneBy: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        softDelete: jest.fn(),
        createQueryBuilder: jest.fn(() => ({
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            getMany: jest.fn(),
            getOne: jest.fn(),
            getManyAndCount: jest.fn(),
        })),
    };
}
```

---

## Best Practices

### 1. Isolate Tests with Clean Database

```typescript
describe('UserController (e2e)', () => {
    let app: INestApplication;
    let testDb: TestDatabase;

    beforeAll(async () => {
        const setup = await createTestApp();
        app = setup.app;
        testDb = setup.testDb;
    });

    beforeEach(async () => {
        await testDb.cleanDatabase(); // Clean before each test
    });

    afterAll(async () => {
        await app.close();
        await testDb.close();
    });
});
```

### 2. Use Fixtures Barrel Export

```typescript
// test/fixtures/index.ts
export * from './user.fixture';
export * from './auth.fixture';
export * from './common.fixture';
export * from './factory';

// Usage in tests
import {
    createTestUser,
    generateAccessToken,
    authHeader,
} from '../fixtures';
```

### 3. Create Reusable Test Scenarios

```typescript
// test/fixtures/scenarios.ts
export async function setupUserWithPosts(dataSource: DataSource) {
    const user = await createTestUser(dataSource);
    const posts = await createTestPosts(dataSource, user.id, 5);

    return { user, posts };
}

export async function setupAdminWithUsers(dataSource: DataSource) {
    const admin = await createAdminUser(dataSource);
    const users = await createTestUsers(dataSource, 10);

    return { admin, users };
}
```

### 4. Handle Async Cleanup

```typescript
afterEach(async () => {
    // Clean in reverse order of dependencies
    await testDb.dataSource.getRepository(Post).delete({});
    await testDb.dataSource.getRepository(User).delete({});
});
```

### 5. Test Data Builders

```typescript
// test/fixtures/builders/user.builder.ts
export class UserBuilder {
    private user: Partial<User> = {
        email: 'test@example.com',
        role: 'user',
        isActive: true,
    };

    withEmail(email: string): this {
        this.user.email = email;
        return this;
    }

    withRole(role: string): this {
        this.user.role = role;
        return this;
    }

    inactive(): this {
        this.user.isActive = false;
        return this;
    }

    async build(dataSource: DataSource): Promise<User> {
        return createTestUser(dataSource, this.user);
    }
}

// Usage
const user = await new UserBuilder()
    .withEmail('admin@test.com')
    .withRole('admin')
    .build(dataSource);
```

---

## Related Files

- [supertest-patterns.md](supertest-patterns.md) - API testing patterns
- [testing-guide.md](../../guides/testing-guide.md) - Complete testing guide
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
