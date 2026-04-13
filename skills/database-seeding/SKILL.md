---
skill_name: database-seeding
applies_to_local_project_only: false
auto_trigger_regex:
  [
    seed,
    seeder,
    database seed,
    create seed,
    test data,
    fixture data,
    seed users,
    seed database,
    populate database,
  ]
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
```

### Step 3: Create Seed Infrastructure

**Directory Structure:**

```
backend/src/database/seeders/
├── index.ts                  # Main orchestrator (bootstraps app, runs seeders in order)
├── user.seed.ts              # User seeder
├── {domain}.seed.ts          # One seed file per domain entity
```

**Rule**: One file per domain. Never combine multiple domains in one file.

### Step 4: Add npm Scripts

```json
{
  "scripts": {
    "seed": "ts-node -r tsconfig-paths/register src/database/seeders/index.ts"
  }
}
```

---

## Seed File Patterns

### Main Orchestrator (index.ts)

The orchestrator bootstraps the NestJS app, extracts services from DI, and calls each domain seeder in dependency order.

```typescript
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { AppModule } from "../../app.module";
import { DataSource } from "typeorm";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

// Import domain seeders
import { seedUsers } from "./user.seed";
import { seedCategories } from "./category.seed";
import { seedOrders } from "./order.seed";

const logger = new Logger("Seeder");

// --- Fixture Interfaces (exported for domain seeders) ---
// Define interfaces matching _fixtures.yaml structure per project.
// Example:
// export interface FixtureUser { email: string; password: string; name: string; role: string; }
// export interface Fixtures { users: FixtureUser[]; orders: FixtureOrder[]; ... }

function loadFixtures() {
  const fixturesPath = path.resolve(
    __dirname,
    "../../../../.claude-project/user_stories/_fixtures.yaml",
  );
  const content = fs.readFileSync(fixturesPath, "utf8");
  return yaml.load(content);
}

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    const fixtures = loadFixtures();
    logger.log("Fixtures loaded successfully");

    // Seed in dependency order (parents before children)
    await seedUsers(dataSource, fixtures);
    await seedCategories(dataSource, fixtures);
    await seedOrders(dataSource, fixtures);

    logger.log("Seeding completed successfully!");
  } catch (error) {
    logger.error("Seeding failed:", error);
    throw error;
  } finally {
    await app.close();
  }
}

seed();
```

**Key points:**

- Uses `NestFactory.createApplicationContext(AppModule)` (no HTTP listener needed for seeding)
- Loads `_fixtures.yaml` once and passes parsed fixtures to each seeder
- Each seeder receives `(dataSource, fixtures)` — no duplicate file reads
- Uses NestJS `Logger` (not `console.log`)
- Calls seeders sequentially in dependency order
- Wraps in try/catch/finally, closes app in `finally`
- Exports fixture interfaces so domain seeders can import them

### Entity Seeder Pattern (User — with \_fixtures.yaml)

Each domain gets its own seed file. **All seed data MUST come from `_fixtures.yaml`** — never hardcode credentials inline.

```typescript
// user.seed.ts
import { Logger } from "@nestjs/common";
import { DataSource } from "typeorm";
import * as bcrypt from "bcryptjs";

import type { Fixtures } from "./index";

const logger = new Logger("UserSeeder");

export async function seedUsers(
  dataSource: DataSource,
  fixtures: Fixtures,
): Promise<void> {
  const userRepo = dataSource.getRepository("User");

  for (const u of fixtures.users) {
    const existing = await userRepo.findOne({ where: { email: u.email } });
    if (existing) {
      logger.log(`User ${u.email} already exists, skipping`);
      continue;
    }

    const hashedPassword = await bcrypt.hash(u.password, 10);
    await userRepo.save({
      name: u.name,
      email: u.email,
      password: hashedPassword,
      role: u.role,
      emailVerified: true,
      status: "active",
    });
    logger.log(`Created user: ${u.email} (${u.role})`);
  }
}
```

### Dependent Entity Seeder Pattern (with \_fixtures.yaml)

Seeders that depend on parent entities load from `_fixtures.yaml` and look up parents by unique field:

```typescript
// order.seed.ts
import { Logger } from "@nestjs/common";
import { DataSource } from "typeorm";

import type { Fixtures } from "./index";

const logger = new Logger("OrderSeeder");

export async function seedOrders(
  dataSource: DataSource,
  fixtures: Fixtures,
): Promise<void> {
  const orderRepo = dataSource.getRepository("Order");
  const userRepo = dataSource.getRepository("User");

  for (const o of fixtures.orders ?? []) {
    const existing = await orderRepo.findOne({ where: { title: o.title } });
    if (existing) {
      logger.log(`Order "${o.title}" already exists, skipping`);
      continue;
    }

    // Look up parent entity by unique field
    const owner = await userRepo.findOne({ where: { email: o.owner } });
    if (!owner) {
      logger.warn(`Owner not found for order "${o.title}", skipping`);
      continue;
    }

    await orderRepo.save({
      userId: owner.id,
      title: o.title,
      status: o.status,
      amount: o.amount,
    });
    logger.log(`Created order: ${o.title}`);
  }
}
```

---

## Key Principles

### 1. One File Per Domain

Each entity domain gets its own `{domain}.seed.ts` file:

```
backend/src/database/seeders/
├── index.ts                # Orchestrator only — no seed logic here
├── user.seed.ts            # Users
├── category.seed.ts        # Categories
├── order.seed.ts           # Orders
└── ...
```

### 2. Idempotency via findOne Check

Each seeder checks if a record exists before inserting:

```typescript
const existing = await repo.findOne({ where: { email: u.email } });
if (existing) {
  logger.log(`Record already exists, skipping`);
  continue;
}
```

### 3. Dependency Order

Seed entities in order of foreign key dependencies. The orchestrator calls seeders sequentially:

```
Level 0 (No dependencies):  User, Category
Level 1 (Depends on L0):    Order, NotificationSettings
Level 2 (Depends on L0-1):  OrderItem, Review
Level 3 (Depends on L0-2):  ReviewComment, TicketMessage
```

### 4. Cross-Entity Lookups

Dependent seeders find parent entities by unique fields:

```typescript
const owner = await userRepo.findOne({ where: { email: "admin@example.com" } });
if (!owner) {
  logger.warn("Admin user not found. Run user seeder first. Skipping.");
  return;
}
```

### 5. NestJS App Context

Use `NestFactory.createApplicationContext(AppModule)` in the orchestrator (no HTTP listener needed):

```typescript
const app = await NestFactory.createApplicationContext(AppModule);
const dataSource = app.get(DataSource);
```

### 6. Logger from @nestjs/common

Use NestJS Logger (not `console.log`) in each seeder:

```typescript
import { Logger } from "@nestjs/common";
const logger = new Logger("UserSeed");

logger.log("Creating users...");
logger.warn("Owner not found, skipping");
```

### 7. Password Hashing

Never store plain text passwords:

```typescript
// Option A: If project has UtilsService
const hashedPassword = await utilsService.getHash(seed.password);

// Option B: Use bcrypt directly
import * as bcrypt from "bcrypt";
const hashedPassword = await bcrypt.hash(seed.password, 10);
```

---

## Running Seeds

```bash
# Run all seeds
npm run seed
```

---

## Common Issues

### Foreign Key Violations

**Cause**: Seeding in wrong order

**Fix**: Check entity relationships and seed parents first

### Duplicate Key Errors

**Cause**: Running seed twice without idempotency check

**Fix**: Add `findOne` check before each insert

### Password Not Working

**Cause**: Plain text password stored instead of hash

**Fix**: Use `utilsService.getHash()` or `bcrypt.hash()`

---

## Reference Files

- [Seed Patterns](resources/seed-patterns.md) - Comprehensive patterns for different entity types
- [Entity Analysis](resources/entity-analysis.md) - How to analyze entities for seeding
- [Test Data Generators](resources/test-data-generators.md) - Realistic data generation patterns

---

## MANDATORY: \_fixtures.yaml Convention

Seed scripts MUST read credentials from `.claude-project/user_stories/_fixtures.yaml` — NOT hardcode email/password.

```yaml
# .claude-project/user_stories/_fixtures.yaml
users:
  - name: "Admin User"
    email: "admin@example.com"
    password: "Admin123!"
    role: admin
    status: active

  - name: "Test User"
    email: "user@example.com"
    password: "Password123!"
    role: user
    status: active
```

The orchestrator (`index.ts`) loads this file once and passes parsed fixtures to each domain seeder. See the orchestrator and seeder patterns above.

**Rules:**

- Hardcoding email/password in seed script is PROHIBITED
- Must parse `_fixtures.yaml` as single source of truth
- Fixtures loaded once in `index.ts`, passed to each seeder via `(dataSource, fixtures)` signature
- Idempotency required: `findOne` check before each insert
- Register in `package.json`: `"seed"` script pointing to `src/database/seeders/index.ts`

## Related Skills

- [backend-dev-guidelines](../agents/backend-developer.md) - NestJS development patterns
- [e2e-testing](e2e-testing/SKILL.md) - E2E testing that uses seeded data

---

**Skill Status**: Production Ready
