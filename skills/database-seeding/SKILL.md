---
skill_name: database-seeding
applies_to_local_project_only: false
auto_trigger_regex: [seed, seeder, database seed, create seed, test data, fixture data, seed users, seed database, populate database]
tags: [database, seeding, testing, nestjs, typeorm, fixtures, test-data]
related_skills: [backend-dev-guidelines, e2e-testing]
---

# Database Seeding for NestJS

Comprehensive guide for creating database seed files in NestJS/TypeORM projects.

---

## Purpose

Create idempotent, well-structured seed files that populate your database with:
- **System data**: Admin users, default categories, configuration
- **Test data**: Sample users, orders, and related entities for development/testing
- **E2E test fixtures**: Predictable data for automated testing

---

## When to Use This Skill

Automatically activates when you mention:
- Creating seed files or seeders
- Populating database with test data
- Setting up fixture data
- Creating default/system data
- Database initialization

---

## Quick Start Workflow

### Step 1: Analyze Project Structure

```bash
# Find all entities
find backend/src -name "*.entity.ts" -type f

# Find all enums
find backend/src -name "*.enum.ts" -type f

# Check for existing seeds
ls backend/src/database/seeders/ 2>/dev/null || echo "No seeders yet"
```

### Step 2: Identify Entity Dependencies

Map relationships to determine seed order:

```
Independent (seed first):
├── User
├── Category (system categories)

Dependent (seed after parents):
├── Order (depends on User, Category)
├── OrderItem (depends on Order, Item)
├── Review (depends on User)
├── ReviewComment (depends on Review)
├── SupportTicket (depends on User)
├── TicketMessage (depends on SupportTicket)
```

### Step 3: Create Seed Infrastructure

**Directory Structure:**
```
backend/src/database/seeders/
├── index.ts              # Main runner
├── user.seed.ts          # User seeder
├── category.seed.ts      # Category seeder
├── order.seed.ts        # Order seeder
├── order.seed.ts        # Order seeder
├── review.seed.ts          # Review + contributions seeder
└── support.seed.ts       # Support ticket seeder
```

### Step 4: Add npm Scripts

```json
{
  "scripts": {
    "seed": "ts-node -r tsconfig-paths/register src/database/seeders/index.ts",
    "seed:reset": "ts-node -r tsconfig-paths/register src/database/seeders/reset.ts"
  }
}
```

---

## Seed File Patterns

### Main Runner (index.ts)

```typescript
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { UtilsService } from '@infrastructure/utils/utils.service';

// Import seeders
import { seedUsers } from './user.seed';
import { seedCategories } from './category.seed';
import { seedOrders } from './order.seed';
import { seedOrders } from './order.seed';
import { seedReviews } from './review.seed';

async function runSeeder() {
  console.log('Starting database seeding...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  const utilsService = app.get(UtilsService);

  try {
    // Seed in dependency order
    const users = await seedUsers(dataSource, utilsService);
    const categories = await seedCategories(dataSource);
    await seedOrders(dataSource, users, categories);
    await seedOrders(dataSource, users, categories);
    await seedReviews(dataSource, users);

    console.log('\n=== Seeding Complete ===');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

runSeeder();
```

### Entity Seeder Pattern

```typescript
// user.seed.ts
import { DataSource } from 'typeorm';
import { User } from 'src/modules/users/user.entity';
import { RolesEnum, ActiveStatusEnum } from '@shared/enums';
import { UtilsService } from '@infrastructure/utils/utils.service';

export interface SeededUsers {
  admin: User;
  testUser: User;
}

export async function seedUsers(
  dataSource: DataSource,
  utilsService: UtilsService,
): Promise<SeededUsers> {
  const repo = dataSource.getRepository(User);

  // Idempotency check
  const existing = await repo.findOne({ where: { email: 'admin@example.com' } });
  if (existing) {
    console.log('Users already seeded, fetching existing...');
    const testUser = await repo.findOne({ where: { email: 'user@example.com' } });
    return { admin: existing, testUser: testUser! };
  }

  console.log('Seeding users...');

  // Admin user
  const admin = repo.create({
    email: 'admin@example.com',
    password: await utilsService.getHash('Admin123!'),
    displayName: 'Admin User',
    role: RolesEnum.ADMIN,
    status: ActiveStatusEnum.ACTIVE,
    emailVerified: true,
  });
  await repo.save(admin);
  console.log('  - Admin: admin@example.com / Admin123!');

  // Test user (for E2E tests)
  const testUser = repo.create({
    email: 'user@example.com',
    password: await utilsService.getHash('Password123!'),
    displayName: 'Test User',
    role: RolesEnum.USER,
    status: ActiveStatusEnum.ACTIVE,
    emailVerified: true,
  });
  await repo.save(testUser);
  console.log('  - Test User: user@example.com / Password123!');

  return { admin, testUser };
}
```

### Category Seeder (System Data)

```typescript
// category.seed.ts
import { DataSource } from 'typeorm';
import { Category } from 'src/modules/categories/category.entity';
import { CategoryTypeEnum, ActiveStatusEnum } from '@shared/enums';

const SYSTEM_CATEGORIES = [
  { name: 'Electronics', icon: 'cpu' },
  { name: 'Clothing', icon: 'shirt' },
  { name: 'Books', icon: 'book' },
  { name: 'Home & Garden', icon: 'home' },
  { name: 'Sports', icon: 'activity' },
  { name: 'Featured', icon: 'star' },
  { name: 'Premium', icon: 'award' },
  { name: 'General', icon: 'grid' },
];

export async function seedCategories(dataSource: DataSource): Promise<Category[]> {
  const repo = dataSource.getRepository(Category);

  // Check if system categories exist
  const existing = await repo.find({ where: { type: CategoryTypeEnum.SYSTEM } });
  if (existing.length > 0) {
    console.log(`System categories already exist (${existing.length})`);
    return existing;
  }

  console.log('Seeding system categories...');

  const categories: Category[] = [];
  for (const cat of SYSTEM_CATEGORIES) {
    const category = repo.create({
      name: cat.name,
      icon: cat.icon,
      type: CategoryTypeEnum.SYSTEM,
      status: ActiveStatusEnum.ACTIVE,
      userId: null, // System categories have no owner
    });
    await repo.save(category);
    categories.push(category);
    console.log(`  - ${cat.name}`);
  }

  return categories;
}
```

### Order Seeder (Test Data)

```typescript
// order.seed.ts
import { DataSource } from 'typeorm';
import { Order } from 'src/modules/orders/order.entity';
import { OrderStatusEnum } from '@shared/enums';
import { User } from 'src/modules/users/user.entity';
import { Item } from 'src/modules/items/item.entity';
import { SeededUsers } from './user.seed';

export async function seedOrders(
  dataSource: DataSource,
  users: SeededUsers,
  items: Item[],
): Promise<void> {
  const repo = dataSource.getRepository(Order);

  // Check existing
  const count = await repo.count({ where: { userId: users.testUser.id } });
  if (count > 0) {
    console.log(`Orders already exist for test user (${count})`);
    return;
  }

  console.log('Seeding orders...');

  const orders: Partial<Order>[] = [];
  const statuses = Object.values(OrderStatusEnum);

  for (let i = 0; i < 10; i++) {
    const item = items[Math.floor(Math.random() * items.length)];
    orders.push({
      userId: users.testUser.id,
      itemId: item.id,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      quantity: Math.floor(Math.random() * 5) + 1,
      totalAmount: Math.round((Math.random() * 200 + 10) * 100) / 100,
      createdAt: new Date(Date.now() - i * 86400000),
    });
  }

  await repo.save(orders.map(o => repo.create(o)));
  console.log(`  - Created ${orders.length} orders`);
}
```

---

## Key Principles

### 1. Idempotency

Always check before inserting:

```typescript
// Good - check by unique field
const existing = await repo.findOne({ where: { email: 'admin@example.com' } });
if (existing) return existing;

// Also good - check count for bulk data
const count = await repo.count({ where: { userId: user.id } });
if (count > 0) return;
```

### 2. Dependency Order

Seed entities in order of foreign key dependencies:

```
1. Users (no FK dependencies)
2. Categories (optional user FK, system categories have null)
3. NotificationSettings (depends on User)
4. Orders (depends on User, Category)
5. OrderItems (depends on Order, Item)
6. Reviews (depends on User)
7. ReviewComments (depends on Review)
8. SupportTickets (depends on User)
9. TicketMessages (depends on SupportTicket)
```

### 3. Return Created Entities

Return seeded entities for use in dependent seeders:

```typescript
// Returns entities for dependent seeders
const users = await seedUsers(dataSource, utilsService);
const categories = await seedCategories(dataSource);

// Use returned entities
await seedOrders(dataSource, users, categories);
```

### 4. Password Hashing

Never store plain text passwords:

```typescript
// Get hash utility from NestJS DI
const utilsService = app.get(UtilsService);
const hashedPassword = await utilsService.getHash('password123');
```

### 5. Realistic Test Data

Generate realistic but safe test data:

```typescript
// Email format that won't accidentally send emails
email: 'user@example.com'  // or use @example.com

// Realistic amounts
amount: Math.round((Math.random() * 100 + 10) * 100) / 100

// Date ranges (last 30 days)
const date = new Date();
date.setDate(date.getDate() - i);
```

---

## Running Seeds

```bash
# Run all seeds
npm run seed

# Run specific seeder (if configured)
npm run seed:users
npm run seed:categories

# Reset and reseed (CAUTION: deletes data)
npm run seed:reset
```

---

## Common Issues

### Foreign Key Violations

**Cause**: Seeding in wrong order

**Fix**: Check entity relationships and seed parents first

### Duplicate Key Errors

**Cause**: Running seed twice without idempotency check

**Fix**: Add existence check at start of each seeder

### Password Not Working

**Cause**: Plain text password stored instead of hash

**Fix**: Use `utilsService.getHash()` or bcrypt directly

---

## Reference Files

- [Seed Patterns](resources/seed-patterns.md) - Comprehensive patterns for different entity types
- [Entity Analysis](resources/entity-analysis.md) - How to analyze entities for seeding
- [Test Data Generators](resources/test-data-generators.md) - Realistic data generation patterns

---

---

## MANDATORY: _fixtures.yaml Convention

Seed scripts MUST read credentials from `.claude-project/user_stories/_fixtures.yaml` — NOT hardcode email/password.

```yaml
# .claude-project/user_stories/_fixtures.yaml
users:
  admin:
    email: admin@example.com
    password: Admin123!
    role: admin
  user:
    email: user@example.com
    password: User123!
    role: user
```

Seed script reads this file:

```typescript
import * as fs from 'fs';
import * as yaml from 'js-yaml';

const fixtures = yaml.load(fs.readFileSync('.claude-project/user_stories/_fixtures.yaml', 'utf8'));

for (const [key, user] of Object.entries(fixtures.users)) {
  await userRepository.upsert({
    email: user.email,
    password: await bcrypt.hash(user.password, 12),
    role: user.role,
  }, ['email']);
}
```

**Rules:**
- Hardcoding email/password in seed script is PROHIBITED
- Must parse `_fixtures.yaml` as single source of truth
- Idempotency required: `upsert` or `findOne → skip if exists`
- Register in `package.json`: `"prisma": { "seed": "ts-node prisma/seed.ts" }`

## Related Skills

- [backend-dev-guidelines](../agents/backend-developer.md) - NestJS development patterns
- [e2e-testing](e2e-testing/SKILL.md) - E2E testing that uses seeded data

---

**Skill Status**: Production Ready
**Line Count**: < 500
