# Mock Factories for NestJS Testing

Comprehensive guide to creating mock factories for services and repositories in NestJS applications.

---

## Service Mocks

### Basic Service Mock

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

### Usage in Tests

```typescript
import { mockUserService, resetMocks } from '../fixtures/mocks/user-service.mock';

describe('UserController', () => {
    beforeEach(() => {
        resetMocks();
    });

    it('should call service.findAll', async () => {
        mockUserService.findAll.mockResolvedValue([]);
        // Test code here
    });
});
```

---

## Repository Mocks

### Generic Repository Mock

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

### Usage with Specific Entity

```typescript
import { createMockRepository } from '../fixtures/mocks/repository.mock';
import { User } from '@/modules/user/entities/user.entity';

describe('UserService', () => {
    let service: UserService;
    let repository: ReturnType<typeof createMockRepository>;

    beforeEach(async () => {
        repository = createMockRepository<User>();

        const module = await Test.createTestingModule({
            providers: [
                UserService,
                {
                    provide: getRepositoryToken(User),
                    useValue: repository,
                },
            ],
        }).compile();

        service = module.get<UserService>(UserService);
    });

    it('should find user by id', async () => {
        const mockUser = { id: '1', email: 'test@example.com' };
        repository.findOne.mockResolvedValue(mockUser);

        const result = await service.findOne('1');
        expect(result).toEqual(mockUser);
    });
});
```

---

## Query Builder Mocks

### Advanced Query Builder Mock

```typescript
// test/fixtures/mocks/query-builder.mock.ts
export function createMockQueryBuilder<T>() {
    const queryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        having: jest.fn().mockReturnThis(),
        getOne: jest.fn(),
        getMany: jest.fn(),
        getManyAndCount: jest.fn(),
        getCount: jest.fn(),
        getRawOne: jest.fn(),
        getRawMany: jest.fn(),
        execute: jest.fn(),
    };

    return queryBuilder;
}
```

### Usage

```typescript
it('should filter users with query builder', async () => {
    const mockQB = createMockQueryBuilder();
    mockQB.getMany.mockResolvedValue([mockUser]);

    repository.createQueryBuilder.mockReturnValue(mockQB);

    const result = await service.findWithFilters({ role: 'admin' });

    expect(mockQB.where).toHaveBeenCalledWith('user.role = :role', { role: 'admin' });
    expect(result).toEqual([mockUser]);
});
```

---

## External Service Mocks

### Mail Service Mock

```typescript
// test/fixtures/mocks/mail.service.mock.ts
export const mockMailService = {
    sendWelcomeEmail: jest.fn().mockResolvedValue(true),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
    sendVerificationEmail: jest.fn().mockResolvedValue(true),
};

export function createMockMailService(overrides = {}) {
    return {
        ...mockMailService,
        ...overrides,
    };
}
```

### S3 Service Mock

```typescript
// test/fixtures/mocks/s3.service.mock.ts
export const mockS3Service = {
    upload: jest.fn().mockResolvedValue({ url: 'https://s3.example.com/file.jpg' }),
    delete: jest.fn().mockResolvedValue(true),
    getSignedUrl: jest.fn().mockResolvedValue('https://s3.example.com/signed-url'),
};
```

### Payment Service Mock

```typescript
// test/fixtures/mocks/payment.service.mock.ts
export const mockPaymentService = {
    createCharge: jest.fn().mockResolvedValue({ id: 'charge_123', status: 'succeeded' }),
    refund: jest.fn().mockResolvedValue({ id: 'refund_123', status: 'succeeded' }),
    getCustomer: jest.fn().mockResolvedValue({ id: 'cus_123', email: 'test@example.com' }),
};
```

---

## JWT Service Mock

```typescript
// test/fixtures/mocks/jwt.service.mock.ts
export const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
    verify: jest.fn().mockReturnValue({ sub: 'user-id', email: 'test@example.com' }),
    decode: jest.fn().mockReturnValue({ sub: 'user-id', email: 'test@example.com' }),
};

export function createMockJwtService(overrides = {}) {
    return {
        ...mockJwtService,
        ...overrides,
    };
}
```

### Usage

```typescript
const module = await Test.createTestingModule({
    providers: [
        AuthService,
        {
            provide: JwtService,
            useValue: mockJwtService,
        },
    ],
}).compile();
```

---

## Config Service Mock

```typescript
// test/fixtures/mocks/config.service.mock.ts
export const mockConfigService = {
    get: jest.fn((key: string) => {
        const config = {
            'database.host': 'localhost',
            'database.port': 5432,
            'jwt.secret': 'test-secret',
            'jwt.expiresIn': '1h',
        };
        return config[key];
    }),
    getOrThrow: jest.fn((key: string) => {
        const value = mockConfigService.get(key);
        if (!value) throw new Error(`Config key ${key} not found`);
        return value;
    }),
};
```

---

## Best Practices

### 1. Reset Mocks Between Tests

```typescript
beforeEach(() => {
    jest.clearAllMocks();
    // Or for specific mocks
    mockUserService.findAll.mockReset();
});
```

### 2. Type-Safe Mocks

```typescript
import { DeepMocked } from '@golevelup/ts-jest';

let mockService: DeepMocked<UserService>;

beforeEach(async () => {
    mockService = createMock<UserService>();
});
```

### 3. Mock Implementation

```typescript
mockUserService.findOne.mockImplementation(async (id: string) => {
    if (id === 'invalid') return null;
    return { id, email: `user-${id}@example.com` };
});
```

### 4. Mock Resolved/Rejected Values

```typescript
// Success
mockService.create.mockResolvedValue(mockUser);

// Error
mockService.create.mockRejectedValue(new Error('Database error'));
```

### 5. Verify Mock Calls

```typescript
expect(mockUserService.findAll).toHaveBeenCalled();
expect(mockUserService.findOne).toHaveBeenCalledWith('user-id');
expect(mockUserService.create).toHaveBeenCalledTimes(1);
```

---

## Related Files

- [jest-fixtures.md](../jest-fixtures.md) - Main fixtures guide
- [test-app.factory.ts](../../../../backend/test/setup/test-app.factory.ts) - Test app setup

---

**Related Skills**: [jest-fixtures](../jest-fixtures.md), [supertest-patterns](../supertest-patterns.md)
