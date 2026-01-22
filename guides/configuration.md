# Configuration Management - UnifiedConfig Pattern

Complete guide to managing configuration in backend microservices.

## Table of Contents

- [UnifiedConfig Overview](#unifiedconfig-overview)
- [NEVER Use process.env Directly](#never-use-processenv-directly)
- [Configuration Structure](#configuration-structure)
- [Environment-Specific Configs](#environment-specific-configs)
- [Secrets Management](#secrets-management)
- [JWT Token Configuration](#jwt-token-configuration)
- [Migration Guide](#migration-guide)

---

## UnifiedConfig Overview

### Why UnifiedConfig?

**Problems with process.env:**

- ❌ No type safety
- ❌ No validation
- ❌ Hard to test
- ❌ Scattered throughout code
- ❌ No default values
- ❌ Runtime errors for typos

**Benefits of unifiedConfig:**

- ✅ Type-safe configuration
- ✅ Single source of truth
- ✅ Validated at startup
- ✅ Easy to test with mocks
- ✅ Clear structure
- ✅ Fallback to environment variables

---

## NEVER Use process.env Directly

### The Rule

```typescript
// ❌ NEVER DO THIS
const timeout = parseInt(process.env.TIMEOUT_MS || '5000');
const dbHost = process.env.DB_HOST || 'localhost';

// ✅ ALWAYS DO THIS
import { config } from './config/unifiedConfig';
const timeout = config.timeouts.default;
const dbHost = config.database.host;
```

### Why This Matters

**Example of problems:**

```typescript
// Typo in environment variable name
const host = process.env.DB_HSOT; // undefined! No error!

// Type safety
const port = process.env.PORT; // string! Need parseInt
const timeout = parseInt(process.env.TIMEOUT); // NaN if not set!
```

**With unifiedConfig:**

```typescript
const port = config.server.port; // number, guaranteed
const timeout = config.timeouts.default; // number, with fallback
```

---

## Configuration Structure

### UnifiedConfig Interface

```typescript
export interface UnifiedConfig {
    database: {
        host: string;
        port: number;
        username: string;
        password: string;
        database: string;
    };
    server: {
        port: number;
        sessionSecret: string;
    };
    tokens: {
        jwt: string;
        inactivity: string;
        internal: string;
    };
    keycloak: {
        realm: string;
        client: string;
        baseUrl: string;
        secret: string;
    };
    aws: {
        region: string;
        emailQueueUrl: string;
        accessKeyId: string;
        secretAccessKey: string;
    };
    sentry: {
        dsn: string;
        environment: string;
        tracesSampleRate: number;
    };
    // ... more sections
}
```

### Implementation Pattern

**File:** `src/config/unifiedConfig.ts`

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as ini from 'ini';

const configPath = path.join(__dirname, '../../config.ini');
const iniConfig = ini.parse(fs.readFileSync(configPath, 'utf-8'));

export const config: UnifiedConfig = {
    database: {
        host: iniConfig.database?.host || process.env.DB_HOST || 'localhost',
        port: parseInt(
            iniConfig.database?.port || process.env.DB_PORT || '3306',
        ),
        username: iniConfig.database?.username || process.env.DB_USER || 'root',
        password: iniConfig.database?.password || process.env.DB_PASSWORD || '',
        database:
            iniConfig.database?.database || process.env.DB_NAME || 'blog_dev',
    },
    server: {
        port: parseInt(iniConfig.server?.port || process.env.PORT || '3002'),
        sessionSecret:
            iniConfig.server?.sessionSecret ||
            process.env.SESSION_SECRET ||
            'dev-secret',
    },
    // ... more configuration
};

// Validate critical config
if (!config.tokens.jwt) {
    throw new Error('JWT secret not configured!');
}
```

**Key Points:**

- Read from config.ini first
- Fallback to process.env
- Default values for development
- Validation at startup
- Type-safe access

---

## Environment-Specific Configs

### config.ini Structure

```ini
[database]
host = localhost
port = 3306
username = root
password = password1
database = blog_dev

[server]
port = 3002
sessionSecret = your-secret-here

[tokens]
jwt = your-jwt-secret
inactivity = 30m
internal = internal-api-token

[keycloak]
realm = myapp
client = myapp-client
baseUrl = http://localhost:8080
secret = keycloak-client-secret

[sentry]
dsn = https://your-sentry-dsn
environment = development
tracesSampleRate = 0.1
```

### Environment Overrides

```bash
# .env file (optional overrides)
DB_HOST=production-db.example.com
DB_PASSWORD=secure-password
PORT=80
```

**Precedence:**

1. config.ini (highest priority)
2. process.env variables
3. Hard-coded defaults (lowest priority)

---

## Secrets Management

### DO NOT Commit Secrets

```gitignore
# .gitignore
config.ini
.env
sentry.ini
*.pem
*.key
```

### Use Environment Variables in Production

```typescript
// Development: config.ini
// Production: Environment variables

export const config: UnifiedConfig = {
    database: {
        password: process.env.DB_PASSWORD || iniConfig.database?.password || '',
    },
    tokens: {
        jwt: process.env.JWT_SECRET || iniConfig.tokens?.jwt || '',
    },
};
```

---

## JWT Token Configuration

### Token Expiration Time Formats

The JWT library (`jsonwebtoken`) supports multiple formats for expiration times:

```bash
# ✅ GOOD: String time formats (recommended)
AUTH_TOKEN_EXPIRED_TIME=24h          # 24 hours
AUTH_REFRESH_TOKEN_EXPIRED_TIME=7d   # 7 days
AUTH_TOKEN_EXPIRED_TIME_REMEMBER_ME=30d  # 30 days

# ✅ GOOD: Numeric values (seconds)
AUTH_TOKEN_EXPIRED_TIME=86400        # 24 hours in seconds
AUTH_REFRESH_TOKEN_EXPIRED_TIME=604800  # 7 days in seconds
```

### Common JWT Configuration Pitfall

**❌ WRONG: Treating string time formats as numbers**

```typescript
// This is WRONG - will cause 500 errors
getAccessToken(payload: IJwtPayload) {
    const expiresIn = this.configService.get<string>('AUTH_TOKEN_EXPIRED_TIME');
    const expiresInNumber = Number(expiresIn);  // "24h" → NaN!

    if (isNaN(expiresInNumber)) {
        throw new Error('Invalid JWT expiry time');  // Will always fail for "24h"
    }

    return this.jwtService.sign(payload, { expiresIn: expiresInNumber });
}
```

**✅ CORRECT: Pass the value directly to JWT library**

```typescript
// JWT library handles both numeric and string formats natively
getAccessToken(payload: IJwtPayload) {
    const expiresIn = this.configService.get<string>('AUTH_TOKEN_EXPIRED_TIME');

    if (!expiresIn) {
        throw new Error('JWT expiry time not configured. Check your .env file.');
    }

    // JWT library supports: "24h", "7d", "30m", 3600 (seconds), etc.
    return this.jwtService.sign(payload, { expiresIn });
}
```

### Supported Time Formats

| Format | Example | Description |
|--------|---------|-------------|
| Seconds | `3600` | Numeric seconds |
| Minutes | `"30m"` | 30 minutes |
| Hours | `"24h"` | 24 hours |
| Days | `"7d"` | 7 days |
| Weeks | `"2w"` | 2 weeks |
| Years | `"1y"` | 1 year |

### Environment File Example

```bash
# .env - JWT Configuration
AUTH_JWT_SECRET="your-secure-secret-here"
AUTH_TOKEN_COOKIE_NAME="AuthToken"
AUTH_TOKEN_EXPIRED_TIME=24h
AUTH_TOKEN_EXPIRED_TIME_REMEMBER_ME=30d
AUTH_REFRESH_TOKEN_COOKIE_NAME="RefreshToken"
AUTH_REFRESH_TOKEN_EXPIRED_TIME=7d
```

### Token Service Best Practice

```typescript
// src/infrastructure/token/token.service.ts
@Injectable()
export class TokenService {
    constructor(
        private jwtService: JwtService,
        private configService: ConfigService,
    ) {}

    getAccessToken(payload: IJwtPayload, rememberMe?: boolean): string {
        const expiresIn = rememberMe
            ? this.configService.get<string>('AUTH_TOKEN_EXPIRED_TIME_REMEMBER_ME')
            : this.configService.get<string>('AUTH_TOKEN_EXPIRED_TIME');

        if (!expiresIn) {
            throw new Error('JWT expiry time not configured. Check your .env file.');
        }

        // JWT library natively supports string time formats
        return this.jwtService.sign(payload, { expiresIn });
    }

    getRefreshToken(payload: IJwtPayload): string {
        const refreshExpiresIn = this.configService.get<string>(
            'AUTH_REFRESH_TOKEN_EXPIRED_TIME',
        );

        if (!refreshExpiresIn) {
            throw new Error('JWT refresh expiry time not configured.');
        }

        return this.jwtService.sign(payload, { expiresIn: refreshExpiresIn });
    }
}
```

---

## Migration Guide

### Find All process.env Usage

```bash
grep -r "process.env" blog-api/src/ --include="*.ts" | wc -l
```

### Migration Example

**Before:**

```typescript
// Scattered throughout code
const timeout = parseInt(process.env.OPENID_HTTP_TIMEOUT_MS || '15000');
const keycloakUrl = process.env.KEYCLOAK_BASE_URL;
const jwtSecret = process.env.JWT_SECRET;
```

**After:**

```typescript
import { config } from './config/unifiedConfig';

const timeout = config.keycloak.timeout;
const keycloakUrl = config.keycloak.baseUrl;
const jwtSecret = config.tokens.jwt;
```

**Benefits:**

- Type-safe
- Centralized
- Easy to test
- Validated at startup

---

**Related Files:**

- [SKILL.md](SKILL.md)
- [testing-guide.md](testing-guide.md)
- [async-and-errors.md](async-and-errors.md)
