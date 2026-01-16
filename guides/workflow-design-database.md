# Database Design Guidelines

Step-by-step guide for designing databases in NestJS applications using TypeORM and PostgreSQL.

---

## Iteration Behavior

This skill is iteration-aware. Behavior changes based on iteration context:

### Iteration 1 (Initial)
- Full schema design from PRD requirements
- Create all entities and relationships
- Generate initial migration: `001-initial-schema`

### Iteration N (Improvement)
When called with iteration context (e.g., from `/fullstack project --iterate database`):

1. **Read previous state**: Load `PROJECT_DATABASE.md` for current schema
2. **Compare with new requirements**: Identify new entities, modified fields, new relationships
3. **Generate incremental migration**: Name as `{iteration}-{description}` (e.g., `002-add-analytics`)
4. **Preserve backward compatibility**: Add columns as nullable or with defaults
5. **Update documentation**: Mark changes with iteration number in PROJECT_DATABASE.md

---

## Table of Contents

- [Step 1: Analyze Requirements](#step-1-analyze-requirements)
- [Step 2: Identify Entities](#step-2-identify-entities)
- [Step 3: Define Relationships](#step-3-define-relationships)
- [Step 4: Design Entity Attributes](#step-4-design-entity-attributes)
- [Step 5: Plan Indexes](#step-5-plan-indexes)
- [Step 6: Create Enums and Types](#step-6-create-enums-and-types)
- [Step 7: Implement Entities](#step-7-implement-entities)
- [Step 8: Write Migrations](#step-8-write-migrations)
- [Step 9: Validate Design](#step-9-validate-design)

---

## Step 1: Analyze Requirements

Before writing any code, thoroughly analyze the requirements document.

### 1.1 Read the PRD/Requirements

- Read `.claude-project/docs/PROJECT_KNOWLEDGE.md` for project context
- Identify all user types and their roles
- List all features for each user type
- Note business rules and constraints

### 1.2 Extract Data Requirements

Ask these questions:

| Question                                | Purpose                    |
| --------------------------------------- | -------------------------- |
| What data needs to be stored?           | Identify entities          |
| Who creates/owns the data?              | Define ownership relations |
| How is data accessed?                   | Plan indexes               |
| What constraints exist?                 | Define validation rules    |
| What are the cardinality relationships? | Design relationships       |

### 1.3 Create Entity List

From requirements, extract nouns that represent storable data:

```markdown
Example from PRD:

- "Users can submit **daily surveys**" → DailySurvey entity
- "Coaches schedule **Zoom meetings**" → ZoomMeeting entity
- "Patients complete **exercises**" → Exercise, ExerciseLog entities
```

---

## Step 2: Identify Entities

### 2.1 Core Entity Types

Classify entities into categories:

| Category        | Description                | Examples                |
| --------------- | -------------------------- | ----------------------- |
| **User**        | People using the system    | User, Profile           |
| **Content**     | Main business objects      | Product, Post, Exercise |
| **Junction**    | Many-to-many relationships | UserRole, OrderItem     |
| **Log/History** | Track changes over time    | AuditLog, ExerciseLog   |
| **Config**      | System configuration       | Settings, Preferences   |

### 2.2 Entity Naming Conventions

```typescript
// Entity class: PascalCase, singular
export class User extends BaseEntity {}
export class DailySurvey extends BaseEntity {}

// Table name: snake_case, plural
@Entity('users')
@Entity('daily_surveys')

// File name: kebab-case with .entity.ts suffix
// user.entity.ts
// daily-survey.entity.ts
```

### 2.3 Module Organization

```
src/modules/
├── users/
│   └── entities/
│       ├── user.entity.ts
│       └── index.ts
├── exercises/
│   └── entities/
│       ├── exercise.entity.ts
│       ├── exercise-log.entity.ts
│       └── index.ts
```

---

## Step 3: Define Relationships

### 3.1 Relationship Types

| Relationship | When to Use                                | Example         |
| ------------ | ------------------------------------------ | --------------- |
| One-to-One   | One record exclusively belongs to another  | User ↔ Profile |
| One-to-Many  | One parent has multiple children           | User → Posts    |
| Many-to-Many | Multiple records relate to multiple others | Users ↔ Roles  |

### 3.2 Draw Entity Relationship Diagram

Use this template:

```
┌──────────────┐     ┌──────────────┐
│   Entity A   │     │   Entity B   │
│──────────────│     │──────────────│
│ id (PK)      │     │ id (PK)      │
│ ...          │────▶│ entityAId(FK)│
└──────────────┘  1:N└──────────────┘
```

### 3.3 Determine Relationship Direction

Ask: "Which side owns the relationship?"

```typescript
// Parent owns children (One-to-Many)
@Entity('users')
export class User {
    @OneToMany(() => Post, (post) => post.author)
    posts: Post[];
}

// Child references parent (Many-to-One)
@Entity('posts')
export class Post {
    @Column()
    authorId: string; // Always include the FK column

    @ManyToOne(() => User, (user) => user.posts)
    @JoinColumn({ name: 'authorId' })
    author: User;
}
```

### 3.4 Handle Many-to-Many

Option A: Use junction table for simple relations

```typescript
@ManyToMany(() => Role)
@JoinTable({ name: 'user_roles' })
roles: Role[];
```

Option B: Create explicit entity for complex relations

```typescript
// When junction needs additional attributes
@Entity('order_items')
export class OrderItem {
    @Column()
    orderId: string;

    @Column()
    productId: string;

    @Column()
    quantity: number; // Additional attribute

    @Column()
    price: number; // Additional attribute
}
```

---

## Step 4: Design Entity Attributes

### 4.1 Column Type Selection

| Data Type      | PostgreSQL Type | TypeORM Declaration                                     |
| -------------- | --------------- | ------------------------------------------------------- |
| String (short) | varchar         | `@Column({ length: 255 })`                              |
| String (long)  | text            | `@Column({ type: 'text' })`                             |
| Integer        | int             | `@Column({ type: 'int' })`                              |
| Decimal        | decimal         | `@Column({ type: 'decimal', precision: 10, scale: 2 })` |
| Boolean        | boolean         | `@Column({ type: 'boolean', default: false })`          |
| Date only      | date            | `@Column({ type: 'date' })`                             |
| Date + Time    | timestamp       | `@Column({ type: 'timestamp' })`                        |
| Time only      | time            | `@Column({ type: 'time' })`                             |
| JSON           | jsonb           | `@Column({ type: 'jsonb' })`                            |
| Enum           | enum            | `@Column({ type: 'enum', enum: MyEnum })`               |

### 4.2 Nullable vs Required

```typescript
// Required field (NOT NULL)
@Column()
email: string;

// Optional field (NULL allowed)
@Column({ nullable: true })
middleName: string | null;

// With default value
@Column({ default: true })
isActive: boolean;
```

### 4.3 Column Naming

```typescript
// Use camelCase in TypeScript, snake_case in DB
@Column({ name: 'phone_number' })
phoneNumber: string;

@Column({ name: 'created_at' })
createdAt: Date;
```

---

## Step 5: Plan Indexes

### 5.1 When to Add Indexes

| Scenario                          | Index Type      |
| --------------------------------- | --------------- |
| Primary lookup field              | Unique index    |
| Foreign key columns               | Regular index   |
| Frequently filtered columns       | Regular index   |
| Columns used in ORDER BY          | Regular index   |
| Multiple columns queried together | Composite index |

### 5.2 Index Implementation

```typescript
@Entity('users')
@Index(['email'], { unique: true }) // Unique index
@Index(['role', 'isActive']) // Composite index
export class User extends BaseEntity {
    @Column()
    @Index() // Single column index
    email: string;
}
```

### 5.3 Index Naming Convention

```typescript
// TypeORM auto-generates names, or specify manually:
@Index('IDX_USER_EMAIL', ['email'])
@Index('IDX_USER_ROLE_STATUS', ['role', 'isActive'])
```

---

## Step 6: Create Enums and Types

### 6.1 Identify Enumerable Values

Look for fields with fixed set of values:

```markdown
From PRD:

- "Status: Scheduled / Completed / Cancelled" → MeetingStatusEnum
- "Role: PATIENT / COACH" → UserRoleEnum
- "Muscle pain: None / Mild / Moderate / Severe" → MusclePainEnum
```

### 6.2 Enum File Structure

```
src/shared/enums/
├── index.ts
├── user-role.enum.ts
├── meeting-status.enum.ts
└── muscle-pain.enum.ts
```

### 6.3 Enum Implementation

```typescript
// src/shared/enums/meeting-status.enum.ts
export enum MeetingStatusEnum {
    SCHEDULED = 'SCHEDULED',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
}

// Usage in entity
@Column({
    type: 'enum',
    enum: MeetingStatusEnum,
    default: MeetingStatusEnum.SCHEDULED,
})
status: MeetingStatusEnum;
```

---

## Step 7: Implement Entities

### 7.1 Entity Template

```typescript
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from 'src/core/base';

@Entity('table_name')
@Index(['frequently_queried_field'])
export class EntityName extends BaseEntity {
    // Foreign key columns first
    @Column({ name: 'parent_id' })
    parentId: string;

    // Required fields
    @Column({ length: 255 })
    title: string;

    // Optional fields
    @Column({ type: 'text', nullable: true })
    description: string | null;

    // Enum fields
    @Column({
        type: 'enum',
        enum: StatusEnum,
        default: StatusEnum.ACTIVE,
    })
    status: StatusEnum;

    // Relations
    @ManyToOne(() => Parent)
    @JoinColumn({ name: 'parent_id' })
    parent: Parent;
}
```

### 7.2 Checklist Before Implementation

- [ ] Entity extends BaseEntity
- [ ] Table name is plural and snake_case
- [ ] All FK columns are explicitly declared
- [ ] Indexes added for query performance
- [ ] Nullable fields use `| null` type
- [ ] Enum values match business requirements
- [ ] Relations properly configured

---

## Step 8: Write Migrations

### 8.1 Migration Strategy

1. **Generate from entities** (for development):

    ```bash
    npm run migration:generate -- src/database/migrations/CreateTableName
    ```

2. **Create empty migration** (for manual changes):
    ```bash
    npm run migration:create -- src/database/migrations/AddIndexToTable
    ```

### 8.2 Migration Best Practices

```typescript
export class CreateUsersTable implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create enums first
        await queryRunner.query(`CREATE TYPE "user_role_enum" AS ENUM ('PATIENT', 'COACH')`);

        // 2. Create tables
        await queryRunner.createTable(new Table({ ... }), true);

        // 3. Add indexes
        await queryRunner.createIndex('users', new TableIndex({ ... }));

        // 4. Add foreign keys
        await queryRunner.createForeignKey('users', new TableForeignKey({ ... }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Reverse order: FKs → Indexes → Tables → Enums
        await queryRunner.dropForeignKey('users', 'FK_...');
        await queryRunner.dropIndex('users', 'IDX_...');
        await queryRunner.dropTable('users');
        await queryRunner.query(`DROP TYPE "user_role_enum"`);
    }
}
```

### 8.3 Run Migrations

```bash
# Run pending migrations
npm run migration:run

# Verify migration status
npm run migration:show

# Rollback if needed
npm run migration:revert
```

---

## Step 9: Validate Design

### 9.1 Design Review Checklist

| Area              | Questions to Ask                              |
| ----------------- | --------------------------------------------- |
| **Normalization** | Is data duplicated unnecessarily?             |
| **Relationships** | Are all FKs properly defined?                 |
| **Indexes**       | Are frequently queried fields indexed?        |
| **Constraints**   | Are unique constraints in place where needed? |
| **Soft Delete**   | Does entity extend BaseEntity for deletedAt?  |
| **Scalability**   | Will design handle growth?                    |

### 9.2 Query Performance Check

Before finalizing, verify common queries:

```typescript
// Test query patterns from requirements
// Example: "Get patient's exercises for today"
const exercises = await exerciseRepository
    .createQueryBuilder('exercise')
    .leftJoinAndSelect('exercise.logs', 'log', 'log.date = :date', {
        date: today,
    })
    .where('exercise.patientId = :patientId', { patientId })
    .getMany();
```

### 9.3 Document the Design

Create a `PROJECT_DATABASE.md` file in `.claude/docs/` to document your database design:

```bash
# Create the documentation file
touch .claude-project/docs/PROJECT_DATABASE.md
```

Include the following sections in `PROJECT_DATABASE.md`:

```markdown
# Project Database Design

## Entity Relationship Diagram

[Include ASCII diagram or link to visual ERD]

## Entities Overview

| Entity | Table Name | Description       | Module |
| ------ | ---------- | ----------------- | ------ |
| User   | users      | Application users | users  |
| ...    | ...        | ...               | ...    |

## Relationships

| Parent | Child | Type | Description        |
| ------ | ----- | ---- | ------------------ |
| User   | Post  | 1:N  | User creates posts |
| ...    | ...   | ...  | ...                |

## Enums

| Enum         | Values      | Used In   |
| ------------ | ----------- | --------- |
| UserRoleEnum | ADMIN, USER | User.role |
| ...          | ...         | ...       |

## Indexes

| Table | Index Name     | Columns | Type   |
| ----- | -------------- | ------- | ------ |
| users | IDX_USER_EMAIL | email   | Unique |
| ...   | ...            | ...     | ...    |

## Design Decisions

1. **Decision Title**
    - Reason: Why this approach was chosen
    - Alternative considered: What else was evaluated
```

This documentation ensures the database design is captured and can be referenced by team members and AI assistants.

---

## Quick Reference: Entity Creation Workflow

```
1. Read requirements → Extract entities
2. Draw ERD → Define relationships
3. List attributes → Choose column types
4. Identify indexes → Plan query optimization
5. Create enums → Define fixed values
6. Implement entity → Extend BaseEntity
7. Generate migration → Run and verify
8. Review design → Check performance
```

---

**Related Files:**

- [database-patterns.md](database-patterns.md) - TypeORM patterns and best practices
- [architecture-overview.md](architecture-overview.md) - Four-layer architecture
- [services-and-repositories.md](services-and-repositories.md) - Service/Repository patterns
- [validation-patterns.md](validation-patterns.md) - Entity validation
