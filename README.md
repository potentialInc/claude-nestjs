# Claude NestJS

Claude Code configuration for NestJS backend development. This is a framework-specific submodule designed to be used alongside `claude-base` (shared/generic config).

## Agents (10)

| Agent | Model | Team | Description |
|-------|-------|------|-------------|
| **backend-developer** | opus | team-backend (leader) | End-to-end NestJS development from PRD to tested API |
| **auth-route-debugger** | sonnet | team-backend | Debug 401/403 errors, JWT, cookies, route registration |
| **cache-manager** | sonnet | team-backend | Redis caching, @Cacheable/@CacheInvalidate, TTL optimization |
| **auto-error-resolver** | sonnet | team-quality | TypeScript compilation error fixing |
| **compliance-checker** | sonnet | team-quality | Audits 35 mandatory NestJS rules with auto-fix |
| **gap-finder** | sonnet | team-quality | Missing endpoints, Swagger, DTOs, auth guards |
| **code-architecture-reviewer** | sonnet | team-quality | Four-layer architecture adherence review |
| **refactor-planner** | sonnet | team-quality | Refactoring analysis and step-by-step plans |
| **documentation-architect** | sonnet | team-docs | API docs, architecture diagrams, module README |
| **gap-finder** | sonnet | team-quality | NestJS-specific implementation gap analysis |

## Guides (19)

| Guide | Description |
|-------|-------------|
| architecture-overview.md | Four-layer pattern, module workflow, I18nHelper, size constraints |
| best-practices.md | I18nHelper, UnifiedConfig, enum centralization, pagination defaults |
| routing-and-controllers.md | BaseController, @Public(), Swagger, rate limiting, HTTP status codes |
| services-and-repositories.md | BaseService/BaseRepository, no direct TypeORM, exception handling |
| database-patterns.md | Entity patterns, relationships, indexes, soft delete, migrations |
| validation-patterns.md | class-validator, DTO naming, I18nHelper for messages |
| authentication-cookies.md | httpOnly cookies, JWT, token refresh, RBAC guards |
| middleware-guide.md | Guards, interceptors, pipes, filters, execution order |
| async-and-errors.md | Async/await, error handling patterns |
| configuration.md | UnifiedConfig, environment management |
| testing-guide.md | Jest testing strategies, coverage targets |
| update-swagger.md | Swagger/OpenAPI documentation |
| sentry-and-monitoring.md | Error tracking and monitoring |
| setup-role-base-access.md | RBAC implementation guide |
| nestjs-backend-guide.md | Comprehensive NestJS backend reference |
| workflow-design-database.md | Design database schema from requirements |
| workflow-generate-api-docs.md | Generate API documentation from controllers |
| workflow-generate-e2e-tests.md | Generate end-to-end tests |
| workflow-implement-redis-caching.md | Implement Redis caching |
| workflow-convert-prd-to-knowledge.md | Convert PRD to project knowledge |

## Skills (8)

| Skill | Trigger | Description |
|-------|---------|-------------|
| backend-dev-guidelines | `backend:` | NestJS architecture patterns (agent reference) |
| api-development | `api:` | Build NestJS endpoints (4-layer) |
| e2e-testing | `e2e:` | Jest + Supertest testing patterns |
| database-seeding | `seed:` | Create seed files with _fixtures.yaml |
| debugging | `debug:` | Debug NestJS errors systematically |
| organize-types | — | Manage DTOs, entities, TypeORM types |
| enum-sync | — | Bidirectional enum sync (requires base) |
| compliance-check | `compliance:` | Audit 35 mandatory rules |

## Hooks (7)

| Hook | Type | Description |
|------|------|-------------|
| tsc-check.sh | Stop | TypeScript compilation check after edits |
| project-auto-fix.sh | Stop | Auto-lint, format, type-check on changes |
| backend-cleanup.ts | Stop | Remove unused files after implementation |
| backend-cleanup.js | Runtime | Compiled cleanup script |
| auto-fix-config.json | Config | Auto-fix configuration |
| backend-cleanup-config.json | Config | Cleanup rules and exclusions |
| project-auto-fix.ts | Source | Auto-fix TypeScript source |

## Other Contents

- **examples/** — Complete working code examples

## Dependencies

**Required**: The `claude-base` submodule must be present at `.claude/base/` for full functionality. Some skill-rules and agent references use `../../base/` paths (e.g., `sync-enums.md`, `SECURITY_AND_OPTIMIZATION.md`) that resolve to the base submodule.

## Usage

```bash
git submodule add https://github.com/potentialInc/claude-nestjs.git .claude/nestjs
```

## Related Repos

- [claude-base](https://github.com/potentialInc/claude-base) - Shared/generic Claude Code config (REQUIRED)
- [claude-react](https://github.com/potentialInc/claude-react) - React-specific Claude Code config
