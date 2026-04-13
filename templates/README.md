# NestJS Code Templates

Production-ready TypeScript templates for NestJS projects. Copy into your project's `src/` directory and customize.

## Prerequisites

Install these packages before using templates:

```bash
npm install cookie-parser @nestjs/passport passport passport-jwt @nestjs/jwt @nestjs/config @nestjs/swagger class-validator class-transformer typeorm dotenv bcrypt
npm install -D @types/cookie-parser @types/passport-jwt @types/bcrypt
```

## Copy Order (dependencies matter)

```
1. config/                    ← No dependencies, copy first
2. shared/interfaces/         ← No dependencies
3. shared/dtos/               ← No dependencies
4. core/base/                 ← No dependencies
5. core/decorators/           ← Depends on shared/dtos
6. core/pipes/                ← No dependencies
7. core/filters/              ← No dependencies
8. core/guards/               ← Depends on config/, core/decorators/
9. core/interceptors/         ← Depends on config/
10. infrastructure/token/     ← Depends on config/, shared/interfaces/
11. main.ts                   ← Depends on everything above
```

## File Map

### Config (`src/config/`)

| Template                       | Target                             | Purpose                                                                                                   |
| ------------------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `config/env-config.service.ts` | `src/config/env-config.service.ts` | Singleton config wrapper — static access for JwtStrategy. **NEVER use `process.env` directly elsewhere.** |
| `config/jwt.config.ts`         | `src/config/jwt.config.ts`         | JWT module configuration factory                                                                          |

### Core Base Classes (`src/core/base/`)

| Template                       | Target                             | Purpose                              |
| ------------------------------ | ---------------------------------- | ------------------------------------ |
| `core/base/base.entity.ts`     | `src/core/base/base.entity.ts`     | UUID PK + timestamps + soft delete   |
| `core/base/base.repository.ts` | `src/core/base/base.repository.ts` | Generic CRUD data access             |
| `core/base/base.service.ts`    | `src/core/base/base.service.ts`    | Business logic with `findByIdOrFail` |
| `core/base/base.controller.ts` | `src/core/base/base.controller.ts` | Full CRUD endpoints with Swagger     |

### Core Decorators (`src/core/decorators/`)

| Template                                         | Target                                               | Purpose                                       |
| ------------------------------------------------ | ---------------------------------------------------- | --------------------------------------------- |
| `core/decorators/public.decorator.ts`            | `src/core/decorators/public.decorator.ts`            | `@Public()` — bypass JWT                      |
| `core/decorators/roles.decorator.ts`             | `src/core/decorators/roles.decorator.ts`             | `@Roles('admin')` — set required roles        |
| `core/decorators/current-user.decorator.ts`      | `src/core/decorators/current-user.decorator.ts`      | `@CurrentUser()` — extract user from request  |
| `core/decorators/api-swagger.decorator.ts`       | `src/core/decorators/api-swagger.decorator.ts`       | `@ApiSwagger()` — composite Swagger decorator |
| `core/decorators/api-response-data.decorator.ts` | `src/core/decorators/api-response-data.decorator.ts` | Swagger response schema helper                |

### Core Guards (`src/core/guards/`)

| Template                        | Target                              | Purpose                                       |
| ------------------------------- | ----------------------------------- | --------------------------------------------- |
| `core/guards/jwt-auth.guard.ts` | `src/core/guards/jwt-auth.guard.ts` | Global JWT guard with `@Public()` support     |
| `core/guards/jwt.strategy.ts`   | `src/core/guards/jwt.strategy.ts`   | Cookie-first JWT extraction + Bearer fallback |
| `core/guards/roles.guard.ts`    | `src/core/guards/roles.guard.ts`    | RBAC guard — handles single and array roles   |

### Core Interceptors (`src/core/interceptors/`)

| Template                                        | Target                                              | Purpose                                                                        |
| ----------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------ |
| `core/interceptors/set-token.interceptor.ts`    | `src/core/interceptors/set-token.interceptor.ts`    | **SetTokenInterceptor** — auto-sets httpOnly cookies on login/register/refresh |
| `core/interceptors/remove-token.interceptor.ts` | `src/core/interceptors/remove-token.interceptor.ts` | **RemoveTokenInterceptor** — clears cookies on logout                          |
| `core/interceptors/transform.interceptor.ts`    | `src/core/interceptors/transform.interceptor.ts`    | Wraps responses in `{ success, statusCode, message, data }`                    |
| `core/interceptors/logging.interceptor.ts`      | `src/core/interceptors/logging.interceptor.ts`      | Logs request method/url/status/duration                                        |

### Core Filters (`src/core/filters/`)

| Template                                | Target                                      | Purpose                              |
| --------------------------------------- | ------------------------------------------- | ------------------------------------ |
| `core/filters/http-exception.filter.ts` | `src/core/filters/http-exception.filter.ts` | Formats HTTP exceptions consistently |
| `core/filters/all-exceptions.filter.ts` | `src/core/filters/all-exceptions.filter.ts` | Catches all unhandled exceptions     |

### Core Pipes (`src/core/pipes/`)

| Template                        | Target                              | Purpose                                      |
| ------------------------------- | ----------------------------------- | -------------------------------------------- |
| `core/pipes/validation.pipe.ts` | `src/core/pipes/validation.pipe.ts` | Global validation with whitelist + transform |

### Shared (`src/shared/`)

| Template                                     | Target                                           | Purpose                                                        |
| -------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------- |
| `shared/dtos/response-payload.dto.ts`        | `src/shared/dtos/response-payload.dto.ts`        | `ResponsePayloadDto`, `ErrorDetailDto`, `PaginatedResponseDto` |
| `shared/dtos/pagination.dto.ts`              | `src/shared/dtos/pagination.dto.ts`              | `PaginationDto` with class-validator                           |
| `shared/interfaces/jwt-payload.interface.ts` | `src/shared/interfaces/jwt-payload.interface.ts` | `IJwtPayload` interface                                        |

### Infrastructure (`src/infrastructure/`)

| Template                                | Target                                      | Purpose                                       |
| --------------------------------------- | ------------------------------------------- | --------------------------------------------- |
| `infrastructure/token/token.service.ts` | `src/infrastructure/token/token.service.ts` | JWT token generation with remember-me support |
| `infrastructure/token/token.module.ts`  | `src/infrastructure/token/token.module.ts`  | Global token module                           |

### Entry Point

| Template  | Target        | Purpose                                                       |
| --------- | ------------- | ------------------------------------------------------------- |
| `main.ts` | `src/main.ts` | Bootstrap with cookieParser, CORS, global middleware, Swagger |

## Customization Checklist

After copying, search for `// TODO: CUSTOMIZE` and update:

1. **`env-config.service.ts`** — Add project-specific config methods, update `ensureValues` list
2. **`jwt.strategy.ts`** — Adjust `validate()` return shape for your user model
3. **`jwt-payload.interface.ts`** — Add/remove fields for your user model
4. **`main.ts`** — Update Swagger title and description
5. **`roles.decorator.ts`** — Optionally narrow `string[]` to your `RoleEnum`

## Auth Controller Usage

With `SetTokenInterceptor` and `RemoveTokenInterceptor`:

```typescript
// Use relative imports — or adjust to your project's tsconfig path aliases
import {
  SetTokenInterceptor,
  RemoveTokenInterceptor,
} from "../core/interceptors";
import { Public, CurrentUser } from "../core/decorators";

@Controller("auth")
export class AuthController {
  @Post("login")
  @Public()
  @UseInterceptors(SetTokenInterceptor)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("register")
  @Public()
  @UseInterceptors(SetTokenInterceptor)
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("refresh")
  @Public()
  @UseInterceptors(SetTokenInterceptor)
  async refresh(@Req() req: Request) {
    const refreshToken = req.cookies?.refresh_token;
    return this.authService.refreshAccessToken(refreshToken);
  }

  @Post("logout")
  @UseInterceptors(RemoveTokenInterceptor)
  async logout(@CurrentUser() user: IJwtPayload) {
    return this.authService.logout(user);
  }
}
```

## Required Environment Variables

```env
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DATABASE=mydb

# Auth
AUTH_JWT_SECRET=your-secret-key-change-in-production
AUTH_TOKEN_COOKIE_NAME=your-access-token-cookie-name
AUTH_TOKEN_EXPIRE_TIME=86400
AUTH_TOKEN_EXPIRE_TIME_REMEMBER_ME=2592000
AUTH_REFRESH_TOKEN_COOKIE_NAME=your-refresh-token-cookie-name
AUTH_REFRESH_TOKEN_EXPIRE_TIME=2592000

# App
MODE=DEV
FRONTEND_URL=http://localhost:5173
PORT=3000
```

## Related Guides

Templates implement the patterns described in:

- `guides/authentication-cookies.md` — Cookie auth architecture
- `guides/architecture-overview.md` — 4-layer pattern
- `guides/middleware-guide.md` — Guards, interceptors, filters, pipes
- `guides/setup-role-base-access.md` — RBAC patterns
- `guides/configuration.md` — UnifiedConfig/envConfigService pattern
