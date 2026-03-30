# NestJS Agent Team Registry

Stack-specific agents for the NestJS backend, organized by team with invocation patterns.

---

## Organization

```
          project-coordinator (base)
                |
         backend-developer (leader)
          /       |        \
   database-  cache-    auth-route-
   designer   manager   debugger
   (base)

   Quality Team (reports to quality-lead in base):
   - compliance-checker
   - gap-finder
   - code-architecture-reviewer
   - refactor-planner

   Docs Team (reports to documentation-architect in base):
   - documentation-architect
```

---

## Team: Backend Engineering (team-backend)

### Leader: backend-developer

**Specialty:** End-to-end NestJS development from PRD to tested API, four-layer architecture
**Model:** opus | **Type:** backend

**Invocation:**
```
Task(
  subagent_type='backend-developer',
  description='Implement [module] API',
  prompt='Implement [module] following four-layer architecture. Read .claude/base/docs/SECURITY_AND_OPTIMIZATION.md and .claude/nestjs/guides/best-practices.md first. Create entity, repository, service, controller, and DTOs.'
)
```

### Members

#### auth-route-debugger
**Specialty:** JWT Bearer auth debugging, 401/403 errors, cookie problems, route registration
**Called by:** backend-developer

```
Task(
  subagent_type='auth-route-debugger',
  description='Debug auth issue on [route]',
  prompt='Team: team-backend, Leader: backend-developer. Debug authentication issue on [route] — check JWT strategy, guards, decorators, and cookie extraction.'
)
```

#### cache-manager
**Specialty:** Redis caching, @Cacheable/@CacheInvalidate decorators, TTL optimization
**Called by:** backend-developer

```
Task(
  subagent_type='cache-manager',
  description='Implement caching for [module]',
  prompt='Team: team-backend, Leader: backend-developer. Design cache strategy for [module]. Reference .claude/nestjs/guides/workflow-implement-redis-caching.md.'
)
```

---

## Quality Team Members (reports to quality-lead in base)

#### compliance-checker
**Specialty:** 35 mandatory NestJS rule audits with auto-fix
**Called by:** quality-lead, backend-developer

```
Task(
  subagent_type='compliance-checker',
  description='Audit NestJS code compliance',
  prompt='Team: team-quality. Scan [SCAN_ROOT] for NestJS compliance violations and auto-fix. Check base classes, I18nHelper, controllers, auth, config, enum sync, etc.'
)
```

#### gap-finder
**Specialty:** Missing endpoints, Swagger docs, DTO validation, auth guards, error handling
**Called by:** quality-lead, base gap-finder

```
Task(
  subagent_type='gap-finder',
  description='Find NestJS implementation gaps',
  prompt='Team: team-quality. Scan [SCAN_ROOT] for NestJS-specific implementation gaps.'
)
```

#### code-architecture-reviewer
**Specialty:** Four-layer architecture adherence, base class inheritance, code quality review
**Called by:** quality-lead, backend-developer

```
Task(
  subagent_type='code-architecture-reviewer',
  description='Review [module] architecture',
  prompt='Team: team-quality. Review [module] code for architectural consistency, base class usage, and best practices.'
)
```

#### refactor-planner
**Specialty:** Refactoring analysis, technical debt identification, step-by-step migration plans
**Called by:** quality-lead, code-architecture-reviewer

```
Task(
  subagent_type='refactor-planner',
  description='Plan [module] refactoring',
  prompt='Team: team-quality. Analyze [module] structure and create comprehensive refactoring plan with risk assessment.'
)
```

---

## Docs Team Member

#### documentation-architect
**Specialty:** API docs, architecture diagrams, module README, Swagger examples
**Called by:** documentation-architect (base), backend-developer

```
Task(
  subagent_type='documentation-architect',
  description='Document [module] API',
  prompt='Team: team-docs. Create comprehensive documentation for [module] including API endpoints, data flow, and examples.'
)
```

---

## Framework Resources

When typed agents are invoked, they receive:
- **Guides**: `.claude/nestjs/guides/`
- **Skills**: `.claude/nestjs/skills/`
- **Hooks**: `.claude/nestjs/hooks/`
- **Examples**: `.claude/nestjs/examples/`
