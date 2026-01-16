# Redis Caching Guide

Complete guide to implementing Redis caching in NestJS applications using the @Cacheable and @CacheInvalidate decorators.

## Table of Contents

- [Overview](#overview)
- [Configuration](#configuration)
- [@Cacheable Decorator](#cacheable-decorator)
- [@CacheInvalidate Decorator](#cacheinvalidate-decorator)
- [TTL Strategy](#ttl-strategy)
- [Cache Key Patterns](#cache-key-patterns)
- [Manual Cache Operations](#manual-cache-operations)
- [Anti-Patterns](#anti-patterns)
- [Complete Examples](#complete-examples)

---

## Overview

Redis caching is implemented using a decorator-based approach that automatically handles cache operations for GET endpoints and cache invalidation for mutation operations.

### Architecture

```
HTTP Request → @Cacheable → CacheService → Redis
                    ↓
                 Cache Hit? → Return cached data
                    ↓ No
               Execute Handler → Cache result → Return data
```

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| CacheModule | `src/infrastructure/cache/` | Global module providing CacheService |
| CacheService | `src/infrastructure/cache/cache.service.ts` | Redis operations (get, set, delete) |
| @Cacheable | `src/core/decorators/cacheable.decorator.ts` | Decorator for caching GET responses |
| @CacheInvalidate | `src/core/decorators/cache-invalidate.decorator.ts` | Decorator for invalidating cache |

---

## Configuration

### Environment Variables

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_PREFIX=ac:
REDIS_DEFAULT_TTL=300      # 5 minutes (seconds)
REDIS_CATALOG_TTL=3600     # 1 hour (static catalogs)
REDIS_LIST_TTL=1800        # 30 minutes (entity lists)
REDIS_STATS_TTL=900        # 15 minutes (computed stats)
```

### TTL Types

| Type | Duration | Use Case |
|------|----------|----------|
| `'default'` | 5 minutes | General purpose, frequently updated data |
| `'catalog'` | 1 hour | Static catalogs (exercises, features, products) |
| `'list'` | 30 minutes | Entity lists (users, assignments, meetings) |
| `'stats'` | 15 minutes | Computed statistics (dashboard, aggregates) |
| `number` | Custom seconds | Specific TTL in seconds |

---

## @Cacheable Decorator

Use `@Cacheable` on GET endpoints to automatically cache responses.

### Basic Usage

```typescript
import { Cacheable } from 'src/core/decorators';

@Get()
@Cacheable({ key: 'exercises:all', ttl: 'catalog' })
async findAll() {
    return this.exerciseService.getActiveExercises();
}
```

### Options

```typescript
interface CacheableOptions {
    key?: string;                    // Static cache key
    keyGenerator?: (req) => string;  // Dynamic key generator
    ttl?: CacheTTLType;             // TTL type or seconds
    userAware?: boolean;             // Include user ID in key
}
```

### With Dynamic Key Generator

```typescript
@Get('search')
@Cacheable({
    keyGenerator: (req) => `exercises:search:${req.query?.q || 'all'}`,
    ttl: 'catalog',
})
async search(@Query('q') query: string) {
    return this.exerciseService.searchExercises(query);
}
```

### With URL Parameters

```typescript
@Get(':id')
@Cacheable({
    keyGenerator: (req) => `exercises:${req.params?.id}`,
    ttl: 'catalog',
})
async findOne(@Param('id') id: string) {
    return this.exerciseService.findByIdOrFail(id);
}
```

### User-Aware Caching

For user-specific data, include user ID in the cache key:

```typescript
@Get('my-data')
@Cacheable({
    key: 'user:profile',
    ttl: 'default',
    userAware: true,  // Cache key becomes: user:{userId}:user:profile
})
async getMyProfile(@CurrentUser() user: IJwtPayload) {
    return this.userService.getProfile(user.id);
}
```

---

## @CacheInvalidate Decorator

Use `@CacheInvalidate` on mutation endpoints (POST, PATCH, DELETE) to clear related caches.

### Basic Usage

```typescript
import { CacheInvalidate } from 'src/core/decorators';

@Post()
@CacheInvalidate({ patterns: ['exercises:*'] })
async create(@Body() dto: CreateExerciseDto) {
    return this.exerciseService.createExercise(dto);
}
```

### Options

```typescript
interface CacheInvalidateOptions {
    patterns: string[];  // Array of cache key patterns to invalidate
    before?: boolean;    // Invalidate before handler (default: after)
}
```

### Multiple Patterns

```typescript
@Patch(':id')
@CacheInvalidate({
    patterns: [
        'exercises:*',      // All exercise caches
        'prescriptions:*',  // Related prescription caches
    ]
})
async update(@Param('id') id: string, @Body() dto: UpdateExerciseDto) {
    return this.exerciseService.updateExercise(id, dto);
}
```

### Invalidate Before Handler

```typescript
@Delete(':id')
@CacheInvalidate({
    patterns: ['exercises:*'],
    before: true,  // Invalidate before deletion
})
async remove(@Param('id') id: string) {
    return this.exerciseService.deactivateExercise(id);
}
```

---

## TTL Strategy

### Recommended TTL by Data Type

| Data Category | TTL | Examples |
|---------------|-----|----------|
| Static Catalogs | `'catalog'` (1h) | Exercises, features, products |
| Entity Lists | `'list'` (30m) | Users, assignments, meetings |
| Computed Stats | `'stats'` (15m) | Dashboard, aggregates |
| User-specific | `'default'` (5m) | Profiles, preferences |
| Real-time Data | No Cache | Notifications, unread counts |

### Configuring via Environment

```env
# Production (longer TTLs for stability)
REDIS_CATALOG_TTL=3600
REDIS_LIST_TTL=1800
REDIS_STATS_TTL=900

# Development (shorter TTLs for testing)
REDIS_CATALOG_TTL=300
REDIS_LIST_TTL=120
REDIS_STATS_TTL=60
```

---

## Cache Key Patterns

### Naming Convention

```
{prefix}:{entity}:{identifier}:{optional-filter}
```

### Examples

| Pattern | Description |
|---------|-------------|
| `ac:exercises:all` | All exercises |
| `ac:exercises:123` | Single exercise by ID |
| `ac:exercises:search:stretching` | Search results |
| `ac:exercises:category:STRETCHING` | Exercises by category |
| `ac:users:page:1:limit:10` | Paginated users |
| `ac:admin:dashboard` | Admin dashboard stats |
| `ac:user:456:profile` | User-specific profile |

### Wildcard Patterns for Invalidation

```typescript
// Invalidate all exercise-related caches
patterns: ['exercises:*']

// Invalidate specific user's caches
patterns: ['user:456:*']

// Invalidate multiple patterns
patterns: ['exercises:*', 'prescriptions:*', 'admin:dashboard']
```

---

## Manual Cache Operations

For complex scenarios, use CacheService directly:

```typescript
import { CacheService } from 'src/infrastructure/cache';

@Injectable()
export class SomeService {
    constructor(private readonly cacheService: CacheService) {}

    async getWithManualCache(id: string) {
        const cacheKey = this.cacheService.generateKey('custom', id);

        // Try cache first
        const cached = await this.cacheService.get<MyEntity>(cacheKey);
        if (cached) {
            return cached;
        }

        // Fetch and cache
        const data = await this.repository.findById(id);
        await this.cacheService.set(cacheKey, data, 'default');
        return data;
    }

    async invalidateCustomCache(pattern: string) {
        await this.cacheService.deletePattern(pattern);
    }
}
```

### CacheService Methods

| Method | Description |
|--------|-------------|
| `get<T>(key)` | Get cached value |
| `set(key, value, ttl)` | Set cached value with TTL |
| `delete(key)` | Delete single key |
| `deletePattern(pattern)` | Delete keys matching pattern |
| `generateKey(...parts)` | Generate prefixed cache key |
| `isReady()` | Check if Redis is connected |
| `getStats()` | Get cache statistics |
| `flushAll()` | Clear all application caches |

---

## Anti-Patterns

### What NOT to Cache

1. **Real-time Data**
   - Notifications, unread counts
   - Live status indicators
   - WebSocket data

2. **User Authentication**
   - Session tokens
   - Login status
   - Current user info

3. **Frequently Mutating Data**
   - Chat messages (use short TTL if needed)
   - Today's dynamic data

4. **Sensitive Data**
   - Passwords, tokens
   - Personal identifiable information

### Common Mistakes

```typescript
// ❌ BAD: Caching mutation endpoint
@Post()
@Cacheable({ key: 'create:result' })  // Don't cache POST!
async create(@Body() dto: CreateDto) { ... }

// ❌ BAD: Not invalidating related caches
@Post()
// Missing @CacheInvalidate!
async create(@Body() dto: CreateDto) { ... }

// ❌ BAD: Too long TTL for dynamic data
@Cacheable({ key: 'notifications', ttl: 3600 })  // 1 hour is too long!
async getNotifications() { ... }

// ✅ GOOD: Proper invalidation
@Post()
@CacheInvalidate({ patterns: ['exercises:*'] })
async create(@Body() dto: CreateDto) { ... }
```

---

## Complete Examples

### Exercise Controller with Caching

```typescript
import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { Cacheable, CacheInvalidate, AdminOnly } from 'src/core/decorators';

@Controller('exercises')
export class ExerciseController {
    constructor(private readonly exerciseService: ExerciseService) {}

    @Get()
    @Cacheable({ key: 'exercises:all', ttl: 'catalog' })
    async findAll() {
        return this.exerciseService.getActiveExercises();
    }

    @Get('search')
    @Cacheable({
        keyGenerator: (req) => `exercises:search:${req.query?.q || 'all'}`,
        ttl: 'catalog',
    })
    async search(@Query('q') query: string) {
        return this.exerciseService.searchExercises(query);
    }

    @Get('category/:category')
    @Cacheable({
        keyGenerator: (req) => `exercises:category:${req.params?.category}`,
        ttl: 'catalog',
    })
    async findByCategory(@Param('category') category: string) {
        return this.exerciseService.getExercisesByCategory(category);
    }

    @Get(':id')
    @Cacheable({
        keyGenerator: (req) => `exercises:${req.params?.id}`,
        ttl: 'catalog',
    })
    async findOne(@Param('id') id: string) {
        return this.exerciseService.findByIdOrFail(id);
    }

    @AdminOnly()
    @Post()
    @CacheInvalidate({ patterns: ['exercises:*'] })
    async create(@Body() dto: CreateExerciseDto) {
        return this.exerciseService.createExercise(dto);
    }

    @AdminOnly()
    @Patch(':id')
    @CacheInvalidate({ patterns: ['exercises:*'] })
    async update(@Param('id') id: string, @Body() dto: UpdateExerciseDto) {
        return this.exerciseService.updateExercise(id, dto);
    }

    @AdminOnly()
    @Delete(':id')
    @CacheInvalidate({ patterns: ['exercises:*'] })
    async remove(@Param('id') id: string) {
        return this.exerciseService.deactivateExercise(id);
    }
}
```

---

## Docker Setup

### docker-compose.yml

```yaml
redis:
    image: redis:7-alpine
    container_name: activitycoaching-redis
    restart: unless-stopped
    ports:
        - '${REDIS_PORT:-6379}:6379'
    volumes:
        - redis_data:/data
    command: redis-server --appendonly yes
    networks:
        - nestjs-network
    healthcheck:
        test: ['CMD', 'redis-cli', 'ping']
        interval: 10s
        timeout: 5s
        retries: 5
```

---

## Monitoring

### Check Redis Connection

```typescript
// In a health check endpoint or startup
const stats = await cacheService.getStats();
console.log(stats);
// { connected: true, keyCount: 42, memoryUsage: '1.2MB' }
```

### Flush All Caches (Development)

```typescript
await cacheService.flushAll();
```

---

**Related Files:**

- [SKILL.md](../SKILL.md)
- [configuration.md](configuration.md)
- [architecture-overview.md](architecture-overview.md)