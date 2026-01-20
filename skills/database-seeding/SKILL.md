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
- **Test data**: Sample users, transactions, and related entities for development/testing
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
├── Budget (depends on User, Category)
├── Transaction (depends on User, Category)
├── Goal (depends on User)
├── GoalContribution (depends on Goal)
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
├── budget.seed.ts        # Budget seeder
├── transaction.seed.ts   # Transaction seeder
├── goal.seed.ts          # Goal + contributions seeder
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
import { seedBudgets } from './budget.seed';
import { seedTransactions } from './transaction.seed';
import { seedGoals } from './goal.seed';

async function runSeeder() {
  console.log('Starting database seeding...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  const utilsService = app.get(UtilsService);

  try {
    // Seed in dependency order
    const users = await seedUsers(dataSource, utilsService);
    const categories = await seedCategories(dataSource);
    await seedBudgets(dataSource, users, categories);
    await seedTransactions(dataSource, users, categories);
    await seedGoals(dataSource, users);

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
import { RolesEnum, ActiveStatusEnum, CurrencyEnum } from '@shared/enums';
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
    const testUser = await repo.findOne({ where: { email: 'testuser@pennywise.app' } });
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
    currency: CurrencyEnum.USD,
  });
  await repo.save(admin);
  console.log('  - Admin: admin@example.com / Admin123!');

  // Test user (for E2E tests)
  const testUser = repo.create({
    email: 'testuser@pennywise.app',
    password: await utilsService.getHash('TestPassword123!'),
    displayName: 'Test User',
    role: RolesEnum.USER,
    status: ActiveStatusEnum.ACTIVE,
    emailVerified: true,
    currency: CurrencyEnum.USD,
    monthlyIncome: 5000,
  });
  await repo.save(testUser);
  console.log('  - Test User: testuser@pennywise.app / TestPassword123!');

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
  { name: 'Food & Dining', icon: 'utensils' },
  { name: 'Transportation', icon: 'car' },
  { name: 'Shopping', icon: 'shopping-bag' },
  { name: 'Entertainment', icon: 'film' },
  { name: 'Utilities', icon: 'bolt' },
  { name: 'Health & Fitness', icon: 'heart' },
  { name: 'Education', icon: 'book' },
  { name: 'Salary', icon: 'wallet' },
  { name: 'Investment', icon: 'trending-up' },
  { name: 'Other Income', icon: 'plus-circle' },
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

### Transaction Seeder (Test Data)

```typescript
// transaction.seed.ts
import { DataSource } from 'typeorm';
import { Transaction } from 'src/modules/transactions/transaction.entity';
import { TransactionTypeEnum } from '@shared/enums';
import { User } from 'src/modules/users/user.entity';
import { Category } from 'src/modules/categories/category.entity';
import { SeededUsers } from './user.seed';

export async function seedTransactions(
  dataSource: DataSource,
  users: SeededUsers,
  categories: Category[],
): Promise<void> {
  const repo = dataSource.getRepository(Transaction);

  // Check existing
  const count = await repo.count({ where: { userId: users.testUser.id } });
  if (count > 0) {
    console.log(`Transactions already exist for test user (${count})`);
    return;
  }

  console.log('Seeding transactions...');

  const expenseCategories = categories.filter(c =>
    ['Food & Dining', 'Transportation', 'Shopping'].includes(c.name)
  );
  const incomeCategory = categories.find(c => c.name === 'Salary')!;

  // Generate last 30 days of transactions
  const now = new Date();
  const transactions: Partial<Transaction>[] = [];

  for (let i = 0; i < 30; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    // Add 1-3 expenses per day
    const expenseCount = Math.floor(Math.random() * 3) + 1;
    for (let j = 0; j < expenseCount; j++) {
      const category = expenseCategories[Math.floor(Math.random() * expenseCategories.length)];
      transactions.push({
        userId: users.testUser.id,
        categoryId: category.id,
        type: TransactionTypeEnum.EXPENSE,
        amount: Math.round((Math.random() * 100 + 10) * 100) / 100,
        description: `${category.name} expense`,
        date: date,
      });
    }

    // Add salary on 1st and 15th
    if (date.getDate() === 1 || date.getDate() === 15) {
      transactions.push({
        userId: users.testUser.id,
        categoryId: incomeCategory.id,
        type: TransactionTypeEnum.INCOME,
        amount: 2500,
        description: 'Salary deposit',
        date: date,
      });
    }
  }

  await repo.save(transactions.map(t => repo.create(t)));
  console.log(`  - Created ${transactions.length} transactions`);
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
4. Budgets (depends on User, Category)
5. Transactions (depends on User, Category)
6. Goals (depends on User)
7. GoalContributions (depends on Goal)
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
await seedBudgets(dataSource, users, categories);
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
email: 'testuser@pennywise.app'  // or use @example.com

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

## Related Skills

- [backend-dev-guidelines](../agents/backend-developer.md) - NestJS development patterns
- [e2e-testing](e2e-testing/SKILL.md) - E2E testing that uses seeded data

---

**Skill Status**: Production Ready
**Line Count**: < 500
