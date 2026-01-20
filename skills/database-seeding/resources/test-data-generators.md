# Test Data Generators

Patterns and utilities for generating realistic test data in NestJS seed files.

---

## Table of Contents

1. [Basic Generators](#basic-generators)
2. [Financial Data](#financial-data)
3. [Date and Time](#date-and-time)
4. [User Data](#user-data)
5. [Text Content](#text-content)
6. [Enum Utilities](#enum-utilities)
7. [Seeded Random](#seeded-random)

---

## Basic Generators

### Random Number in Range

```typescript
/**
 * Generate random number between min and max (inclusive)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate random decimal with precision
 */
function randomDecimal(min: number, max: number, decimals: number = 2): number {
  const value = Math.random() * (max - min) + min;
  return Number(value.toFixed(decimals));
}

// Usage
randomInt(1, 100);      // 42
randomDecimal(10, 100); // 45.67
```

### Random Selection

```typescript
/**
 * Pick random item from array
 */
function randomPick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Pick N random items from array (no duplicates)
 */
function randomPickMultiple<T>(items: T[], count: number): T[] {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, items.length));
}

// Usage
randomPick(['a', 'b', 'c']);          // 'b'
randomPickMultiple([1, 2, 3, 4, 5], 3); // [3, 1, 5]
```

### Boolean with Probability

```typescript
/**
 * Generate boolean with given probability of true
 */
function randomBoolean(probabilityTrue: number = 0.5): boolean {
  return Math.random() < probabilityTrue;
}

// Usage
randomBoolean(0.8);  // 80% chance of true
randomBoolean(0.1);  // 10% chance of true
```

---

## Financial Data

### Currency Amount

```typescript
/**
 * Generate realistic currency amount
 */
function randomAmount(
  min: number,
  max: number,
  roundTo: 'cent' | 'dollar' | 'ten' = 'cent'
): number {
  let value = Math.random() * (max - min) + min;

  switch (roundTo) {
    case 'cent':
      return Math.round(value * 100) / 100;
    case 'dollar':
      return Math.round(value);
    case 'ten':
      return Math.round(value / 10) * 10;
  }
}

// Usage
randomAmount(5, 100);           // 45.67
randomAmount(100, 1000, 'dollar'); // 567
randomAmount(100, 1000, 'ten');    // 580
```

### Transaction Amounts by Type

```typescript
const AMOUNT_RANGES = {
  // Expenses
  'Food & Dining': { min: 5, max: 80 },
  'Transportation': { min: 2, max: 100 },
  'Shopping': { min: 10, max: 200 },
  'Entertainment': { min: 10, max: 100 },
  'Utilities': { min: 50, max: 300 },
  'Health': { min: 20, max: 500 },

  // Income
  'Salary': { min: 2000, max: 8000 },
  'Freelance': { min: 100, max: 2000 },
  'Investment': { min: 50, max: 1000 },
};

function generateAmount(categoryName: string): number {
  const range = AMOUNT_RANGES[categoryName] || { min: 10, max: 100 };
  return randomAmount(range.min, range.max);
}
```

### Monthly Budget Allocation

```typescript
/**
 * Generate budget amounts that make sense together
 */
function generateBudgetAllocation(
  monthlyIncome: number,
  categories: string[]
): Map<string, number> {
  const allocation = new Map<string, number>();

  // Standard allocation percentages
  const PERCENTAGES = {
    'Food & Dining': 0.15,
    'Transportation': 0.10,
    'Utilities': 0.10,
    'Shopping': 0.08,
    'Entertainment': 0.05,
    'Health': 0.05,
    'Savings': 0.20,
  };

  for (const category of categories) {
    const percentage = PERCENTAGES[category] || 0.05;
    allocation.set(category, Math.round(monthlyIncome * percentage));
  }

  return allocation;
}
```

---

## Date and Time

### Date Range Generator

```typescript
/**
 * Generate array of dates in range
 */
function dateRange(
  startDaysAgo: number,
  endDaysAgo: number = 0
): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (let i = startDaysAgo; i >= endDaysAgo; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    dates.push(date);
  }

  return dates;
}

// Usage
dateRange(30);     // Last 30 days
dateRange(30, 7);  // From 30 days ago to 7 days ago
```

### Random Date in Range

```typescript
/**
 * Generate random date between two dates
 */
function randomDate(start: Date, end: Date): Date {
  const startTime = start.getTime();
  const endTime = end.getTime();
  return new Date(startTime + Math.random() * (endTime - startTime));
}

/**
 * Generate random date in last N days
 */
function randomDateInLastDays(days: number): Date {
  const now = new Date();
  const past = new Date();
  past.setDate(past.getDate() - days);
  return randomDate(past, now);
}
```

### Specific Day of Month

```typescript
/**
 * Get specific days of month in date range
 */
function getDaysOfMonth(
  datesArray: Date[],
  ...days: number[]
): Date[] {
  return datesArray.filter(d => days.includes(d.getDate()));
}

// Usage: Get 1st and 15th for salary
const salaryDates = getDaysOfMonth(dateRange(60), 1, 15);
```

### Future Date Generator

```typescript
/**
 * Generate future date N months from now
 */
function futureDate(months: number): Date {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date;
}

/**
 * Generate random future date
 */
function randomFutureDate(minMonths: number, maxMonths: number): Date {
  const months = randomInt(minMonths, maxMonths);
  return futureDate(months);
}
```

---

## User Data

### Email Generator

```typescript
/**
 * Generate safe test email (won't send real mail)
 */
function generateEmail(name: string, index?: number): string {
  const sanitized = name.toLowerCase().replace(/\s+/g, '.');
  const suffix = index !== undefined ? `.${index}` : '';
  return `${sanitized}${suffix}@test.local`;
}

// Common test email domains (safe)
const SAFE_DOMAINS = [
  'test.local',
  'example.com',
  'test.app',
  'pennywise.test',
];

function safeEmail(username: string): string {
  const domain = randomPick(SAFE_DOMAINS);
  return `${username}@${domain}`;
}
```

### Name Generator

```typescript
const FIRST_NAMES = [
  'James', 'Emma', 'Oliver', 'Sophia', 'William',
  'Ava', 'Benjamin', 'Isabella', 'Lucas', 'Mia',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones',
  'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
];

function randomName(): { first: string; last: string; full: string } {
  const first = randomPick(FIRST_NAMES);
  const last = randomPick(LAST_NAMES);
  return { first, last, full: `${first} ${last}` };
}
```

### Password Generator

```typescript
/**
 * Generate password that meets common requirements
 */
function generatePassword(): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';

  // Ensure at least one of each
  let password = '';
  password += upper[randomInt(0, upper.length - 1)];
  password += lower[randomInt(0, lower.length - 1)];
  password += numbers[randomInt(0, numbers.length - 1)];
  password += special[randomInt(0, special.length - 1)];

  // Fill to 12 characters
  const all = upper + lower + numbers;
  while (password.length < 12) {
    password += all[randomInt(0, all.length - 1)];
  }

  // Shuffle
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Or use predictable test passwords
const TEST_PASSWORD = 'TestPassword123!';
```

---

## Text Content

### Transaction Description

```typescript
const DESCRIPTIONS = {
  'Food & Dining': [
    'Grocery shopping', 'Dinner at restaurant', 'Coffee shop',
    'Lunch takeout', 'Fast food', 'Bakery', 'Food delivery',
  ],
  'Transportation': [
    'Gas station', 'Uber ride', 'Bus fare', 'Parking fee',
    'Car maintenance', 'Toll fee', 'Train ticket',
  ],
  'Shopping': [
    'Amazon purchase', 'Clothing store', 'Electronics',
    'Home goods', 'Online shopping', 'Department store',
  ],
  'Entertainment': [
    'Movie tickets', 'Concert', 'Streaming subscription',
    'Video game', 'Books', 'Sports event',
  ],
  'Utilities': [
    'Electric bill', 'Water bill', 'Internet service',
    'Phone bill', 'Gas bill', 'Trash service',
  ],
};

function randomDescription(categoryName: string): string {
  const options = DESCRIPTIONS[categoryName] || ['General expense'];
  return randomPick(options);
}
```

### Goal Names

```typescript
const GOAL_TEMPLATES = [
  'Emergency Fund', 'Vacation to {destination}', 'New {item}',
  'Home Down Payment', 'Wedding Fund', 'Retirement',
  'Education Fund', 'Car Fund', 'Debt Payoff',
];

const DESTINATIONS = ['Hawaii', 'Europe', 'Japan', 'Mexico', 'Thailand'];
const ITEMS = ['Car', 'Laptop', 'Phone', 'Furniture', 'Bike'];

function randomGoalName(): string {
  const template = randomPick(GOAL_TEMPLATES);
  return template
    .replace('{destination}', randomPick(DESTINATIONS))
    .replace('{item}', randomPick(ITEMS));
}
```

### Support Ticket Content

```typescript
const TICKET_SUBJECTS = [
  'Cannot export transactions',
  'App crashes on startup',
  'Budget calculation seems wrong',
  'Feature request: {feature}',
  'Question about {topic}',
];

const FEATURES = ['Dark mode', 'CSV import', 'Recurring transactions'];
const TOPICS = ['budgets', 'goals', 'reports', 'security'];

function randomTicketSubject(): string {
  const template = randomPick(TICKET_SUBJECTS);
  return template
    .replace('{feature}', randomPick(FEATURES))
    .replace('{topic}', randomPick(TOPICS));
}
```

---

## Enum Utilities

### Random Enum Value

```typescript
/**
 * Get random value from enum
 */
function randomEnumValue<T extends object>(enumObj: T): T[keyof T] {
  const values = Object.values(enumObj).filter(
    v => typeof v === 'string' || typeof v === 'number'
  );
  return randomPick(values) as T[keyof T];
}

// Usage
randomEnumValue(CurrencyEnum);     // 'USD' or 'EUR' etc.
randomEnumValue(TransactionTypeEnum); // 'INCOME' or 'EXPENSE'
```

### Weighted Enum Selection

```typescript
/**
 * Select enum value with weighted probability
 */
function weightedEnumPick<T>(
  options: Array<{ value: T; weight: number }>
): T {
  const totalWeight = options.reduce((sum, o) => sum + o.weight, 0);
  let random = Math.random() * totalWeight;

  for (const option of options) {
    random -= option.weight;
    if (random <= 0) return option.value;
  }

  return options[options.length - 1].value;
}

// Usage: 80% expenses, 20% income
const transactionType = weightedEnumPick([
  { value: TransactionTypeEnum.EXPENSE, weight: 80 },
  { value: TransactionTypeEnum.INCOME, weight: 20 },
]);
```

---

## Seeded Random

For reproducible test data, use seeded random:

```typescript
/**
 * Simple seeded random number generator
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number = 12345) {
    this.seed = seed;
  }

  next(): number {
    // Linear congruential generator
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  decimal(min: number, max: number, decimals: number = 2): number {
    const value = this.next() * (max - min) + min;
    return Number(value.toFixed(decimals));
  }

  pick<T>(items: T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  boolean(probability: number = 0.5): boolean {
    return this.next() < probability;
  }
}

// Usage
const rng = new SeededRandom(42);  // Same seed = same results
rng.int(1, 100);    // Always 67 with seed 42
rng.decimal(0, 100); // Always 34.56 with seed 42
```

---

## Complete Generator Module

```typescript
// generators.ts
export const generators = {
  // Numbers
  int: randomInt,
  decimal: randomDecimal,
  amount: randomAmount,

  // Collections
  pick: randomPick,
  pickMultiple: randomPickMultiple,

  // Boolean
  boolean: randomBoolean,

  // Dates
  date: randomDate,
  dateRange: dateRange,
  futureDate: futureDate,

  // User data
  email: generateEmail,
  name: randomName,
  password: generatePassword,

  // Content
  description: randomDescription,
  goalName: randomGoalName,
  ticketSubject: randomTicketSubject,

  // Enums
  enumValue: randomEnumValue,
  weightedEnum: weightedEnumPick,
};

// Usage in seed file
import { generators as gen } from './generators';

const amount = gen.amount(10, 100);
const name = gen.name();
const date = gen.dateRange(30);
```

---

**Related**: [Seed Patterns](seed-patterns.md) | [Entity Analysis](entity-analysis.md)
