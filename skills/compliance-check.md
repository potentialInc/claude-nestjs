# Backend Compliance Check Skill

Ralph workflow skill for auditing NestJS backend modules against 35 mandatory architecture rules.

## Workflow: `rule-check-backend`

**Ralph trigger:** Run after backend phase (Phase 5) completes and after integration phase (Phase 7) completes.
**Agent:** `.claude/nestjs/agents/compliance-checker.md`
**Mode:** Autonomous loop — each iteration audits one backend module.
**Exit criteria:** All items PASS (0 Critical + 0 High violations) or max 2 fix rounds per item.

This skill is executed by Ralph in an autonomous loop. Each iteration audits one backend module.

## Item Discovery

```bash
# Modules (one item per module directory)
ls -d backend/src/modules/*/

# Global checks (one item for core/shared infrastructure)
ls backend/src/core/ backend/src/shared/ backend/src/main.ts
```

Each module directory = one item in the status file. Core/shared = one additional item.

## Per-Item Instructions

For each backend module (`backend/src/modules/{module}/`):

1. **List files**: `fd -e ts backend/src/modules/{module}/`
2. **Run compliance checks** (from `.claude/nestjs/agents/compliance-checker.md`):

### Quick Check Commands — Per Module

```bash
# Rule 1 (CRITICAL): Base class inheritance
rg "class \w+Controller" --glob '*.ts' backend/src/modules/{module}/ | rg -v "extends BaseController"
rg "class \w+Service" --glob '*.ts' backend/src/modules/{module}/ | rg -v "extends BaseService"
rg "class \w+Repository" --glob '*.ts' backend/src/modules/{module}/ | rg -v "extends BaseRepository"
rg "class \w+ " --glob '*entity*' backend/src/modules/{module}/ | rg -v "extends BaseEntity"

# **R1 Exceptions:** Skip R1 for controller + service if the module has NO `*.entity.ts` file
# (aggregation/workflow/auth modules that don't own an entity are exempt from base class rules for controller + service)

# Rule 2 (HIGH): I18nHelper usage — no hardcoded exception strings
rg "throw new \w+Exception\('[^']+'\)" --glob '*.ts' backend/src/modules/{module}/

# Rule 3 (HIGH): No try/catch in controllers
rg "try \{" --glob '*controller*' backend/src/modules/{module}/

# Rule 4 (HIGH): No business logic in controllers
rg "(Repository|getRepository|InjectRepository)" --glob '*controller*' backend/src/modules/{module}/

# Rule 5 (HIGH): No direct TypeORM in services
rg "(getRepository|getConnection|createQueryBuilder)" --glob '*service*' backend/src/modules/{module}/

# Rule 7 (MEDIUM): No process.env
rg "process\.env" --glob '*.ts' backend/src/modules/{module}/

# Rule 9 (MEDIUM): Swagger docs
rg "@Controller" --glob '*.ts' backend/src/modules/{module}/ -l | xargs rg -L "@ApiTags"

# Rule 10 (HIGH): Hardcoded enum strings
rg "=== '[a-z]+'" --glob '*.ts' backend/src/modules/{module}/ | rg -v "enums/"

# Rule 20 (HIGH): Enums defined inside module (should be in shared/enums)
rg "export enum" --glob '*.ts' backend/src/modules/{module}/

# Rule 22 (HIGH): Shared decorators trapped in module
rg "export (const|function) (CurrentUser|Public|Roles|ApiSwagger)" --glob '*.ts' backend/src/modules/{module}/

# Rule 24 (HIGH): Raw entity returns (no response DTO)
rg "return (await )?this\.(service|repository)\.\w+\(" --glob '*controller*' backend/src/modules/{module}/

# Rule 30 (HIGH): any type usage
rg ": any\b|as any\b" --glob '*.ts' backend/src/modules/{module}/ | rg -v "test|spec|\.d\.ts"

# Rule 32 (HIGH): DTOs without class-validator decorators
fd "create|update" backend/src/modules/{module}/ --glob '*.dto.ts' | xargs rg -L "@Is|@Min|@Max|@Length|@Matches|@IsNotEmpty|@IsOptional" 2>/dev/null

# Rule 33 (HIGH): File uploads without validation
rg "FileInterceptor|FilesInterceptor" --glob '*.ts' backend/src/modules/{module}/ -l | xargs rg -L "ParseFilePipe|MaxFileSizeValidator|FileTypeValidator" 2>/dev/null

# Rule 34 (CRITICAL): Plain Error throws (not HttpException)
rg "throw new Error\(" --glob '*.ts' backend/src/modules/{module}/
```

### Quick Check Commands — Global (Core/Shared/Infrastructure)

```bash
# Rule 11 (CRITICAL): Global exception filter exists and registered
fd "exception" backend/src/core/ backend/src/shared/ --glob '*.filter.ts'
rg "useGlobalFilters" backend/src/main.ts

# Rule 12 (HIGH): Response transform interceptor
fd "transform" backend/src/core/ backend/src/shared/ --glob '*.interceptor.ts'
rg "useGlobalInterceptors" backend/src/main.ts

# Rule 13 (HIGH): Shared response DTOs exist
fd "success-response|paginated-response|base-response|error-response" backend/src/shared/ backend/src/core/ --glob '*.dto.ts'

# Rule 14 (MEDIUM): Shared interfaces
fd "base.service.interface|base.repository.interface|base-service|base-repository" backend/src/core/ --glob '*.interface.ts'

# Rule 15 (CRITICAL): No synchronize: true
rg "synchronize:\s*true" backend/src/ --glob '*.ts'

# Rule 16 (HIGH): BaseEntity has all standard fields
rg "PrimaryGeneratedColumn|CreateDateColumn|UpdateDateColumn|DeleteDateColumn" backend/src/core/base/base.entity.ts

# Rule 17 (MEDIUM): Logging interceptor exists
fd "logging" backend/src/core/ backend/src/shared/ --glob '*.interceptor.ts'

# Rule 18 (HIGH): Environment validation schema
rg "validationSchema" backend/src/ --glob '*.ts'
rg "Joi\.object" backend/src/ --glob '*.ts'

# Rule 19 (MEDIUM): File upload validation pipe
rg "@UseInterceptors\(FileInterceptor" backend/src/ --glob '*.ts' -l | xargs rg -L "ParseFilePipe" 2>/dev/null

# Rule 21 (CRITICAL): No plaintext passwords
rg "Password123|password123|admin123|Admin@123|default.*password" backend/src/ --glob '*.ts'
rg "password.*=.*['\"][^'\"]{3,}['\"]" backend/src/ --glob '*.ts' | rg -v "\.env|\.example|test|spec|\.d\.ts"

# Rule 23 (MEDIUM): Aggregation module structure
for dir in backend/src/modules/*/; do
  entity_count=$(fd -e ts --glob '*entity*' "$dir" 2>/dev/null | wc -l)
  controller_count=$(fd -e ts --glob '*controller*' "$dir" 2>/dev/null | wc -l)
  if [ "$entity_count" -eq 0 ] && [ "$controller_count" -gt 0 ]; then
    echo "AGGREGATION MODULE (verify pattern): $dir"
  fi
done

# Rule 25 (HIGH): Seed uses repository methods (no raw SQL)
rg "INSERT INTO|CREATE TABLE|DROP TABLE|DELETE FROM" backend/src/ --glob '*.ts' | rg -v "migration|\.migration\."

# Rule 26 (MEDIUM): Health check is real (not static)
rg "health|Health" backend/src/ --glob '*controller*' -A 10

# Rule 27 (MEDIUM): Cookie config not duplicated
rg "res\.cookie\(" backend/src/modules/ --glob '*.ts' -c

# Rule 28 (MEDIUM): Config file size
wc -l backend/src/config/*.ts 2>/dev/null

# Rule 29 (HIGH): Database connection config
rg "TypeOrmModule.forRoot|TypeOrmModule.forRootAsync|DataSource" backend/src/ --glob '*.ts' -A 15

# Rule 31 (MEDIUM): Constants directory exists
[ ! -d "backend/src/shared/constants" ] && [ ! -d "backend/src/core/constants" ] && echo "MISSING: constants directory"

# Rule 35 (HIGH): Seed script architecture
fd "seed" backend/src/database/ --glob '*.ts' | xargs rg -L "upsert|findOne|findOneBy" 2>/dev/null
fd "seed" backend/src/database/ --glob '*.ts' | xargs rg -L "_fixtures|fixtures\.yaml" 2>/dev/null
fd "seed" backend/src/database/ --glob '*.ts' | xargs rg -L "bcrypt|hash" 2>/dev/null
```

3. **Report violations** with file:line references
4. **Mark initial result**: PASS (0 Critical + 0 High) or FAIL

5. **Auto-fix violations** (if item is FAIL):
   - Read the auto-fix instructions from `.claude/nestjs/agents/compliance-checker.md` (Auto-Fix Instructions section)
   - Read all affected files in the module
   - Fix in priority order: CRITICAL → HIGH → MEDIUM
   - Apply the appropriate fix pattern for each rule violation found
   - For R1: Check accepted exceptions first (no entity file = aggregation module, skip controller/service R1)

6. **Verify fix** — Re-run the Quick Check Commands above for this module
   - If new violations appear from the fix, fix those too (max 2 retry rounds)
   - Run `npx tsc --noEmit` from the backend directory to ensure no TypeScript errors

7. **Update final status**:
   - All Critical + High resolved → mark PASS
   - Some remain → mark FAIL with list of unfixable violations and reason
   - Add "Fixed: N violations" to Notes column

## Success Criteria Per Item

- 0 Critical violations (Rules 1, 6, 11, 15, 21, 34)
- 0 High violations (Rules 2, 3, 4, 5, 10, 12, 13, 16, 18, 20, 22, 24, 25, 29, 30, 32, 33, 35)
- Medium violations documented but don't block PASS (Rules 7, 8, 9, 14, 17, 19, 23, 26, 27, 28, 31)
- All fixes verified with `npx tsc --noEmit`

## Rule Foundations

Rules are derived from these authoritative guides:

| Rule Area | Guide Reference |
|-----------|----------------|
| Base classes | [architecture-overview.md](../guides/architecture-overview.md) |
| I18nHelper | [best-practices.md](../guides/best-practices.md) |
| UnifiedConfig | [best-practices.md](../guides/best-practices.md#unifiedconfig--no-direct-processenv) |
| Validation/DTOs | [validation-patterns.md](../guides/validation-patterns.md) |
| Controllers | [routing-and-controllers.md](../guides/routing-and-controllers.md) |
| Services | [services-and-repositories.md](../guides/services-and-repositories.md) |
| Auth/Guards | [authentication-cookies.md](../guides/authentication-cookies.md) |
| Middleware | [middleware-guide.md](../guides/middleware-guide.md) |
| Database | [database-patterns.md](../guides/database-patterns.md) |
| Security | `.claude/base/docs/SECURITY_AND_OPTIMIZATION.md` |
