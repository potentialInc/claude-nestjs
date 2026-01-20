# Seed Patterns Reference

Comprehensive patterns for seeding different entity types in NestJS/TypeORM projects.

---

## Table of Contents

1. [User Seeding Patterns](#user-seeding-patterns)
2. [Lookup Table Patterns](#lookup-table-patterns)
3. [Transactional Data Patterns](#transactional-data-patterns)
4. [Hierarchical Data Patterns](#hierarchical-data-patterns)
5. [Junction Table Patterns](#junction-table-patterns)
6. [Soft Delete Considerations](#soft-delete-considerations)

---

## User Seeding Patterns

### Admin User

```typescript
const admin = repo.create({
  email: 'admin@example.com',
  password: await utilsService.getHash('Admin123!'),
  displayName: 'System Administrator',
  role: RolesEnum.ADMIN,
  status: ActiveStatusEnum.ACTIVE,
  emailVerified: true,
});
```

### E2E Test User

```typescript
// Use predictable credentials for E2E tests
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
```

### Multiple Test Users

```typescript
const TEST_USERS = [
  { email: 'user1@test.app', name: 'User One', income: 3000 },
  { email: 'user2@test.app', name: 'User Two', income: 5000 },
  { email: 'user3@test.app', name: 'User Three', income: 8000 },
];

const users: User[] = [];
for (const userData of TEST_USERS) {
  const user = repo.create({
    email: userData.email,
    password: await utilsService.getHash('Password123!'),
    displayName: userData.name,
    role: RolesEnum.USER,
    status: ActiveStatusEnum.ACTIVE,
    emailVerified: true,
    monthlyIncome: userData.income,
  });
  await repo.save(user);
  users.push(user);
}
```

---

## Lookup Table Patterns

### System Categories (No Owner)

```typescript
const SYSTEM_CATEGORIES = [
  { name: 'Food & Dining', icon: 'utensils', type: 'expense' },
  { name: 'Transportation', icon: 'car', type: 'expense' },
  { name: 'Salary', icon: 'wallet', type: 'income' },
];

for (const cat of SYSTEM_CATEGORIES) {
  const category = repo.create({
    name: cat.name,
    icon: cat.icon,
    type: CategoryTypeEnum.SYSTEM,
    status: ActiveStatusEnum.ACTIVE,
    userId: null,  // System-wide, no owner
  });
  await repo.save(category);
}
```

### User-Specific Categories

```typescript
const USER_CATEGORIES = [
  { name: 'Side Hustle', icon: 'briefcase' },
  { name: 'Pet Expenses', icon: 'paw' },
];

for (const cat of USER_CATEGORIES) {
  const category = repo.create({
    name: cat.name,
    icon: cat.icon,
    type: CategoryTypeEnum.CUSTOM,
    status: ActiveStatusEnum.ACTIVE,
    userId: testUser.id,  // Owned by specific user
  });
  await repo.save(category);
}
```

---

## Transactional Data Patterns

### Date Range Generation

```typescript
function generateDateRange(days: number): Date[] {
  const dates: Date[] = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    dates.push(date);
  }

  return dates;
}

// Use in seeder
const dates = generateDateRange(30);
for (const date of dates) {
  // Create transactions for each date
}
```

### Varied Transaction Amounts

```typescript
function randomAmount(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

// Expense: $5-$150
const expenseAmount = randomAmount(5, 150);

// Income: fixed or ranged
const salaryAmount = 2500;  // Fixed
const bonusAmount = randomAmount(500, 2000);  // Variable
```

### Transaction with Description

```typescript
const EXPENSE_DESCRIPTIONS = {
  'Food & Dining': ['Grocery store', 'Restaurant', 'Coffee shop', 'Fast food'],
  'Transportation': ['Gas station', 'Uber', 'Bus fare', 'Parking'],
  'Shopping': ['Amazon', 'Target', 'Clothing store', 'Electronics'],
};

function getRandomDescription(categoryName: string): string {
  const descriptions = EXPENSE_DESCRIPTIONS[categoryName] || ['General expense'];
  return descriptions[Math.floor(Math.random() * descriptions.length)];
}
```

### Complete Transaction Seeder

```typescript
export async function seedTransactions(
  dataSource: DataSource,
  user: User,
  categories: Category[],
): Promise<void> {
  const repo = dataSource.getRepository(Transaction);

  const expenseCategories = categories.filter(c =>
    !['Salary', 'Investment', 'Other Income'].includes(c.name)
  );
  const incomeCategory = categories.find(c => c.name === 'Salary')!;

  const transactions: Partial<Transaction>[] = [];
  const dates = generateDateRange(30);

  for (const date of dates) {
    // 1-4 expenses per day
    const expenseCount = Math.floor(Math.random() * 4) + 1;
    for (let i = 0; i < expenseCount; i++) {
      const category = expenseCategories[
        Math.floor(Math.random() * expenseCategories.length)
      ];
      transactions.push({
        userId: user.id,
        categoryId: category.id,
        type: TransactionTypeEnum.EXPENSE,
        amount: randomAmount(10, 100),
        description: getRandomDescription(category.name),
        date: date,
      });
    }

    // Salary on 1st and 15th
    if (date.getDate() === 1 || date.getDate() === 15) {
      transactions.push({
        userId: user.id,
        categoryId: incomeCategory.id,
        type: TransactionTypeEnum.INCOME,
        amount: user.monthlyIncome / 2,
        description: 'Salary deposit',
        date: date,
      });
    }
  }

  await repo.save(transactions.map(t => repo.create(t)));
}
```

---

## Hierarchical Data Patterns

### Goals with Contributions

```typescript
export async function seedGoals(
  dataSource: DataSource,
  user: User,
): Promise<void> {
  const goalRepo = dataSource.getRepository(Goal);
  const contribRepo = dataSource.getRepository(GoalContribution);

  const GOALS = [
    { name: 'Emergency Fund', target: 10000, current: 3500, months: 12 },
    { name: 'Vacation', target: 3000, current: 1200, months: 6 },
    { name: 'New Laptop', target: 2000, current: 800, months: 4 },
  ];

  for (const goalData of GOALS) {
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + goalData.months);

    const goal = goalRepo.create({
      userId: user.id,
      name: goalData.name,
      targetAmount: goalData.target,
      currentAmount: goalData.current,
      targetDate: targetDate,
    });
    await goalRepo.save(goal);

    // Generate contributions to match currentAmount
    let remaining = goalData.current;
    const contributionCount = Math.floor(Math.random() * 5) + 3;
    const contributions: Partial<GoalContribution>[] = [];

    for (let i = 0; i < contributionCount && remaining > 0; i++) {
      const amount = i === contributionCount - 1
        ? remaining
        : Math.min(randomAmount(100, 500), remaining);

      const date = new Date();
      date.setDate(date.getDate() - (i * 7));  // Weekly contributions

      contributions.push({
        goalId: goal.id,
        amount: amount,
        date: date,
        note: `Contribution #${contributionCount - i}`,
      });

      remaining -= amount;
    }

    await contribRepo.save(contributions.map(c => contribRepo.create(c)));
  }
}
```

### Support Tickets with Messages

```typescript
export async function seedSupportTickets(
  dataSource: DataSource,
  user: User,
  admin: User,
): Promise<void> {
  const ticketRepo = dataSource.getRepository(SupportTicket);
  const messageRepo = dataSource.getRepository(TicketMessage);

  const TICKETS = [
    {
      subject: 'Cannot export transactions',
      status: TicketStatusEnum.RESOLVED,
      priority: TicketPriorityEnum.MEDIUM,
      messages: [
        { sender: 'user', text: 'Export button not working' },
        { sender: 'admin', text: 'Thanks for reporting. Can you try clearing cache?' },
        { sender: 'user', text: 'That worked! Thanks!' },
        { sender: 'admin', text: 'Great! Closing this ticket.' },
      ],
    },
    {
      subject: 'Feature request: Dark mode',
      status: TicketStatusEnum.OPEN,
      priority: TicketPriorityEnum.LOW,
      messages: [
        { sender: 'user', text: 'Would love a dark mode option' },
      ],
    },
  ];

  for (const ticketData of TICKETS) {
    const ticket = ticketRepo.create({
      userId: user.id,
      subject: ticketData.subject,
      status: ticketData.status,
      priority: ticketData.priority,
    });
    await ticketRepo.save(ticket);

    for (const msg of ticketData.messages) {
      const message = messageRepo.create({
        ticketId: ticket.id,
        senderType: msg.sender === 'admin'
          ? MessageSenderTypeEnum.ADMIN
          : MessageSenderTypeEnum.USER,
        senderId: msg.sender === 'admin' ? admin.id : user.id,
        message: msg.text,
      });
      await messageRepo.save(message);
    }
  }
}
```

---

## Junction Table Patterns

### Many-to-Many with Explicit Join Table

```typescript
// If you have a UserRole junction table
export async function seedUserRoles(
  dataSource: DataSource,
  users: User[],
  roles: Role[],
): Promise<void> {
  const repo = dataSource.getRepository(UserRole);

  for (const user of users) {
    // Assign default role
    const defaultRole = roles.find(r => r.name === 'user');
    if (defaultRole) {
      await repo.save(repo.create({
        userId: user.id,
        roleId: defaultRole.id,
      }));
    }
  }

  // Admin gets admin role
  const adminUser = users.find(u => u.email === 'admin@example.com');
  const adminRole = roles.find(r => r.name === 'admin');
  if (adminUser && adminRole) {
    await repo.save(repo.create({
      userId: adminUser.id,
      roleId: adminRole.id,
    }));
  }
}
```

---

## Soft Delete Considerations

### Seeding Deleted Records (for testing)

```typescript
// Create some soft-deleted records for testing restore/audit features
const deletedTransaction = repo.create({
  userId: user.id,
  categoryId: category.id,
  type: TransactionTypeEnum.EXPENSE,
  amount: 50,
  description: 'Deleted expense (for testing)',
  date: new Date(),
});
await repo.save(deletedTransaction);
await repo.softDelete(deletedTransaction.id);
```

### Querying with Soft Deletes

```typescript
// When checking idempotency, include soft-deleted
const existing = await repo
  .createQueryBuilder('entity')
  .withDeleted()
  .where('entity.email = :email', { email: 'admin@example.com' })
  .getOne();
```

---

## Bulk Insert Pattern

For large datasets, use bulk insert for performance:

```typescript
// Instead of individual saves
for (const item of items) {
  await repo.save(repo.create(item));  // Slow
}

// Use bulk insert
const entities = items.map(item => repo.create(item));
await repo.save(entities);  // Single query

// Or use insert for even better performance (no hooks)
await repo.insert(items);
```

---

## Reset Seeder Pattern

```typescript
// reset.ts - Use with caution!
async function resetAndSeed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  console.log('Resetting database...');

  // Delete in reverse dependency order
  await dataSource.getRepository(TicketMessage).delete({});
  await dataSource.getRepository(SupportTicket).delete({});
  await dataSource.getRepository(GoalContribution).delete({});
  await dataSource.getRepository(Goal).delete({});
  await dataSource.getRepository(Transaction).delete({});
  await dataSource.getRepository(Budget).delete({});
  await dataSource.getRepository(Category).delete({});
  await dataSource.getRepository(User).delete({});

  console.log('Database reset complete. Running seeders...');

  // Now run normal seeders
  await runSeeder();
}
```

---

**Related**: [Entity Analysis](entity-analysis.md) | [Test Data Generators](test-data-generators.md)
