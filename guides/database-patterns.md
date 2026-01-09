# Database Patterns - TypeORM in NestJS

Complete guide to database access patterns using TypeORM with PostgreSQL in NestJS applications.

## Table of Contents

- [TypeORM Fundamentals](#typeorm-fundamentals)
- [Entity Patterns](#entity-patterns)
- [Repository Pattern](#repository-pattern)
- [Relationships](#relationships)
- [Migrations](#migrations)
- [Query Optimization](#query-optimization)
- [Transactions](#transactions)
- [Error Handling](#error-handling)

---

## TypeORM Fundamentals

### BaseEntity Pattern

All entities should extend BaseEntity for automatic timestamps and soft delete:

```typescript
// src/core/base/base.entity.ts
import {
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
} from 'typeorm';

export abstract class BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @CreateDateColumn({ type: 'timestamp' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updatedAt: Date;

    @DeleteDateColumn({ type: 'timestamp', nullable: true })
    deletedAt: Date | null;
}
```

### Database Configuration

```typescript
// src/config/db.config.ts
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { envConfigService } from './env-config.service';

export const dbConfig: TypeOrmModuleOptions = {
    type: 'postgres',
    host: envConfigService.get('DB_HOST'),
    port: envConfigService.get('DB_PORT'),
    username: envConfigService.get('DB_USERNAME'),
    password: envConfigService.get('DB_PASSWORD'),
    database: envConfigService.get('DB_DATABASE'),
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
    synchronize: false, // NEVER true in production
    logging: envConfigService.get('NODE_ENV') === 'development',
    ssl:
        envConfigService.get('NODE_ENV') === 'production'
            ? {
                  rejectUnauthorized: false,
              }
            : false,
};
```

---

## Entity Patterns

### Basic Entity

```typescript
// src/modules/users/user.entity.ts
import { Entity, Column } from 'typeorm';
import { BaseEntity } from 'src/core/base';

@Entity('users')
export class User extends BaseEntity {
    @Column({ unique: true })
    email: string;

    @Column()
    name: string;

    @Column()
    password: string;

    @Column({ default: true })
    isActive: boolean;

    @Column('simple-array', { default: [] })
    roles: string[];
}
```

### Column Types

```typescript
import { Entity, Column } from 'typeorm';
import { BaseEntity } from 'src/core/base';

@Entity('products')
export class Product extends BaseEntity {
    // String columns
    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string | null;

    // Number columns
    @Column({ type: 'decimal', precision: 10, scale: 2 })
    price: number;

    @Column({ type: 'int', default: 0 })
    stock: number;

    // Boolean
    @Column({ type: 'boolean', default: true })
    isAvailable: boolean;

    // Date/Time
    @Column({ type: 'timestamp', nullable: true })
    publishedAt: Date | null;

    // JSON
    @Column({ type: 'jsonb', nullable: true })
    metadata: Record<string, any> | null;

    // Array (PostgreSQL)
    @Column('simple-array')
    tags: string[];

    // Enum
    @Column({
        type: 'enum',
        enum: ['pending', 'active', 'archived'],
        default: 'pending',
    })
    status: 'pending' | 'active' | 'archived';
}
```

### Index and Unique Constraints

```typescript
import { Entity, Column, Index, Unique } from 'typeorm';
import { BaseEntity } from 'src/core/base';

@Entity('users')
@Unique(['email'])
@Index(['email', 'isActive']) // Composite index
export class User extends BaseEntity {
    @Column({ unique: true })
    @Index()
    email: string;

    @Column()
    @Index()
    name: string;

    @Column()
    password: string;

    @Column({ default: true })
    isActive: boolean;
}
```

---

## Repository Pattern

### BaseRepository Implementation

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

    async findById(id: string, relations?: string[]): Promise<T | null> {
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

    async count(options?: FindManyOptions<T>): Promise<number> {
        return this.repository.count(options);
    }
}
```

### Custom Repository

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

    // Custom queries
    async findByEmail(email: string): Promise<User | null> {
        return this.repository.findOne({
            where: { email },
        });
    }

    async findActiveUsers(): Promise<User[]> {
        return this.repository.find({
            where: { isActive: true },
            order: { createdAt: 'DESC' },
        });
    }

    async findWithRoles(userId: string): Promise<User | null> {
        return this.repository
            .createQueryBuilder('user')
            .where('user.id = :userId', { userId })
            .andWhere("'admin' = ANY(user.roles)")
            .getOne();
    }

    async searchByName(query: string): Promise<User[]> {
        return this.repository
            .createQueryBuilder('user')
            .where('user.name ILIKE :query', { query: `%${query}%` })
            .andWhere('user.isActive = :isActive', { isActive: true })
            .orderBy('user.name', 'ASC')
            .getMany();
    }
}
```

---

## Relationships

### One-to-One

```typescript
// user.entity.ts
import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/core/base';
import { Profile } from './profile.entity';

@Entity('users')
export class User extends BaseEntity {
    @Column()
    email: string;

    @OneToOne(() => Profile, (profile) => profile.user, { cascade: true })
    @JoinColumn()
    profile: Profile;
}

// profile.entity.ts
@Entity('profiles')
export class Profile extends BaseEntity {
    @Column()
    firstName: string;

    @Column()
    lastName: string;

    @OneToOne(() => User, (user) => user.profile)
    user: User;
}
```

### One-to-Many / Many-to-One

```typescript
// user.entity.ts
import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/core/base';
import { Post } from '../posts/post.entity';

@Entity('users')
export class User extends BaseEntity {
    @Column()
    name: string;

    @OneToMany(() => Post, (post) => post.author)
    posts: Post[];
}

// post.entity.ts
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/core/base';
import { User } from '../users/user.entity';

@Entity('posts')
export class Post extends BaseEntity {
    @Column()
    title: string;

    @Column('text')
    content: string;

    @Column()
    authorId: string;

    @ManyToOne(() => User, (user) => user.posts)
    @JoinColumn({ name: 'authorId' })
    author: User;
}
```

### Many-to-Many

```typescript
// user.entity.ts
import { Entity, Column, ManyToMany, JoinTable } from 'typeorm';
import { BaseEntity } from 'src/core/base';
import { Role } from '../roles/role.entity';

@Entity('users')
export class User extends BaseEntity {
    @Column()
    name: string;

    @ManyToMany(() => Role, (role) => role.users)
    @JoinTable({
        name: 'user_roles',
        joinColumn: { name: 'userId', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'roleId', referencedColumnName: 'id' },
    })
    roles: Role[];
}

// role.entity.ts
@Entity('roles')
export class Role extends BaseEntity {
    @Column({ unique: true })
    name: string;

    @ManyToMany(() => User, (user) => user.roles)
    users: User[];
}
```

### Loading Relations

```typescript
// Eager loading (automatically loads relations)
@Entity('users')
export class User extends BaseEntity {
    @OneToOne(() => Profile, (profile) => profile.user, { eager: true })
    @JoinColumn()
    profile: Profile;
}

// Lazy loading
const user = await userRepository.findOne({
    where: { id },
    relations: ['profile', 'posts'],
});

// With QueryBuilder
const user = await userRepository
    .createQueryBuilder('user')
    .leftJoinAndSelect('user.profile', 'profile')
    .leftJoinAndSelect('user.posts', 'posts')
    .where('user.id = :id', { id })
    .getOne();

// Nested relations
const user = await userRepository.findOne({
    where: { id },
    relations: {
        profile: true,
        posts: {
            comments: true,
        },
    },
});
```

---

## Migrations

### Generate Migration

```bash
# Generate migration from entity changes
npm run migration:generate -- src/database/migrations/CreateUserTable

# Create empty migration
npm run migration:create -- src/database/migrations/AddIndexToUser
```

### Migration File

```typescript
// src/database/migrations/1234567890-CreateUserTable.ts
import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateUserTable1234567890 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'users',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'uuid_generate_v4()',
                    },
                    {
                        name: 'email',
                        type: 'varchar',
                        length: '255',
                        isUnique: true,
                    },
                    {
                        name: 'name',
                        type: 'varchar',
                        length: '255',
                    },
                    {
                        name: 'password',
                        type: 'varchar',
                        length: '255',
                    },
                    {
                        name: 'isActive',
                        type: 'boolean',
                        default: true,
                    },
                    {
                        name: 'roles',
                        type: 'text',
                        isArray: true,
                        default: 'ARRAY[]::text[]',
                    },
                    {
                        name: 'createdAt',
                        type: 'timestamp',
                        default: 'now()',
                    },
                    {
                        name: 'updatedAt',
                        type: 'timestamp',
                        default: 'now()',
                    },
                    {
                        name: 'deletedAt',
                        type: 'timestamp',
                        isNullable: true,
                    },
                ],
                indices: [
                    {
                        name: 'IDX_USER_EMAIL',
                        columnNames: ['email'],
                    },
                ],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('users');
    }
}
```

### Run Migrations

```bash
# Run all pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert

# Show migration status
npm run migration:show
```

---

## Query Optimization

### Select Specific Fields

```typescript
// ❌ Fetches all fields
const users = await userRepository.find();

// ✅ Only fetch needed fields
const users = await userRepository.find({
    select: ['id', 'email', 'name'],
});

// With QueryBuilder
const users = await userRepository
    .createQueryBuilder('user')
    .select(['user.id', 'user.email', 'user.name'])
    .getMany();
```

### Pagination

```typescript
async findPaginated(page: number = 1, limit: number = 10): Promise<[User[], number]> {
    const skip = (page - 1) * limit;

    return this.repository.findAndCount({
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
    });
}

// With QueryBuilder
async findPaginatedWithSearch(
    page: number,
    limit: number,
    search?: string,
): Promise<[User[], number]> {
    const query = this.repository
        .createQueryBuilder('user')
        .skip((page - 1) * limit)
        .take(limit)
        .orderBy('user.createdAt', 'DESC');

    if (search) {
        query.where('user.name ILIKE :search', { search: `%${search}%` });
    }

    return query.getManyAndCount();
}
```

### N+1 Query Prevention

```typescript
// ❌ N+1 Problem
const users = await userRepository.find();
for (const user of users) {
    user.posts = await postRepository.find({ where: { authorId: user.id } });
}

// ✅ Solution: Use relations
const users = await userRepository.find({
    relations: ['posts'],
});

// ✅ Or use QueryBuilder with join
const users = await userRepository
    .createQueryBuilder('user')
    .leftJoinAndSelect('user.posts', 'post')
    .getMany();
```

### Indexes

```typescript
// Add indexes for frequently queried fields
@Entity('users')
@Index(['email', 'isActive']) // Composite index
export class User extends BaseEntity {
    @Column({ unique: true })
    @Index() // Single field index
    email: string;

    @Column()
    @Index()
    name: string;

    @Column({ default: true })
    isActive: boolean;
}
```

---

## Transactions

### Simple Transaction

```typescript
import { DataSource } from 'typeorm';

@Injectable()
export class UserService {
    constructor(private dataSource: DataSource) {}

    async createUserWithProfile(userData: CreateUserDto): Promise<User> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Create user
            const user = queryRunner.manager.create(User, userData);
            await queryRunner.manager.save(user);

            // Create profile
            const profile = queryRunner.manager.create(Profile, {
                userId: user.id,
                firstName: userData.firstName,
                lastName: userData.lastName,
            });
            await queryRunner.manager.save(profile);

            // Commit transaction
            await queryRunner.commitTransaction();
            return user;
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

### Transaction with DataSource

```typescript
async transferFunds(fromId: string, toId: string, amount: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
        // Deduct from sender
        await manager.decrement(
            Account,
            { id: fromId },
            'balance',
            amount,
        );

        // Add to receiver
        await manager.increment(
            Account,
            { id: toId },
            'balance',
            amount,
        );

        // Create transaction record
        await manager.save(Transaction, {
            fromId,
            toId,
            amount,
        });
    });
}
```

---

## Error Handling

### TypeORM Errors

```typescript
import { QueryFailedError } from 'typeorm';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';

async createUser(data: CreateUserDto): Promise<User> {
    try {
        return await this.repository.create(data);
    } catch (error) {
        if (error instanceof QueryFailedError) {
            // Unique constraint violation
            if (error.message.includes('duplicate key')) {
                throw new ConflictException('Email already exists');
            }

            // Foreign key constraint
            if (error.message.includes('foreign key constraint')) {
                throw new BadRequestException('Invalid reference');
            }

            // Not null constraint
            if (error.message.includes('not-null constraint')) {
                throw new BadRequestException('Required field missing');
            }
        }

        throw error;
    }
}
```

### Custom Error Handler

```typescript
@Injectable()
export class DatabaseErrorHandler {
    handleError(error: unknown): never {
        if (error instanceof QueryFailedError) {
            const message = error.message.toLowerCase();

            if (message.includes('duplicate key')) {
                throw new ConflictException('Resource already exists');
            }

            if (message.includes('foreign key')) {
                throw new BadRequestException('Invalid reference');
            }

            if (message.includes('not-null')) {
                throw new BadRequestException('Required field missing');
            }
        }

        throw new InternalServerErrorException('Database operation failed');
    }
}
```

---

## Best Practices Summary

### ✅ DO:

- Extend BaseEntity for all entities
- Use migrations for schema changes (never synchronize in production)
- Add indexes on frequently queried fields
- Use transactions for multi-step operations
- Select only needed fields
- Use relations to prevent N+1 queries
- Use QueryBuilder for complex queries
- Handle database errors properly
- Use soft delete for important data
- Add unique constraints where needed

### ❌ DON'T:

- Use synchronize: true in production
- Forget to add indexes on foreign keys
- Load unnecessary relations
- Skip transactions for multi-step operations
- Expose raw database errors to users
- Use SELECT \* in queries
- Hard delete without consideration
- Forget to release query runners
- Use eager loading everywhere
- Skip migration testing

---

**Related Files:**

- [SKILL.md](../SKILL.md) - Main guide
- [services-and-repositories.md](services-and-repositories.md) - Service/Repository patterns
- [architecture-overview.md](architecture-overview.md) - Four-layer architecture
- [validation-patterns.md](validation-patterns.md) - Entity validation
