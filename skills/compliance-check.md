# Backend Compliance Check Skill

Ralph workflow skill for auditing NestJS backend modules against mandatory rules.

## Workflow: `rule-check-backend`

This skill is executed by Ralph in an autonomous loop. Each iteration audits one backend module.

## Item Discovery

```bash
ls -d backend/src/modules/*/
```

Each module directory = one item in the status file.

## Per-Item Instructions

For each backend module (`backend/src/modules/{module}/`):

1. **List files**: `fd -e ts backend/src/modules/{module}/`
2. **Run compliance checks** (from `.claude/nestjs/agents/compliance-checker.md`):

### Quick Check Commands

```bash
# Rule 1 (CRITICAL): Base class inheritance
rg "class \w+Controller" --glob '*.ts' backend/src/modules/{module}/ | rg -v "extends BaseController"
rg "class \w+Service" --glob '*.ts' backend/src/modules/{module}/ | rg -v "extends BaseService"
rg "class \w+Repository" --glob '*.ts' backend/src/modules/{module}/ | rg -v "extends BaseRepository"
rg "class \w+ " --glob '*entity*' backend/src/modules/{module}/ | rg -v "extends BaseEntity"

# **R1 Exceptions:** Skip R1 for controller + service if the module has NO `*.entity.ts` file
# (aggregation/workflow/auth modules that don't own an entity are exempt from base class rules for controller + service)

# Rule 2 (HIGH): I18nHelper usage
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

- 0 Critical violations
- 0 High violations
- Medium/Low violations documented but don't block PASS
- All fixes verified with `npx tsc --noEmit`
