# Services and Repositories - NestJS Business Logic Layer

Complete guide to organizing business logic with BaseService and data access with BaseRepository in NestJS.

## Table of Contents

- [Service Layer Overview](#service-layer-overview)
- [BaseService Pattern](#baseservice-pattern)
- [Repository Pattern](#repository-pattern)
- [Dependency Injection](#dependency-injection)
- [Service Design Principles](#service-design-principles)
- [Testing Services](#testing-services)

---

## Service Layer Overview

### Purpose of Services

**Services contain business logic** - the 'what' and 'why' of your application:

```
Controller asks: "Create a user with this data"
Service answers: "First I'll check if email exists, validate roles, hash password, then create"
Repository executes: "Here's the saved user entity"
```

**Services are responsible for:**

- ✅ Business logic implementation
- ✅ Business rules enforcement
- ✅ Orchestrating multiple repositories
- ✅ Transaction management
- ✅ Complex calculations
- ✅ External service integration
- ✅ Business validations

**Services should NOT:**

- ❌ Know about HTTP (Request/Response)
- ❌ Direct TypeORM access (use repositories)
- ❌ Handle route-specific logic
- ❌ Format HTTP responses

---

## BaseService Pattern

### Why BaseService?

**Benefits:**

- ✅ **90% less code** - CRUD operations automatic
- ✅ **Consistent patterns** - Same methods across all services
- ✅ **Type-safe** - Generic types throughout
- ✅ **Easy to extend** - Add custom methods
- ✅ **Error handling** - Built-in NotFoundException
- ✅ **Relations support** - Load related entities automatically

### BaseService Template

```typescript
// src/core/base/base.service.ts
import { NotFoundException } from '@nestjs/common';
import { BaseRepository } from './base.repository';
import { BaseEntity } from './base.entity';
import { FindManyOptions, DeepPartial, FindOptionsRelations } from 'typeorm';

export abstract class BaseService<T extends BaseEntity> {
    constructor(
        protected readonly repository: BaseRepository<T>,
        protected readonly entityName: string,
    ) {}

    // Override this to specify default relations
    protected defaultRelations?: FindOptionsRelations<T>;

    async findByIdOrFail(
        id: string,
        relations?: FindOptionsRelations<T>,
    ): Promise<T> {
        const entity = await this.repository.findById(
            id,
            relations || this.defaultRelations,
        );
        if (!entity) {
            throw new NotFoundException(
                `${this.entityName} with ID ${id} not found`,
            );
        }
        return entity;
    }

    async findAll(options?: FindManyOptions<T>): Promise<T[]> {
        return this.repository.findAll({
            ...options,
            relations: options?.relations || this.defaultRelations,
        });
    }

    async create(data: DeepPartial<T>): Promise<T> {
        return this.repository.create(data);
    }

    async update(id: string, data: DeepPartial<T>): Promise<T | null> {
        await this.findByIdOrFail(id); // Ensure entity exists
        const updated = await this.repository.update(id, data);
        return updated;
    }

    async remove(id: string): Promise<void> {
        await this.findByIdOrFail(id); // Ensure entity exists
        await this.repository.softDelete(id);
    }

    async delete(id: string): Promise<void> {
        await this.findByIdOrFail(id); // Ensure entity exists
        await this.repository.delete(id);
    }
}
```

### Using BaseService

```typescript
// src/modules/users/user.service.ts
import { Injectable, ConflictException } from '@nestjs/common';
import { BaseService } from 'src/core/base';
import { User } from './user.entity';
import { UserRepository } from './user.repository';
import { CreateUserDto } from './dtos';

@Injectable()
export class UserService extends BaseService<User> {
    constructor(protected readonly repository: UserRepository) {
        super(repository, 'User');
    }

    // Inherited methods available:
    // - create(data)
    // - findAll(options)
    // - findByIdOrFail(id)
    // - update(id, data)
    // - remove(id)      // soft delete
    // - delete(id)      // hard delete

    // Add custom business logic:
    async createUser(data: CreateUserDto): Promise<User> {
        // Business rule: Check if email already exists
        const existing = await this.repository.findOne({
            where: { email: data.email },
        });

        if (existing) {
            throw new ConflictException('Email already exists');
        }

        // Business rule: Validate roles
        if (data.roles && !this.areValidRoles(data.roles)) {
            throw new BadRequestException('Invalid roles');
        }

        // Create user
        return this.repository.create(data);
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.repository.findOne({ where: { email } });
    }

    async getActiveUsers(): Promise<User[]> {
        return this.repository.findAll({
            where: { isActive: true },
        });
    }

    private areValidRoles(roles: string[]): boolean {
        const validRoles = ['user', 'admin', 'operations'];
        return roles.every((role) => validRoles.includes(role));
    }
}
```

### Service with Relations

```typescript
@Injectable()
export class UserService extends BaseService<User> {
    // Define default relations to load
    protected defaultRelations = {
        profile: true,
        roles: true,
    };

    constructor(protected readonly repository: UserRepository) {
        super(repository, 'User');
    }

    // Now all methods automatically load relations:
    async findByIdOrFail(id: string): Promise<User> {
        // Returns user with profile and roles loaded
        return super.findByIdOrFail(id);
    }

    // Or override to load specific relations:
    async findUserWithOrders(id: string): Promise<User> {
        return this.findByIdOrFail(id, {
            profile: true,
            orders: {
                items: true,
            },
        });
    }
}
```

---

## Repository Pattern

### Purpose of Repositories

**Repositories abstract data access** - the 'how' of data operations:

```
Service: "Get me all active users sorted by name"
Repository: "Here's the TypeORM query that does that"
```

**Repositories are responsible for:**

- ✅ All TypeORM operations
- ✅ Query construction
- ✅ Query optimization (select, relations)
- ✅ Database error handling
- ✅ Custom queries

**Repositories should NOT:**

- ❌ Contain business logic
- ❌ Know about HTTP
- ❌ Make business decisions

### BaseRepository Pattern

```typescript
// src/core/base/base.repository.ts
import {
    Repository,
    FindManyOptions,
    FindOneOptions,
    DeepPartial,
} from 'typeorm';
import { BaseEntity } from './base.entity';

export abstract class BaseRepository<T extends BaseEntity> {
    constructor(protected readonly repository: Repository<T>) {}

    async findAll(options?: FindManyOptions<T>): Promise<T[]> {
        return this.repository.find(options);
    }

    async findById(id: string, relations?: any): Promise<T | null> {
        return this.repository.findOne({
            where: { id } as any,
            relations,
        });
    }

    async findOne(options: FindOneOptions<T>): Promise<T | null> {
        return this.repository.findOne(options);
    }

    async create(data: DeepPartial<T>): Promise<T> {
        const entity = this.repository.create(data);
        return this.repository.save(entity);
    }

    async update(id: string, data: DeepPartial<T>): Promise<T | null> {
        await this.repository.update(id, data as any);
        return this.findById(id);
    }

    async softDelete(id: string): Promise<void> {
        await this.repository.softDelete(id);
    }

    async delete(id: string): Promise<void> {
        await this.repository.delete(id);
    }
}
```

### Using BaseRepository

```typescript
// src/modules/users/user.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from 'src/core/base';
import { User } from './user.entity';

@Injectable()
export class UserRepository extends BaseRepository<User> {
    constructor(
        @InjectRepository(User)
        repository: Repository<User>,
    ) {
        super(repository);
    }

    // Inherited methods:
    // - findAll(options)
    // - findById(id)
    // - findOne(options)
    // - create(data)
    // - update(id, data)
    // - softDelete(id)
    // - delete(id)

    // Add custom queries:
    async findByEmail(email: string): Promise<User | null> {
        return this.findOne({ where: { email } });
    }

    async findActiveUsers(): Promise<User[]> {
        return this.findAll({
            where: { isActive: true },
            order: { createdAt: 'DESC' },
        });
    }

    async findWithRoles(userId: string): Promise<User | null> {
        return this.repository.findOne({
            where: { id: userId },
            relations: { roles: true },
        });
    }

    async countByRole(role: string): Promise<number> {
        return this.repository
            .createQueryBuilder('user')
            .where(':role = ANY(user.roles)', { role })
            .getCount();
    }
}
```

---

## Dependency Injection

### NestJS Dependency Injection Pattern

NestJS uses constructor-based dependency injection:

```typescript
@Injectable()
export class UserService extends BaseService<User> {
    constructor(
        protected readonly repository: UserRepository,
        private readonly mailService: MailService, // Inject services
        private readonly tokenService: TokenService, // Multiple DI
    ) {
        super(repository, 'User');
    }

    async createUser(data: CreateUserDto): Promise<User> {
        // Create user
        const user = await this.repository.create(data);

        // Use injected services
        await this.mailService.sendWelcome(user.email);
        const token = await this.tokenService.generate(user);

        return user;
    }
}
```

### Module Configuration

```typescript
// user.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UserRepository } from './user.repository';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { MailModule } from '@infrastructure/mail/mail.module';
import { TokenModule } from '@infrastructure/token/token.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([User]), // Register entity
        MailModule, // Import other modules
        TokenModule,
    ],
    controllers: [UserController],
    providers: [UserService, UserRepository],
    exports: [UserService], // Export for use in other modules
})
export class UserModule {}
```

### Circular Dependency Handling

When services depend on each other:

```typescript
// user.service.ts
import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { OrderService } from '../orders/order.service';

@Injectable()
export class UserService extends BaseService<User> {
    constructor(
        protected readonly repository: UserRepository,
        @Inject(forwardRef(() => OrderService))
        private readonly orderService: OrderService,
    ) {
        super(repository, 'User');
    }

    async getUserWithOrders(userId: string) {
        const user = await this.findByIdOrFail(userId);
        const orders = await this.orderService.findByUserId(userId);
        return { ...user, orders };
    }
}
```

---

## Service Design Principles

### 1. Single Responsibility

Each service should have ONE clear purpose:

```typescript
// ✅ GOOD - Single responsibility
@Injectable()
export class UserService extends BaseService<User> {
    async createUser() {}
    async updateUser() {}
    async deleteUser() {}
    async findByEmail() {}
}

@Injectable()
export class EmailService {
    async sendEmail() {}
    async sendBulkEmails() {}
}

// ❌ BAD - Too many responsibilities
@Injectable()
export class UserService extends BaseService<User> {
    async createUser() {}
    async sendWelcomeEmail() {} // Should be EmailService
    async logUserActivity() {} // Should be AuditService
    async processPayment() {} // Should be PaymentService
}
```

### 2. Clear Method Names

Method names should describe WHAT they do:

```typescript
// ✅ GOOD - Clear intent
async createUser(data: CreateUserDto): Promise<User>
async findByEmail(email: string): Promise<User | null>
async getActiveUsers(): Promise<User[]>
async updateUserProfile(userId: string, data: UpdateProfileDto): Promise<User>

// ❌ BAD - Vague or misleading
async process(data: any): Promise<any>
async handle(params: any): Promise<any>
async doIt(): Promise<void>
async execute(): Promise<any>
```

### 3. Return Types

Always use explicit return types:

```typescript
// ✅ GOOD - Explicit types
async createUser(data: CreateUserDto): Promise<User> {
    return this.repository.create(data);
}

async findUsers(): Promise<User[]> {
    return this.repository.findAll();
}

async deleteUser(id: string): Promise<void> {
    await this.repository.softDelete(id);
}

// ❌ BAD - Implicit any
async createUser(data) {  // No types!
    return this.repository.create(data);
}
```

### 4. Error Handling

Services should throw meaningful NestJS exceptions:

```typescript
import {
    NotFoundException,
    ConflictException,
    BadRequestException,
    UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class UserService extends BaseService<User> {
    async createUser(data: CreateUserDto): Promise<User> {
        // ✅ GOOD - Meaningful errors
        const existing = await this.findByEmail(data.email);
        if (existing) {
            throw new ConflictException('Email already exists');
        }

        if (!this.areValidRoles(data.roles)) {
            throw new BadRequestException('Invalid roles provided');
        }

        return this.repository.create(data);
    }

    async updateUser(id: string, data: UpdateUserDto): Promise<User> {
        // ✅ Uses findByIdOrFail which throws NotFoundException
        const user = await this.findByIdOrFail(id);
        return this.repository.update(id, data);
    }

    // ❌ BAD - Generic errors
    async badExample(id: string): Promise<User> {
        const user = await this.repository.findById(id);
        if (!user) {
            throw new Error('Error'); // What error?
        }
        return user;
    }
}
```

### 5. Business Logic in Services

Keep business logic in services, not controllers or repositories:

```typescript
@Injectable()
export class OrderService extends BaseService<Order> {
    constructor(
        protected readonly repository: OrderRepository,
        private readonly productService: ProductService,
        private readonly userService: UserService,
    ) {
        super(repository, 'Order');
    }

    async createOrder(userId: string, items: OrderItemDto[]): Promise<Order> {
        // Business rule: Verify user exists
        const user = await this.userService.findByIdOrFail(userId);

        // Business rule: Verify all products exist and are available
        for (const item of items) {
            const product = await this.productService.findByIdOrFail(
                item.productId,
            );
            if (!product.isAvailable) {
                throw new BadRequestException(
                    `Product ${product.name} is not available`,
                );
            }
            if (product.stock < item.quantity) {
                throw new BadRequestException(
                    `Insufficient stock for ${product.name}`,
                );
            }
        }

        // Business rule: Calculate total
        const total = items.reduce((sum, item) => {
            return sum + item.price * item.quantity;
        }, 0);

        // Business rule: Apply discount if eligible
        const discount = await this.calculateDiscount(user, total);
        const finalTotal = total - discount;

        // Create order
        return this.repository.create({
            userId,
            items,
            total: finalTotal,
            status: 'pending',
        });
    }

    private async calculateDiscount(
        user: User,
        total: number,
    ): Promise<number> {
        // Business logic for discount calculation
        if (user.isPremium && total > 100) {
            return total * 0.1; // 10% discount
        }
        return 0;
    }
}
```

### 6. Transaction Management

Handle transactions in services:

```typescript
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class OrderService extends BaseService<Order> {
    constructor(
        protected readonly repository: OrderRepository,
        private readonly productService: ProductService,
        private readonly dataSource: DataSource, // Inject DataSource for transactions
    ) {
        super(repository, 'Order');
    }

    async createOrderWithTransaction(
        userId: string,
        items: OrderItemDto[],
    ): Promise<Order> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Create order
            const order = await queryRunner.manager.save(Order, {
                userId,
                items,
                status: 'pending',
            });

            // Update product stock
            for (const item of items) {
                await queryRunner.manager.decrement(
                    Product,
                    { id: item.productId },
                    'stock',
                    item.quantity,
                );
            }

            // Commit transaction
            await queryRunner.commitTransaction();
            return order;
        } catch (error) {
            // Rollback on error
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            // Release query runner
            await queryRunner.release();
        }
    }
}
```

---

## Testing Services

### Unit Testing Services

```typescript
// user.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { User } from './user.entity';

describe('UserService', () => {
    let service: UserService;
    let repository: UserRepository;

    const mockUserRepository = {
        findOne: jest.fn(),
        create: jest.fn(),
        findById: jest.fn(),
        update: jest.fn(),
        softDelete: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UserService,
                {
                    provide: UserRepository,
                    useValue: mockUserRepository,
                },
            ],
        }).compile();

        service = module.get<UserService>(UserService);
        repository = module.get<UserRepository>(UserRepository);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createUser', () => {
        const createUserDto = {
            email: 'test@example.com',
            name: 'Test User',
            password: 'password123',
            roles: ['user'],
        };

        it('should create a user when email does not exist', async () => {
            // Arrange
            mockUserRepository.findOne.mockResolvedValue(null);
            const createdUser = { id: 'uuid', ...createUserDto };
            mockUserRepository.create.mockResolvedValue(createdUser);

            // Act
            const result = await service.createUser(createUserDto);

            // Assert
            expect(result).toEqual(createdUser);
            expect(mockUserRepository.findOne).toHaveBeenCalledWith({
                where: { email: createUserDto.email },
            });
            expect(mockUserRepository.create).toHaveBeenCalledWith(
                createUserDto,
            );
        });

        it('should throw ConflictException when email already exists', async () => {
            // Arrange
            mockUserRepository.findOne.mockResolvedValue({
                id: 'existing-uuid',
            });

            // Act & Assert
            await expect(service.createUser(createUserDto)).rejects.toThrow(
                ConflictException,
            );
            expect(mockUserRepository.create).not.toHaveBeenCalled();
        });

        it('should throw BadRequestException for invalid roles', async () => {
            // Arrange
            const invalidDto = { ...createUserDto, roles: ['invalid-role'] };
            mockUserRepository.findOne.mockResolvedValue(null);

            // Act & Assert
            await expect(service.createUser(invalidDto)).rejects.toThrow(
                BadRequestException,
            );
        });
    });

    describe('findByIdOrFail', () => {
        it('should return user when found', async () => {
            // Arrange
            const user = { id: 'uuid', email: 'test@example.com' };
            mockUserRepository.findById.mockResolvedValue(user);

            // Act
            const result = await service.findByIdOrFail('uuid');

            // Assert
            expect(result).toEqual(user);
            expect(mockUserRepository.findById).toHaveBeenCalledWith(
                'uuid',
                undefined,
            );
        });

        it('should throw NotFoundException when user not found', async () => {
            // Arrange
            mockUserRepository.findById.mockResolvedValue(null);

            // Act & Assert
            await expect(service.findByIdOrFail('uuid')).rejects.toThrow(
                NotFoundException,
            );
        });
    });
});
```

### Integration Testing

```typescript
// user.service.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { User } from './user.entity';

describe('UserService Integration', () => {
    let service: UserService;
    let module: TestingModule;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            imports: [
                TypeOrmModule.forRoot({
                    type: 'postgres',
                    host: 'localhost',
                    port: 5432,
                    database: 'test_db',
                    entities: [User],
                    synchronize: true,
                }),
                TypeOrmModule.forFeature([User]),
            ],
            providers: [UserService, UserRepository],
        }).compile();

        service = module.get<UserService>(UserService);
    });

    afterAll(async () => {
        await module.close();
    });

    it('should create and find user', async () => {
        const userData = {
            email: 'integration@test.com',
            name: 'Integration Test',
            password: 'password123',
            roles: ['user'],
        };

        const created = await service.createUser(userData);
        expect(created.id).toBeDefined();

        const found = await service.findByIdOrFail(created.id);
        expect(found.email).toBe(userData.email);
    });
});
```

---

## Best Practices Summary

### ✅ DO:

- Extend BaseService for all entities
- Use NestJS dependency injection
- Throw NestJS exceptions (NotFoundException, ConflictException)
- Keep business logic in services
- Use explicit return types
- Write unit tests for business logic
- Use transactions for multi-step operations
- Inject repositories, not TypeORM directly
- Define defaultRelations for common includes

### ❌ DON'T:

- Put business logic in controllers or repositories
- Use new keyword to instantiate services
- Access TypeORM directly in services (use repositories)
- Return generic Error objects
- Create "god services" with too many responsibilities
- Forget to handle edge cases
- Skip error handling
- Use any types
- Mix HTTP concerns with business logic

---

**Related Files:**

- [SKILL.md](../SKILL.md) - Main guide
- [architecture-overview.md](architecture-overview.md) - Four-layer architecture
- [routing-and-controllers.md](routing-and-controllers.md) - Controller patterns
- [database-patterns.md](database-patterns.md) - TypeORM repositories
- [testing-guide.md](testing-guide.md) - Testing strategies
