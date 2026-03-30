# Seed Patterns Reference

Comprehensive patterns for seeding different entity types in NestJS/TypeORM projects.

---

## Table of Contents

1. [User Seeding Patterns](#user-seeding-patterns)
2. [Lookup Table Patterns](#lookup-table-patterns)
3. [Order Data Patterns](#order-data-patterns)
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
  email: 'user@example.com',
  password: await utilsService.getHash('Password123!'),
  displayName: 'Test User',
  role: RolesEnum.USER,
  status: ActiveStatusEnum.ACTIVE,
  emailVerified: true,
});
```

### Multiple Test Users

```typescript
const TEST_USERS = [
  { email: 'user1@example.com', name: 'User One' },
  { email: 'user2@example.com', name: 'User Two' },
  { email: 'user3@example.com', name: 'User Three' },
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
    displayName: userData.name,
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
  { name: 'Electronics', icon: 'cpu', type: 'general' },
  { name: 'Clothing', icon: 'shirt', type: 'general' },
  { name: 'Featured', icon: 'star', type: 'featured' },
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
  { name: 'Accessories', icon: 'paw' },
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

## Order Data Patterns

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
  // Create orders for each date
}
```

### Varied Order Amounts

```typescript
function randomAmount(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

// General: $5-$150
const generalAmount = randomAmount(5, 150);

// Special: fixed or ranged
const defaultAmount = 2500;  // Fixed
const bonusAmount = randomAmount(500, 2000);  // Variable
```

### Order with Description

```typescript
const ITEM_DESCRIPTIONS = {
  'Electronics': ['Smartphone', 'Laptop', 'Headphones', 'Tablet'],
  'Clothing': ['T-shirt', 'Jeans', 'Sneakers', 'Jacket'],
  'Books': ['Fiction', 'Technical', 'Biography', 'Self-help'],
};

function getRandomDescription(categoryName: string): string {
  const descriptions = ITEM_DESCRIPTIONS[categoryName] || ['General item'];
  return descriptions[Math.floor(Math.random() * descriptions.length)];
}
```

### Complete Order Seeder

```typescript
export async function seedOrders(
  dataSource: DataSource,
  user: User,
  categories: Category[],
): Promise<void> {
  const repo = dataSource.getRepository(Order);

  const generalCategories = categories.filter(c =>
    !['Featured', 'Premium', 'Special'].includes(c.name)
  );
  const mainCategory = categories.find(c => c.name === 'Featured')!;

  const orders: Partial<Order>[] = [];
  const dates = generateDateRange(30);

  for (const date of dates) {
    // 1-4 generals per day
    const generalCount = Math.floor(Math.random() * 4) + 1;
    for (let i = 0; i < generalCount; i++) {
      const category = generalCategories[
        Math.floor(Math.random() * generalCategories.length)
      ];
      orders.push({
        userId: user.id,
        categoryId: category.id,
        type: OrderStatusEnum.PENDING,
        amount: randomAmount(10, 100),
        description: getRandomDescription(category.name),
        date: date,
      });
    }

    // Recurring on 1st and 15th
    if (date.getDate() === 1 || date.getDate() === 15) {
      orders.push({
        userId: user.id,
        categoryId: mainCategory.id,
        type: OrderStatusEnum.CONFIRMED,
        amount: defaultAmount,
        description: 'Recurring order',
        date: date,
      });
    }
  }

  await repo.save(orders.map(t => repo.create(t)));
}
```

---

## Hierarchical Data Patterns

### Reviews with Comments

```typescript
export async function seedReviews(
  dataSource: DataSource,
  user: User,
): Promise<void> {
  const reviewRepo = dataSource.getRepository(Review);
  const commentRepo = dataSource.getRepository(ReviewComment);

  const REVIEWS = [
    { title: 'Great product', rating: 5, itemCount: 3 },
    { title: 'Average quality', rating: 3, itemCount: 2 },
    { title: 'Not recommended', rating: 1, itemCount: 1 },
  ];

  for (const reviewData of REVIEWS) {
    const review = reviewRepo.create({
      userId: user.id,
      title: reviewData.title,
      rating: reviewData.rating,
      content: `This is a sample review with rating ${reviewData.rating}/5.`,
    });
    await reviewRepo.save(review);

    // Generate comments
    const commentCount = Math.floor(Math.random() * 3) + 1;
    const comments: Partial<ReviewComment>[] = [];

    for (let i = 0; i < commentCount; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (i * 2));

      comments.push({
        reviewId: review.id,
        content: `Sample comment #${commentCount - i}`,
        date: date,
      });
    }

    await commentRepo.save(comments.map(c => commentRepo.create(c)));
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
      subject: 'Cannot export data',
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
const deletedOrder = repo.create({
  userId: user.id,
  categoryId: category.id,
  type: OrderStatusEnum.PENDING,
  amount: 50,
  description: 'Deleted general (for testing)',
  date: new Date(),
});
await repo.save(deletedOrder);
await repo.softDelete(deletedOrder.id);
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
  await dataSource.getRepository(ReviewComment).delete({});
  await dataSource.getRepository(Review).delete({});
  await dataSource.getRepository(Order).delete({});
  await dataSource.getRepository(Order).delete({});
  await dataSource.getRepository(Category).delete({});
  await dataSource.getRepository(User).delete({});

  console.log('Database reset complete. Running seeders...');

  // Now run normal seeders
  await runSeeder();
}
```

---

**Related**: [Entity Analysis](entity-analysis.md) | [Test Data Generators](test-data-generators.md)
