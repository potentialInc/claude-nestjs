# Entity Analysis Guide

How to analyze a NestJS/TypeORM project to understand entity structure and plan seeding strategy.

---

## Table of Contents

1. [Finding Entities](#finding-entities)
2. [Understanding Entity Structure](#understanding-entity-structure)
3. [Mapping Relationships](#mapping-relationships)
4. [Identifying Enums](#identifying-enums)
5. [Determining Seed Order](#determining-seed-order)
6. [Analysis Checklist](#analysis-checklist)

---

## Finding Entities

### Command Line Search

```bash
# Find all entity files
find backend/src -name "*.entity.ts" -type f

# List entity names
find backend/src -name "*.entity.ts" -exec basename {} \; | sort

# Find entities with their paths
find backend/src -name "*.entity.ts" -type f | while read f; do
  echo "$(basename $f .entity.ts): $f"
done
```

### Common Locations

```
backend/src/
├── modules/
│   ├── users/user.entity.ts
│   ├── categories/category.entity.ts
│   ├── order-items/order-item.entity.ts
│   ├── orders/order.entity.ts
│   ├── reviews/
│   │   ├── review.entity.ts
│   │   └── review-comment.entity.ts
│   ├── support/
│   │   ├── support-ticket.entity.ts
│   │   └── ticket-message.entity.ts
│   └── notifications/user-notification-settings.entity.ts
└── core/
    └── base/base.entity.ts
```

---

## Understanding Entity Structure

### Key Decorators to Look For

```typescript
// Entity table name
@Entity('users')

// Column types
@Column({ unique: true })
@Column({ nullable: true })
@Column({ type: 'enum', enum: StatusEnum, default: StatusEnum.ACTIVE })
@Column({ type: 'decimal', precision: 12, scale: 2 })
@Column({ type: 'jsonb', default: () => "'[]'" })

// Relationships
@ManyToOne(() => User, { onDelete: 'CASCADE' })
@OneToMany(() => OrderItem, (t) => t.user)
@OneToOne(() => Settings, { cascade: true })
@ManyToMany(() => Role)
@JoinColumn({ name: 'user_id' })

// Indexes
@Index(['email'])
@Index(['userId', 'date'])
@Unique(['userId', 'categoryId', 'period'])
```

### Entity Analysis Template

For each entity, document:

```markdown
### Entity: User

**Table**: `users`
**Base**: Extends BaseEntity (has id, createdAt, updatedAt, deletedAt)

**Fields**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| email | string | no | - | unique, indexed |
| password | string | yes | - | hashed |
| displayName | string | no | - | |
| role | RolesEnum | no | USER | |
| status | ActiveStatusEnum | no | ACTIVE | |
| avatarUrl | string | yes | - | |

**Relationships**:
- OneToMany → Order (user.orders)
- OneToMany → Review (user.reviews)
- OneToOne → UserProfile

**Constraints**:
- Unique: email
- Index: [email]
```

---

## Mapping Relationships

### Relationship Types

```typescript
// One-to-Many: User has many OrderItems
// User entity
@OneToMany(() => OrderItem, (t) => t.user)
orderItems: OrderItem[];

// OrderItem entity
@ManyToOne(() => User, { onDelete: 'CASCADE' })
@JoinColumn({ name: 'user_id' })
user: User;

@Column({ name: 'user_id' })
userId: string;
```

### Dependency Graph

Build a dependency graph showing which entities depend on others:

```
Level 0 (No dependencies):
├── User
├── Category (system categories)

Level 1 (Depends on Level 0):
├── Category (custom, depends on User)
├── UserNotificationSettings (depends on User)

Level 2 (Depends on Levels 0-1):
├── Order (depends on User, Category)
├── OrderItem (depends on User, Category)
├── Review (depends on User)
├── SupportTicket (depends on User)

Level 3 (Depends on Levels 0-2):
├── ReviewComment (depends on Review)
├── TicketMessage (depends on SupportTicket)
```

### Cascade Behaviors

Document cascade delete behaviors:

```markdown
| Parent | Child | On Delete |
|--------|-------|-----------|
| User | OrderItem | CASCADE |
| User | Order | CASCADE |
| User | Review | CASCADE |
| User | SupportTicket | CASCADE |
| Category | OrderItem | SET NULL |
| Category | Order | CASCADE |
| Review | ReviewComment | CASCADE |
| SupportTicket | TicketMessage | CASCADE |
```

---

## Identifying Enums

### Finding Enum Files

```bash
# Find all enum files
find backend/src -name "*.enum.ts" -type f

# Common location
ls backend/src/shared/enums/
```

### Enum Documentation Template

```markdown
### ActiveStatusEnum
**Values**: ACTIVE=1, IN_ACTIVE=2, BLOCK=3
**Used by**: User.status, Category.status
**Type**: Numeric

### CategoryTypeEnum
**Values**: GENERAL, FEATURED, ARCHIVED
**Used by**: Category.type
**Type**: String

### OrderStatusEnum
**Values**: PENDING, CONFIRMED, SHIPPED, DELIVERED, CANCELLED
**Used by**: Order.status
**Type**: String

### CategoryTypeEnum
**Values**: SYSTEM, CUSTOM
**Used by**: Category.type
**Type**: String

### OrderPeriodEnum
**Values**: WEEKLY, MONTHLY
**Used by**: Order.period
**Type**: String
```

### Enum Value Mapping

```typescript
// Import and document all enums
import {
  ActiveStatusEnum,    // 1, 2, 3
  RolesEnum,           // 1, 2, 3
  CategoryTypeEnum,        // 'USD', 'KRW', etc.
  OrderItemTypeEnum, // 'CONFIRMED', 'PENDING'
  CategoryTypeEnum,    // 'SYSTEM', 'CUSTOM'
  OrderPeriodEnum,    // 'WEEKLY', 'MONTHLY'
} from '@shared/enums';
```

---

## Determining Seed Order

### Algorithm

1. Find all entities with no foreign keys → Level 0
2. Find entities depending only on Level 0 → Level 1
3. Continue until all entities are assigned
4. Seed from Level 0 upward

### Example Seed Order

```typescript
// seed-order.ts
export const SEED_ORDER = [
  // Level 0: No FK dependencies
  'User',

  // Level 1: Depends on User (optional FK for system data)
  'Category',  // System categories have null userId
  'UserNotificationSettings',

  // Level 2: Depends on User + Category
  'Order',
  'OrderItem',
  'Review',
  'SupportTicket',

  // Level 3: Depends on Level 2
  'ReviewComment',
  'TicketMessage',
];
```

### Handling Circular Dependencies

If entities have circular references, use a two-pass approach:

```typescript
// Pass 1: Create entities without relationships
const user = await userRepo.save(userRepo.create({
  email: 'admin@example.com',
  // Don't set managerId yet
}));

// Pass 2: Update relationships
await userRepo.update(user.id, { managerId: anotherUser.id });
```

---

## Analysis Checklist

### For Each Entity

- [ ] Table name identified
- [ ] All columns documented
- [ ] Nullable fields identified
- [ ] Default values noted
- [ ] Enums and their values listed
- [ ] Unique constraints documented
- [ ] Indexes noted
- [ ] Foreign keys mapped
- [ ] Cascade behaviors documented
- [ ] Soft delete check (deletedAt column)

### For the Project

- [ ] All entities discovered
- [ ] Dependency graph created
- [ ] Seed order determined
- [ ] All enums documented
- [ ] Existing seed files checked
- [ ] Password hashing utility located
- [ ] Base entity fields understood

### Analysis Output Template

```markdown
# Database Seed Analysis: [Project Name]

## Entities Found: X

### Dependency Levels

**Level 0** (seed first):
- User
- Category (system)

**Level 1**:
- Category (custom)
- UserNotificationSettings

**Level 2**:
- Order
- OrderItem
- Review
- SupportTicket

**Level 3** (seed last):
- ReviewComment
- TicketMessage

## Enums

| Enum | Type | Values |
|------|------|--------|
| ActiveStatusEnum | numeric | 1, 2, 3 |
| CategoryTypeEnum | string | USD, KRW, EUR, GBP, JPY |

## Seed Data Recommendations

### System Data
- 1 Admin user
- 10 System categories

### Test Data (per user)
- 1 Test user with verified email
- 30 days of orders (50-100 records)
- 3 orders (different statuses)
- 2 reviews with comments
- 1 support ticket with messages

## Special Considerations

- User.password must be hashed
- Category.userId is null for system categories
- OrderItem amounts should be decimal(12,2)
```

---

**Related**: [Seed Patterns](seed-patterns.md) | [Test Data Generators](test-data-generators.md)
