# E2E Test Generator Guide

Complete guide to generating end-to-end tests for NestJS controllers and API endpoints.

## Table of Contents

- [When to Generate Tests](#when-to-generate-tests)
- [Test Infrastructure](#test-infrastructure)
- [Quick Start - Generate Tests](#quick-start---generate-tests)
- [Test Patterns by Endpoint Type](#test-patterns-by-endpoint-type)
- [Using Fixtures](#using-fixtures)
- [Creating Mocks](#creating-mocks)
- [Smart Detection Rules](#smart-detection-rules)
- [Complete Examples](#complete-examples)
- [Test Checklist](#test-checklist)

---

## When to Generate Tests

This guide activates automatically when:

- Creating a new controller or adding routes
- Creating or modifying entities
- You ask to "generate tests" or "create e2e tests"
- You finish implementing an API endpoint

**Manual invocation:** Ask Claude to "generate e2e tests for [module/controller]"

---

## Test Infrastructure

### Directory Structure

```
test/
├── e2e/                          # E2E test files
│   ├── auth.e2e-spec.ts         # Auth module tests
│   ├── users.e2e-spec.ts        # Users module tests
│   └── [module].e2e-spec.ts     # Your module tests
├── setup/                        # Test infrastructure
│   ├── test-app.factory.ts      # NestJS test app bootstrap
│   ├── test-database.ts         # DB connection & cleanup
│   └── global-setup.ts          # Jest global hooks
├── fixtures/                     # Test data factories
│   ├── user.fixture.ts          # User creation helpers
│   └── auth.fixture.ts          # JWT token generation
├── mocks/                        # Service mocks
│   └── mail.service.mock.ts     # Mock email service
└── jest-e2e.json                # E2E Jest config
```

### Running Tests

```bash
# Start test database
npm run docker:test

# Run all E2E tests
npm run test:e2e

# Run specific test file
npm run test:e2e -- --testPathPattern=auth

# Run with coverage
npm run test:e2e:cov

# Watch mode
npm run test:e2e:watch
```

---

## Quick Start - Generate Tests

### Step 1: Create Test File

```typescript
// test/e2e/[module].e2e-spec.ts
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
import {
    createTestUser,
    testUsers,
    TEST_PASSWORD,
    seedTestUsers,
} from '../fixtures/user.fixture';
import { generateAccessToken, authHeader } from '../fixtures/auth.fixture';
import { User } from 'src/modules/users/user.entity';

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

    // Add describe blocks for each endpoint
});
```

### Step 2: Add Endpoint Tests

For each endpoint, add a `describe` block with test cases.

---

## Test Patterns by Endpoint Type

### CRUD Endpoints (BaseController)

```typescript
describe('[Resource] CRUD E2E', () => {
    let testUser: User;
    let validToken: string;

    beforeEach(async () => {
        testUser = await createTestUser(dataSource, testUsers.admin);
        validToken = generateAccessToken(testUser);
    });

    describe('POST /[resource]', () => {
        it('should create resource with valid data', async () => {
            const response = await request(app.getHttpServer())
                .post('/[resource]')
                .set(authHeader(validToken))
                .send({
                    // Valid DTO fields
                    name: 'Test Resource',
                })
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('id');
        });

        it('should return 400 for invalid data', async () => {
            await request(app.getHttpServer())
                .post('/[resource]')
                .set(authHeader(validToken))
                .send({
                    // Invalid/missing required fields
                })
                .expect(400);
        });

        it('should return 401 without authentication', async () => {
            await request(app.getHttpServer())
                .post('/[resource]')
                .send({ name: 'Test' })
                .expect(401);
        });
    });

    describe('GET /[resource]', () => {
        it('should return paginated list', async () => {
            // Create test data first
            await request(app.getHttpServer())
                .post('/[resource]')
                .set(authHeader(validToken))
                .send({ name: 'Test 1' });

            const response = await request(app.getHttpServer())
                .get('/[resource]')
                .set(authHeader(validToken))
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        it('should filter by query params', async () => {
            const response = await request(app.getHttpServer())
                .get('/[resource]?search=test')
                .set(authHeader(validToken))
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('GET /[resource]/:id', () => {
        it('should return resource by id', async () => {
            // Create resource first
            const createResponse = await request(app.getHttpServer())
                .post('/[resource]')
                .set(authHeader(validToken))
                .send({ name: 'Test' });

            const resourceId = createResponse.body.data.id;

            const response = await request(app.getHttpServer())
                .get(`/[resource]/${resourceId}`)
                .set(authHeader(validToken))
                .expect(200);

            expect(response.body.data.id).toBe(resourceId);
        });

        it('should return 404 for non-existent id', async () => {
            await request(app.getHttpServer())
                .get('/[resource]/00000000-0000-0000-0000-000000000000')
                .set(authHeader(validToken))
                .expect(404);
        });
    });

    describe('PATCH /[resource]/:id', () => {
        it('should update resource', async () => {
            // Create first
            const createResponse = await request(app.getHttpServer())
                .post('/[resource]')
                .set(authHeader(validToken))
                .send({ name: 'Original' });

            const resourceId = createResponse.body.data.id;

            const response = await request(app.getHttpServer())
                .patch(`/[resource]/${resourceId}`)
                .set(authHeader(validToken))
                .send({ name: 'Updated' })
                .expect(200);

            expect(response.body.data.name).toBe('Updated');
        });

        it('should return 404 for non-existent id', async () => {
            await request(app.getHttpServer())
                .patch('/[resource]/00000000-0000-0000-0000-000000000000')
                .set(authHeader(validToken))
                .send({ name: 'Updated' })
                .expect(404);
        });
    });

    describe('DELETE /[resource]/:id', () => {
        it('should delete resource', async () => {
            // Create first
            const createResponse = await request(app.getHttpServer())
                .post('/[resource]')
                .set(authHeader(validToken))
                .send({ name: 'To Delete' });

            const resourceId = createResponse.body.data.id;

            await request(app.getHttpServer())
                .delete(`/[resource]/${resourceId}`)
                .set(authHeader(validToken))
                .expect(200);

            // Verify deleted
            await request(app.getHttpServer())
                .get(`/[resource]/${resourceId}`)
                .set(authHeader(validToken))
                .expect(404);
        });
    });
});
```

### Role-Based Access (Coach/Patient)

```typescript
describe('[Resource] Role-Based Access', () => {
    let coach: User;
    let patient: User;
    let otherCoach: User;
    let coachToken: string;
    let patientToken: string;
    let otherCoachToken: string;

    beforeEach(async () => {
        const users = await seedTestUsers(dataSource);
        coach = users.coach;
        patient = users.patient;
        otherCoach = await createTestUser(dataSource, {
            email: 'other-coach@test.com',
            password: TEST_PASSWORD,
            firstName: 'Other',
            lastName: 'Coach',
            role: RolesEnum.COACH,
        });

        coachToken = generateAccessToken(coach);
        patientToken = generateAccessToken(patient);
        otherCoachToken = generateAccessToken(otherCoach);

        // Setup coach-patient assignment if needed
    });

    it('should allow assigned coach to access patient data', async () => {
        const response = await request(app.getHttpServer())
            .get(`/[resource]/patient/${patient.id}`)
            .set(authHeader(coachToken))
            .expect(200);

        expect(response.body.success).toBe(true);
    });

    it('should deny unassigned coach access', async () => {
        await request(app.getHttpServer())
            .get(`/[resource]/patient/${patient.id}`)
            .set(authHeader(otherCoachToken))
            .expect(403);
    });

    it('should allow patient to access own data', async () => {
        const response = await request(app.getHttpServer())
            .get(`/[resource]/my-data`)
            .set(authHeader(patientToken))
            .expect(200);

        expect(response.body.success).toBe(true);
    });

    it('should deny patient access to other patient data', async () => {
        const otherPatient = await createTestUser(dataSource, {
            email: 'other-patient@test.com',
            password: TEST_PASSWORD,
            firstName: 'Other',
            lastName: 'Patient',
            role: RolesEnum.PATIENT,
        });

        await request(app.getHttpServer())
            .get(`/[resource]/patient/${otherPatient.id}`)
            .set(authHeader(patientToken))
            .expect(403);
    });
});
```

### Admin-Only Endpoints

```typescript
describe('[Resource] Admin-Only', () => {
    let adminUser: User;
    let regularUser: User;
    let adminToken: string;
    let userToken: string;

    beforeEach(async () => {
        const users = await seedTestUsers(dataSource);
        adminUser = users.admin;
        regularUser = users.user;
        adminToken = generateAccessToken(adminUser);
        userToken = generateAccessToken(regularUser);
    });

    it('should allow admin access', async () => {
        const response = await request(app.getHttpServer())
            .get('/[resource]/admin-only')
            .set(authHeader(adminToken))
            .expect(200);

        expect(response.body.success).toBe(true);
    });

    it('should deny non-admin users', async () => {
        await request(app.getHttpServer())
            .get('/[resource]/admin-only')
            .set(authHeader(userToken))
            .expect(403);
    });
});
```

---

## Using Fixtures

### User Fixture (test/fixtures/user.fixture.ts)

```typescript
// Pre-defined test users
import {
    testUsers,
    TEST_PASSWORD,
    createTestUser,
    seedTestUsers,
} from '../fixtures/user.fixture';

// Create single user
const admin = await createTestUser(dataSource, testUsers.admin);
const coach = await createTestUser(dataSource, testUsers.coach);
const patient = await createTestUser(dataSource, testUsers.patient);

// Create all users at once
const users = await seedTestUsers(dataSource);
// users.admin, users.coach, users.patient, users.user

// Custom user
const customUser = await createTestUser(dataSource, {
    email: 'custom@test.com',
    password: TEST_PASSWORD,
    firstName: 'Custom',
    lastName: 'User',
    role: RolesEnum.COACH,
});
```

### Auth Fixture (test/fixtures/auth.fixture.ts)

```typescript
import {
    generateAccessToken,
    generateRefreshToken,
    authHeader,
} from '../fixtures/auth.fixture';

// Generate tokens
const accessToken = generateAccessToken(user);
const refreshToken = generateRefreshToken(user);

// Use in requests
await request(app.getHttpServer())
    .get('/protected-route')
    .set(authHeader(accessToken)) // { Authorization: 'Bearer xxx' }
    .expect(200);
```

### Creating New Fixtures

```typescript
// test/fixtures/[entity].fixture.ts
import { DataSource } from 'typeorm';
import { YourEntity } from 'src/modules/[module]/[entity].entity';

export const testEntities = {
    default: {
        name: 'Test Entity',
        // ... other fields
    },
    variant: {
        name: 'Another Entity',
        // ... other fields
    },
};

export async function createTestEntity(
    dataSource: DataSource,
    data: Partial<YourEntity>,
): Promise<YourEntity> {
    const repository = dataSource.getRepository(YourEntity);
    const entity = repository.create(data);
    return await repository.save(entity);
}
```

---

## Creating Mocks

### Mock Service Pattern

```typescript
// test/mocks/[service].mock.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class Mock[Service]Service {
    private capturedData: any[] = [];

    // Implement all methods from original service
    async sendNotification(data: any): Promise<void> {
        this.capturedData.push(data);
    }

    // Test utilities
    getCapturedData(): any[] {
        return this.capturedData;
    }

    getLastCaptured(): any | undefined {
        return this.capturedData[this.capturedData.length - 1];
    }

    clear(): void {
        this.capturedData = [];
    }
}
```

### Using Mocks in Tests

```typescript
// In test-app.factory.ts, override the service:
.overrideProvider(OriginalService)
.useClass(MockService)

// In tests:
const mockService = module.get<MockService>(OriginalService);

// After action
const captured = mockService.getLastCaptured();
expect(captured).toBeDefined();
expect(captured.recipient).toBe('test@test.com');

// Cleanup
beforeEach(() => {
    mockService.clear();
});
```

---

## Smart Detection Rules

### Generate Complete Tests When:

- Endpoint extends BaseController with standard CRUD
- Standard REST patterns (GET, POST, PATCH, DELETE)
- Single entity operations
- No external service dependencies
- Clear DTO validation

### Generate Skeleton Tests When:

- Custom business logic beyond CRUD
- Multiple entity interactions
- External service calls (payment, notification, etc.)
- WebSocket endpoints
- File upload/download
- Complex query parameters

### Skeleton Test Format

```typescript
describe('[Complex Endpoint]', () => {
    it.todo('should handle [specific scenario]');
    // TODO: Implement test for complex business logic
    // Consider: [specific considerations]

    it('should return expected response structure', async () => {
        // Basic structure test - implement details
        const response = await request(app.getHttpServer())
            .post('/complex-endpoint')
            .set(authHeader(validToken))
            .send({
                // TODO: Add valid request body
            });

        // TODO: Add specific assertions
        expect(response.status).toBeLessThan(500);
    });
});
```

---

## Complete Examples

### Exercise Module E2E Test

```typescript
// test/e2e/exercises.e2e-spec.ts
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
import {
    createTestUser,
    testUsers,
    seedTestUsers,
} from '../fixtures/user.fixture';
import { generateAccessToken, authHeader } from '../fixtures/auth.fixture';
import { User } from 'src/modules/users/user.entity';
import { RolesEnum } from 'src/shared/enums';

describe('Exercises E2E Tests', () => {
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

    describe('Exercise CRUD (Admin Only)', () => {
        let adminUser: User;
        let adminToken: string;
        let coachUser: User;
        let coachToken: string;

        beforeEach(async () => {
            const users = await seedTestUsers(dataSource);
            adminUser = users.admin;
            coachUser = users.coach;
            adminToken = generateAccessToken(adminUser);
            coachToken = generateAccessToken(coachUser);
        });

        describe('POST /exercises', () => {
            it('should create exercise as admin', async () => {
                const response = await request(app.getHttpServer())
                    .post('/exercises')
                    .set(authHeader(adminToken))
                    .send({
                        title: 'Push Ups',
                        description: 'Basic push up exercise',
                        category: 'STRENGTH',
                        instructions: 'Keep your back straight',
                    })
                    .expect(201);

                expect(response.body.success).toBe(true);
                expect(response.body.data.title).toBe('Push Ups');
            });

            it('should deny non-admin users', async () => {
                await request(app.getHttpServer())
                    .post('/exercises')
                    .set(authHeader(coachToken))
                    .send({
                        title: 'Push Ups',
                        description: 'Basic push up exercise',
                        category: 'STRENGTH',
                    })
                    .expect(403);
            });
        });

        describe('GET /exercises', () => {
            it('should return exercise list', async () => {
                // Create exercise first
                await request(app.getHttpServer())
                    .post('/exercises')
                    .set(authHeader(adminToken))
                    .send({
                        title: 'Push Ups',
                        description: 'Test',
                        category: 'STRENGTH',
                    });

                const response = await request(app.getHttpServer())
                    .get('/exercises')
                    .set(authHeader(coachToken))
                    .expect(200);

                expect(response.body.success).toBe(true);
                expect(Array.isArray(response.body.data)).toBe(true);
            });

            it('should filter by category', async () => {
                const response = await request(app.getHttpServer())
                    .get('/exercises/category/STRENGTH')
                    .set(authHeader(coachToken))
                    .expect(200);

                expect(response.body.success).toBe(true);
            });
        });
    });

    describe('Exercise Prescriptions (Coach to Patient)', () => {
        let coach: User;
        let patient: User;
        let coachToken: string;
        let exerciseId: string;

        beforeEach(async () => {
            const users = await seedTestUsers(dataSource);
            coach = users.coach;
            patient = users.patient;
            coachToken = generateAccessToken(coach);

            // Create an exercise
            const adminToken = generateAccessToken(users.admin);
            const exerciseResponse = await request(app.getHttpServer())
                .post('/exercises')
                .set(authHeader(adminToken))
                .send({
                    title: 'Test Exercise',
                    description: 'For prescription',
                    category: 'STRENGTH',
                });
            exerciseId = exerciseResponse.body.data.id;

            // TODO: Setup coach-patient assignment
        });

        it('should create prescription for assigned patient', async () => {
            const response = await request(app.getHttpServer())
                .post('/exercises/prescriptions')
                .set(authHeader(coachToken))
                .send({
                    patientId: patient.id,
                    exerciseId: exerciseId,
                    sets: 3,
                    reps: 10,
                    notes: 'Start slow',
                })
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.patientId).toBe(patient.id);
        });

        it('should get patient prescriptions', async () => {
            // Create prescription first
            await request(app.getHttpServer())
                .post('/exercises/prescriptions')
                .set(authHeader(coachToken))
                .send({
                    patientId: patient.id,
                    exerciseId: exerciseId,
                    sets: 3,
                    reps: 10,
                });

            const response = await request(app.getHttpServer())
                .get(`/exercises/prescriptions/patient/${patient.id}`)
                .set(authHeader(coachToken))
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
        });
    });
});
```

---

## Test Checklist

### For Every New Endpoint

- [ ] **Authentication Tests**
    - [ ] Returns 401 without token
    - [ ] Returns 401 with invalid token
    - [ ] Accepts valid token

- [ ] **Authorization Tests** (if role-restricted)
    - [ ] Allows authorized roles
    - [ ] Returns 403 for unauthorized roles

- [ ] **Validation Tests**
    - [ ] Returns 400 for missing required fields
    - [ ] Returns 400 for invalid field formats
    - [ ] Accepts valid input

- [ ] **Success Cases**
    - [ ] Returns correct status code (200/201)
    - [ ] Returns expected response structure
    - [ ] Data is persisted/modified correctly

- [ ] **Error Cases**
    - [ ] Returns 404 for non-existent resources
    - [ ] Returns 409 for conflicts (if applicable)
    - [ ] Handles edge cases gracefully

### For CRUD Endpoints

- [ ] POST - Create with valid data
- [ ] POST - Validation errors
- [ ] GET (list) - Returns paginated results
- [ ] GET (list) - Filter/search works
- [ ] GET (single) - Returns by ID
- [ ] GET (single) - 404 for invalid ID
- [ ] PATCH - Updates successfully
- [ ] PATCH - Partial update works
- [ ] DELETE - Removes resource
- [ ] DELETE - 404 for invalid ID

### For Role-Based Endpoints

- [ ] Admin can access admin routes
- [ ] Coach can access coach routes
- [ ] Patient can access patient routes
- [ ] Coach can access assigned patient data
- [ ] Coach cannot access unassigned patient data
- [ ] Patient can access own data
- [ ] Patient cannot access other patient data

---

**Related Files:**

- [testing-guide.md](testing-guide.md) - General testing strategies
- [middleware-guide.md](middleware-guide.md) - Authentication guards
- [complete-examples.md](complete-examples.md) - Full implementation examples
