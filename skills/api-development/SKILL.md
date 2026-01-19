---
skill_name: api-development
applies_to_local_project_only: true
auto_trigger_regex: [
  api development,
  develop api,
  create api,
  implement api,
  build endpoint,
  create endpoint,
  backend api,
  nestjs api,
  controller service,
  create controller,
  create service,
  typeorm entity,
  prd to api
]
tags: [backend, api, nestjs, development, typeorm, typescript]
related_skills: [e2e-testing, debugging, organize-types]
---

# API Development Skill

Quick reference for developing backend REST APIs in NestJS following four-layer architecture.

## When to Use

- Implementing new API endpoints from PRD requirements
- Adding CRUD operations for a new feature
- Creating controller + service + repository + entity layers
- Building RESTful APIs with Swagger documentation

---

## Quick Start (4 Layers)

### 1. Entity (Database Layer)
```typescript
// backend/src/modules/features/feature.entity.ts
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '@/core/base/base.entity';
import { User } from '@/modules/users/user.entity';

@Entity('features')
export class Feature extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;
}
```

**Key Points:**
- Extends `BaseEntity` (provides id, createdAt, updatedAt, deletedAt)
- Use TypeORM decorators: `@Entity`, `@Column`, `@ManyToOne`, `@JoinColumn`
- Column types: string (default), text, integer, boolean, timestamp, jsonb
- Relations: Always specify `{ onDelete: 'CASCADE' }` and separate foreign key column

### 2. Repository (Query Layer)
```typescript
// backend/src/modules/features/feature.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from '@/core/base/base.repository';
import { Feature } from './feature.entity';

@Injectable()
export class FeatureRepository extends BaseRepository<Feature> {
  constructor(
    @InjectRepository(Feature)
    repository: Repository<Feature>,
  ) {
    super(repository);
  }

  async findByUserId(userId: string): Promise<Feature[]> {
    return this.repository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}
```

**Key Points:**
- Extends `BaseRepository<Entity>` (provides findById, findAll, create, update, softDelete)
- Inject TypeORM Repository with `@InjectRepository(Entity)`
- Pass repository to `super(repository)`
- Add custom query methods for domain-specific needs
- Use `this.repository.find()` for custom queries

### 3. Service (Business Logic Layer)
```typescript
// backend/src/modules/features/feature.service.ts
import { Injectable, ConflictException } from '@nestjs/common';
import { BaseService } from '@/core/base/base.service';
import { FeatureRepository } from './feature.repository';
import { Feature } from './feature.entity';
import { CreateFeatureDto } from './dtos/create-feature.dto';
import { I18nHelper } from '@/core/utils/i18n.helper';

@Injectable()
export class FeatureService extends BaseService<Feature> {
  constructor(
    private readonly featureRepository: FeatureRepository,
    private readonly i18nHelper: I18nHelper,
  ) {
    super(featureRepository, 'Feature');
  }

  async createFeature(dto: CreateFeatureDto, userId: string): Promise<Feature> {
    // Business logic: check for duplicates
    const existing = await this.featureRepository.findOne({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException(
        this.i18nHelper.t('errors.feature.alreadyExists'),
      );
    }

    return this.featureRepository.create({ ...dto, userId });
  }

  async getUserFeatures(userId: string): Promise<Feature[]> {
    return this.featureRepository.findByUserId(userId);
  }
}
```

**Key Points:**
- Extends `BaseService<Entity>` (provides findByIdOrFail, findAll, create, update, remove)
- Pass repository AND entity name to `super(repository, 'EntityName')`
- Inject `I18nHelper` for internationalized error messages
- Use HTTP exceptions: `ConflictException`, `NotFoundException`, `ForbiddenException`, `BadRequestException`
- Implement business logic and validation before delegating to repository

### 4. Controller (HTTP Layer)
```typescript
// backend/src/modules/features/feature.controller.ts
import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BaseController } from '@/core/base/base.controller';
import { JwtAuthGuard } from '@/core/guards/jwt-auth.guard';
import { CurrentUser } from '@/core/decorators/current-user.decorator';
import { ApiSwagger } from '@/core/decorators/api-swagger.decorator';
import { Public } from '@/core/decorators/public.decorator';
import { FeatureService } from './feature.service';
import { Feature } from './feature.entity';
import { CreateFeatureDto } from './dtos/create-feature.dto';
import { UpdateFeatureDto } from './dtos/update-feature.dto';
import { User } from '../users/user.entity';

@ApiTags('Features')
@Controller('features')
@UseGuards(JwtAuthGuard)
export class FeatureController extends BaseController<Feature, CreateFeatureDto, UpdateFeatureDto> {
  constructor(private readonly featureService: FeatureService) {
    super(featureService);
  }

  @Post()
  @ApiSwagger({
    operation: 'create',
    resourceName: 'Feature',
    requestDto: CreateFeatureDto,
  })
  async create(
    @Body() dto: CreateFeatureDto,
    @CurrentUser() user: User,
  ) {
    return this.featureService.createFeature(dto, user.id);
  }

  @Get()
  @Public()
  @ApiSwagger({
    operation: 'getAll',
    resourceName: 'Feature',
    withPagination: true,
  })
  async findAll() {
    return super.findAll();
  }

  @Get('my/features')
  @ApiSwagger({
    operation: 'custom',
    summary: 'Get current user features',
    resourceName: 'Feature',
  })
  async getMyFeatures(@CurrentUser() user: User) {
    return this.featureService.getUserFeatures(user.id);
  }

  @Patch(':id')
  @ApiSwagger({
    operation: 'update',
    resourceName: 'Feature',
    requestDto: UpdateFeatureDto,
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFeatureDto,
  ) {
    return super.update(id, dto);
  }
}
```

**Key Points:**
- Extends `BaseController<Entity, CreateDto, UpdateDto>` (provides standard CRUD endpoints)
- Call `super(service)` in constructor
- Use `@ApiTags()` for Swagger grouping
- Apply `@UseGuards(JwtAuthGuard)` at controller level for authentication
- Use `@Public()` decorator for public endpoints
- Use `@CurrentUser()` to inject authenticated user
- `@ApiSwagger()` decorator for comprehensive API documentation
- Override `create()` and `update()` to call custom service methods
- Call `super.findAll()`, `super.update()` for inherited base functionality

---

## DTOs & Validation

### Create DTO
```typescript
// backend/src/modules/features/dtos/create-feature.dto.ts
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFeatureDto {
  @ApiProperty({ description: 'Feature name', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Feature description', maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}
```

**Key Validation Decorators:**
- `@IsString()`, `@IsEmail()`, `@IsInt()`, `@IsBoolean()`, `@IsUUID()`, `@IsEnum(EnumType)`
- `@IsNotEmpty()`, `@IsOptional()`
- `@MinLength(n)`, `@MaxLength(n)`, `@Min(n)`, `@Max(n)`
- `@IsArray()`, `@IsString({ each: true })` for string arrays
- `@ApiProperty()` for required fields, `@ApiPropertyOptional()` for optional fields

### Update DTO
```typescript
// backend/src/modules/features/dtos/update-feature.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateFeatureDto } from './create-feature.dto';

export class UpdateFeatureDto extends PartialType(CreateFeatureDto) {}
```

**Key Points:**
- Use `PartialType()` to make all fields optional
- Import from `'@nestjs/swagger'` (not `@nestjs/mapped-types`)

---

## Module Registration

```typescript
// backend/src/modules/features/feature.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureController } from './feature.controller';
import { FeatureService } from './feature.service';
import { FeatureRepository } from './feature.repository';
import { Feature } from './feature.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Feature])],
  controllers: [FeatureController],
  providers: [FeatureService, FeatureRepository],
  exports: [FeatureService],
})
export class FeatureModule {}
```

**Key Points:**
- `TypeOrmModule.forFeature([Entity])` - Register entities for dependency injection
- List all controllers for this module
- List all providers (services, repositories, utilities)
- Export services if other modules need access

---

## Common Patterns

### Pagination
```typescript
@Get()
async findAll(@Query('page') page = 1, @Query('limit') limit = 10) {
  return this.featureService.paginate({ page, limit });
}
```

### Filtering
```typescript
async browse(filters: { category?: string; status?: string }) {
  const where: any = {};
  if (filters.category) where.category = filters.category;
  if (filters.status) where.status = filters.status;
  return this.featureRepository.find({ where });
}
```

### Soft Delete
```typescript
// Inherited from BaseEntity - just call:
await this.featureRepository.softRemove(feature);
```

### Relations
```typescript
async findWithUser(id: string) {
  return this.featureRepository.findOne({
    where: { id },
    relations: ['user']
  });
}
```

---

## Swagger Documentation

Use `@ApiSwagger()` for comprehensive docs:

```typescript
@ApiSwagger({
  resourceName: 'Feature',
  operation: 'create',
  requestDto: CreateFeatureDto,
  successStatus: 201,
  requiresAuth: true,
  errors: [
    { status: 400, description: 'Invalid input' },
    { status: 401, description: 'Unauthorized' },
  ],
})
```

---

## E2E Testing

```typescript
// backend/test/e2e/features.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from '../setup/test-app.factory';
import { TestDatabase } from '../setup/test-database';
import { createTestUser, generateAccessToken, authHeader } from '../fixtures';

describe('FeatureController (e2e)', () => {
  let app: INestApplication;
  let testDb: TestDatabase;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    testDb = setup.testDb;
  });

  beforeEach(async () => {
    await testDb.cleanDatabase();
  });

  afterAll(async () => {
    await app.close();
    await testDb.close();
  });

  describe('POST /api/features', () => {
    it('should create a feature', async () => {
      const user = await createTestUser(testDb.dataSource);
      const token = generateAccessToken(user);

      const response = await request(app.getHttpServer())
        .post('/api/features')
        .set(authHeader(token))
        .send({
          name: 'Test Feature',
          description: 'Test Description',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Feature');
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/features')
        .send({ name: 'Test' })
        .expect(401);
    });
  });

  describe('GET /api/features', () => {
    it('should return list of features', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/features')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});
```

**Key Points:**
- Use `createTestApp()` for test setup
- Clean database before each test with `beforeEach()`
- Use fixtures: `createTestUser()`, `generateAccessToken()`, `authHeader()`
- Test both success and error cases (401, 400, 404, 409)
- Verify response structure: `success`, `data`, `message`

---

## Database Migrations

```bash
# Generate migration from entity changes
npm run migration:generate -- --name=CreateFeatures

# Run migrations
npm run migration:run

# Revert if needed
npm run migration:revert
```

---

## Verification Checklist

- [ ] Entity created extending BaseEntity
- [ ] Repository created extending BaseRepository
- [ ] Service created extending BaseService
- [ ] Controller created extending BaseController
- [ ] DTOs with class-validator decorators
- [ ] Module registered with TypeOrmModule
- [ ] Swagger documentation with @ApiSwagger
- [ ] E2E tests for all endpoints
- [ ] Migrations generated and run
- [ ] PROJECT_API.md updated with endpoints

---

## Full Workflow (Agent Invocation)

For comprehensive API development workflow, invoke the backend-developer agent:

**When to use the agent:**
- Implementing new feature from PRD
- Creating multiple endpoints (5+)
- Need database design + migrations + API + tests + docs
- Want autonomous implementation following all best practices

**How to invoke:**
```
"Implement the voting feature from PRD using backend-developer agent"
"Use backend-developer agent to create comments system API"
```

The agent will:
1. Read PRD from `.claude-project/prd/`
2. Update PROJECT_KNOWLEDGE.md, PROJECT_DATABASE.md, PROJECT_API.md
3. Design entities and generate migrations
4. Create Controller + Service + Repository + Entity + DTOs
5. Generate E2E tests
6. Update Swagger documentation

**Agent reference:** `.claude/nestjs/agents/backend-developer.md`

---

## Related Resources

- [backend-developer agent](../../agents/backend-developer.md) - Complete autonomous workflow
- [NestJS guides](../../guides/) - Architecture, patterns, best practices
- [Base classes](../../../../backend/src/core/base/) - BaseEntity, BaseService, BaseRepository, BaseController
- [e2e-testing skill](./e2e-testing/SKILL.md) - E2E test generation patterns
