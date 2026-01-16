# Claude NestJS

Claude Code configuration for NestJS backend development. This is a framework-specific submodule designed to be used alongside `claude-base` (shared/generic config).

## Contents

### Agents
- **backend-developer.md** - End-to-end backend development from PRD to API implementation
- **auth-route-debugger.md** - Debug authentication issues with API routes
- **auth-route-tester.md** - Test routes after implementing or modifying them

### Skills

```
skills/
├── skill-rules.json           # Skill trigger configuration
├── invocable/                 # Invocable skills (with YAML metadata)
│   ├── test-routes.md         # JWT authentication testing patterns
│   └── track-errors/          # Sentry error tracking integration
│       └── SKILL.md
├── guidelines/                # Step-by-step instruction guides
│   ├── generate-api-docs.md   # API documentation generation
│   ├── generate-e2e-tests.md  # E2E test generation
│   ├── design-database-schema.md  # Database design with TypeORM
│   └── convert-prd-to-knowledge.md  # PRD to knowledge conversion
└── resources/                 # Reference documentation
    └── implement-redis-caching.md  # Redis caching patterns
```

### Hooks
- **tsc-check.sh** - TypeScript compilation checking for backend services

### Docs
- **BEST_PRACTICES.md** - NestJS coding standards, error handling, database patterns
- **guides/best-practices.md** - Includes CRITICAL RULES: I18nHelper usage, check existing APIs first

## Usage

Add as a git submodule to your project:

```bash
git submodule add https://github.com/potentialInc/claude-nestjs.git .claude/nestjs
```

### Project Structure

```
.claude/
├── base/      # Generic/shared config (git submodule)
├── nestjs/    # This repo (git submodule)
├── react/     # React-specific config (git submodule) - optional
└── settings.json
```

### Update settings.json

Reference agents and hooks from this submodule:

```json
{
  "hooks": {
    "Stop": ["./nestjs/hooks/tsc-check.sh"]
  }
}
```

## Related Repos

- [claude-base](https://github.com/potentialInc/claude-base) - Shared/generic Claude Code config
- [claude-react](https://github.com/potentialInc/claude-react) - React-specific Claude Code config
