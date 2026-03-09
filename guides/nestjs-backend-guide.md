# NestJS Backend Development Guide

> Unified navigation guide for NestJS backend development.
> This guide links to detailed guides — read them for patterns and rules.

---

## Module Implementation Workflow

| Step | Action | Guide |
|------|--------|-------|
| 1 | **Read mandatory rules** | `best-practices.md` |
| 2 | **Plan** — Review PROJECT_API.md and PROJECT_DATABASE.md | — |
| 3 | **Entity** — Create in `src/modules/[module]/entities/` | `database-patterns.md` |
| 4 | **Repository** — Create in `src/modules/[module]/repositories/` | `services-and-repositories.md` |
| 5 | **Service** — Create in `src/modules/[module]/services/` | `services-and-repositories.md`, `async-and-errors.md` |
| 6 | **Controller** — Create in `src/modules/[module]/controllers/` | `routing-and-controllers.md` |
| 7 | **DTOs** — Create in `src/modules/[module]/dto/` | `validation-patterns.md` |
| 8 | **Module** — Register in `[module].module.ts` and `app.module.ts` | `architecture-overview.md` |
| 9 | **Migration** — Generate and run | `database-patterns.md` |
| 10 | **Test** — Create E2E tests, verify auth | `testing-guide.md`, `workflow-generate-e2e-tests.md` |
| 11 | **Build & Verify** — TypeScript compilation, runtime startup | `best-practices.md` |

---

## Delegation to nestjs-specialist

| Factor | Handle Yourself | Delegate |
|--------|-----------------|----------|
| Lines of Code | < 200 LOC/file | > 200 LOC/file |
| Dependencies | < 3 external services | >= 3 external services |
| Relationships | <= 3 entity relationships | > 3 entity relationships |
| Patterns | CRUD, basic auth, validation | CQRS, Event Sourcing, Microservices |
| Query Complexity | Simple joins, basic filters | Subqueries, CTEs, window functions |

---

## Guide Reference by Task Type

| Task Type | Required Guides |
|-----------|-----------------|
| **New Module (Full CRUD)** | best-practices.md, architecture-overview.md, database-patterns.md, services-and-repositories.md, routing-and-controllers.md, validation-patterns.md |
| **New Endpoint** | best-practices.md, routing-and-controllers.md, validation-patterns.md |
| **Database Changes** | best-practices.md, database-patterns.md, workflow-design-database.md |
| **Authentication** | best-practices.md, authentication-cookies.md, middleware-guide.md |
| **Testing** | workflow-generate-e2e-tests.md, testing-guide.md |
| **Error Handling** | best-practices.md, async-and-errors.md, sentry-and-monitoring.md |
| **Caching** | best-practices.md, workflow-implement-redis-caching.md |
| **RBAC** | best-practices.md, setup-role-base-access.md, middleware-guide.md |

---

## Quality Standards

- **Architecture**: Strictly follow four-layer pattern (see `architecture-overview.md`)
- **Type Safety**: All code must pass strict TypeScript checking
- **Validation**: Use class-validator in DTOs, not in services (see `validation-patterns.md`)
- **Documentation**: Complete Swagger/OpenAPI via `@ApiSwagger()` (see `update-swagger.md`)
- **Error Handling**: Use I18nHelper for messages, HTTP exceptions from services (see `best-practices.md`)
- **Security**: HTTP-only cookies for auth, validate all input (see `authentication-cookies.md`)
- **Performance**: Add indexes, paginate list endpoints (see `database-patterns.md`)
- **Migrations**: Always generate and test, support rollback (see `database-patterns.md`)

---

## Output Format

When completing tasks, provide:

1. **Files Created/Modified** — List all entity, repository, service, controller, DTO files
2. **Module Structure** — Show the four-layer structure
3. **API Endpoints** — List all endpoints with methods and paths
4. **Database Changes** — Document entities and migrations created
5. **Status Updates** — Confirm status files updated
6. **Next Steps** — Suggest follow-up work (testing, integration, optimization)
