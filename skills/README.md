# NestJS Skills Directory

Comprehensive skill library for NestJS backend development following Anthropic's best practices for Claude Code.

---

## 📚 Skills Index

### Backend Development

#### [backend-dev-guidelines](../agents/backend-developer.md)
**Type**: Agent | **Priority**: High

Complete end-to-end backend development workflow from PRD analysis to tested APIs.

**Triggers**: `backend`, `nestjs`, `api`, `controller`, `service`, `entity`, `dto`, `module`

**Use When**:
- Implementing new features from PRD
- Creating new API endpoints
- Setting up new modules
- Following four-layer architecture

---

### Debugging & Quality

#### [debugging](debugging/fix-bug.md)
**Type**: Skill | **Priority**: Medium

Structured approach to debugging and fixing NestJS bugs including HTTP exceptions, TypeORM errors, and authentication issues.

**Triggers**: `fix bug`, `debug`, `nestjs error`, `typescript error`, `500 error`, `400 error`, `typeorm error`

**Use When**:
- Encountering HTTP exceptions (400, 401, 403, 404, 500)
- Debugging TypeORM/database errors
- Fixing authentication/guard issues
- Resolving dependency injection problems

#### [organize-types](code-quality/organize-types.md)
**Type**: Skill | **Priority**: Medium

Analyze and maintain TypeScript type organization following NestJS module structure.

**Triggers**: `organize types`, `typescript types`, `type organization`, `dto types`, `entity types`, `barrel exports`

**Use When**:
- Adding new API endpoints
- Creating new modules
- Refactoring services
- Before releases

---

### Testing

#### [e2e-testing](e2e-testing/SKILL.md)
**Type**: Skill | **Priority**: High

Comprehensive guide for E2E testing including test generation, fixtures, and API testing patterns using Jest and Supertest.

**Triggers**: `e2e test`, `generate test`, `create test`, `test controller`, `test api`, `jest fixtures`, `supertest`, `api testing`

**Use When**:
- Generating tests for new endpoints
- Setting up test infrastructure
- Creating test fixtures and factories
- Writing API integration tests
- Testing CRUD operations
- Validating authentication/authorization

**Includes**:
- Quick start templates
- Test infrastructure setup
- Fixture patterns (user, auth, entity factories)
- API testing patterns (HTTP methods, assertions)
- Test checklist and best practices

**Reference Files**:
- [Mock Factories](e2e-testing/resources/mock-factories.md) - Service and repository mocks
- [CRUD Patterns](e2e-testing/resources/crud-patterns.md) - Complete CRUD test suites
- [Auth Patterns](e2e-testing/resources/auth-patterns.md) - Authentication & authorization tests

---

## 🎯 Quick Start

### For New Features

1. **Design & Plan**: Use [backend-dev-guidelines](../agents/backend-developer.md) agent
2. **Implement**: Follow four-layer architecture (Controller → Service → Repository → Entity)
3. **Test**: Use [e2e-testing](e2e-testing/SKILL.md) to create comprehensive tests
4. **Quality Check**: Run [organize-types](code-quality/organize-types.md) before commit

### For Bug Fixes

1. **Debug**: Use [debugging](debugging/fix-bug.md) to identify issue
2. **Fix**: Apply appropriate solution pattern
3. **Test**: Verify fix with existing or new tests
4. **Validate**: Run full test suite

### For Testing

1. **Setup**: Use [e2e-testing](e2e-testing/SKILL.md) for complete testing workflow:
   - Test infrastructure setup
   - Fixture creation (users, auth, entities)
   - API testing patterns (GET, POST, PATCH, DELETE)
   - Mock factories for services and repositories

---

## 📖 Skill Structure

Each skill follows Anthropic's best practices:

### ✅ Required Components

1. **YAML Frontmatter**: Metadata for auto-discovery
   ```yaml
   ---
   skill_name: my-skill
   applies_to_local_project_only: true
   auto_trigger_regex: [keyword1, keyword2]
   tags: [tag1, tag2]
   related_skills: [skill1, skill2]
   ---
   ```

2. **Main Content**: Under 500 lines following progressive disclosure
3. **Reference Files**: Detailed content in `resources/` subdirectory
4. **Related Links**: Cross-references to related skills and guides

### 📁 Directory Structure

```
.claude/nestjs/skills/
├── README.md                           # This file
├── skill-rules.json                    # Trigger configuration
├── debugging/
│   └── fix-bug.md                      # Debugging guide
├── code-quality/
│   └── organize-types.md               # Type organization
└── e2e-testing/
    ├── SKILL.md                        # Unified E2E testing guide
    └── resources/                      # Reference files
        ├── mock-factories.md           # Mock patterns
        ├── crud-patterns.md            # CRUD test patterns
        └── auth-patterns.md            # Auth test patterns
```

---

## 🔍 How Skills Are Triggered

Skills are automatically suggested by Claude based on:

1. **Keywords**: Explicit mentions in your prompt
2. **Intent Patterns**: Action phrases (e.g., "create endpoint", "fix bug", "generate test")
3. **File Paths**: Working with specific file types (e.g., `*.e2e-spec.ts`)
4. **Content Patterns**: Code patterns detected in files

Configuration: [skill-rules.json](skill-rules.json)

---

## 🔗 Related Resources

### Guides (../guides/)
- [architecture-overview.md](../guides/architecture-overview.md) - Four-layer architecture
- [best-practices.md](../guides/best-practices.md) - Project coding standards
- [database-patterns.md](../guides/database-patterns.md) - TypeORM patterns
- [testing-guide.md](../guides/testing-guide.md) - Complete testing strategy
- [validation-patterns.md](../guides/validation-patterns.md) - DTO validation
- [middleware-guide.md](../guides/middleware-guide.md) - Guards, interceptors, pipes
- [async-and-errors.md](../guides/async-and-errors.md) - Error handling

### Agents (../agents/)
- [backend-developer.md](../agents/backend-developer.md) - Full-stack backend workflow agent

---

## 📊 Statistics

- **Total Skills**: 4 (1 agent + 3 skill documents)
- **Skills with YAML Frontmatter**: 4/4 (100%)
- **Skills Under 500 Lines**: 4/4 (100%)
- **Reference Files**: 3 (mock-factories, crud-patterns, auth-patterns)
- **Total Trigger Keywords**: 50+
- **Coverage**: Backend development, debugging, code quality, E2E testing (unified)

---

## 🎓 Best Practices

### For Skill Creators

1. **Keep main file under 500 lines** - Use progressive disclosure
2. **Add comprehensive YAML frontmatter** - Include all trigger keywords
3. **Use reference files** for detailed content
4. **Add table of contents** for files > 100 lines
5. **Cross-link related skills** - Help discovery
6. **Include practical examples** - Real code from the project
7. **Test triggers** - Verify keywords work as expected

### For Skill Users

1. **Use specific keywords** - More likely to trigger relevant skills
2. **Reference file paths** - Automatically trigger file-based skills
3. **Describe intent clearly** - Help intent pattern matching
4. **Check related resources** - Explore reference files for advanced patterns

---

## 🔧 Maintenance

### Adding New Skills

1. Create skill file in appropriate subdirectory
2. Add YAML frontmatter with all required fields
3. Keep main content under 500 lines
4. Create reference files in `resources/` if needed
5. Update [skill-rules.json](skill-rules.json)
6. Add entry to this README
7. Test triggers with sample prompts

### Updating Existing Skills

1. Maintain YAML frontmatter accuracy
2. Keep line count under 500
3. Update [skill-rules.json](skill-rules.json) if triggers change
4. Update cross-references in related skills
5. Update this README if description changes

---

## 📝 Skill Development Guide

For detailed information on creating and managing skills, see:
- [Skill Developer Guide](../../base/skills/skill-developer/SKILL.md)

---

## ✅ Compliance Status

**Last reviewed and updated**: 2026-03-30

- **Total Skills**: 8 (1 agent reference + 7 skill documents)
- ✅ YAML frontmatter added to all skills
- ✅ All skills under 500-line limit
- ✅ Progressive disclosure implemented
- ✅ Reference files created for detailed content
- ✅ skill-rules.json v2.0 aligned with claude-workflow base architecture
- ✅ skill-rules.json aligned with frontmatter
- ✅ Cross-references updated
- ✅ E2E testing consolidated into single comprehensive skill
- ✅ README updated with consolidated structure

### Consolidation Changes

**Merged**: `e2e-test-generator`, `jest-fixtures`, and `supertest-patterns` → **`e2e-testing`**

This consolidation provides:
- Single entry point for all E2E testing needs
- Unified workflow from setup to execution
- Better discoverability with comprehensive triggers
- Clear progressive disclosure to reference materials
- Reduced maintenance overhead

---

**Last Updated**: 2026-01-16
**Version**: 2.0 (Consolidated)
**Status**: Production Ready ✅
