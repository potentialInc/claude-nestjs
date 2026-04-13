# Backend Best Practices

## CRITICAL RULES (MANDATORY)

### Rule 1: Message Punctuation Convention (MANDATORY)

All user-facing messages in the backend MUST follow these punctuation rules:

**Success messages** must be meaningful and end with a period `.`:
```typescript
// ✅ CORRECT: Success messages end with "."
return new SuccessResponseDto(data, 'Project created successfully.');
return new ResponsePayloadDto({ message: 'Login successful.' });
```

```typescript
// ❌ WRONG: Missing period, or too vague
return new SuccessResponseDto(data, 'Success');
return new SuccessResponseDto(data, 'Project created successfully');
```

**Error messages** must be meaningful and end with an exclamation mark `!`:
```typescript
// ✅ CORRECT: Error messages end with "!" and are descriptive
throw new NotFoundException(`Project with ID ${id} not found!`);
throw new ForbiddenException('You do not have permission to access this resource!');
throw new UnauthorizedException('The access ID or password you entered is incorrect!');
```

```typescript
// ❌ WRONG: Missing "!", or too vague
throw new NotFoundException('Not found');
throw new ForbiddenException('Access denied');
throw new UnauthorizedException('Invalid credentials');
```

**Avoid vague messages** — be specific about what went wrong or succeeded:
| ❌ Vague | ✅ Meaningful |
|----------|--------------|
| `'Access denied'` | `'You do not have permission to access this resource!'` |
| `'Invalid token'` | `'The authentication token is invalid or malformed!'` |
| `'Success'` | `'Project created successfully.'` |
| `'Not found'` | `'Project with ID ${id} not found!'` |

### Rule 1b: Multi-Language i18n (MANDATORY)

All messages use `nestjs-i18n` for multi-language support. The `I18nHelper.t()` static utility auto-resolves the user's language from `Accept-Language` header or `?lang=` query parameter.

**When adding new messages:**
1. Add the key to `backend/src/i18n/en/translation.json` (English)
2. Add the key to `backend/src/i18n/ko/translation.json` (Korean)
3. Use via `I18nHelper.t('domain.key', { param: value })`

```typescript
// ✅ CORRECT: Use I18nHelper.t() — auto-resolves language
throw new NotFoundException(I18nHelper.t('projects.notFound', { id }));
return new SuccessResponseDto(data, I18nHelper.t('projects.created'));
```

```typescript
// ❌ WRONG: Hardcoded strings bypass multi-language support
throw new NotFoundException(`Project with ID ${id} not found!`);
return new SuccessResponseDto(data, 'Project created successfully.');
```

### Rule 2: Check Existing APIs Before Creating New Ones

**Before creating any new API endpoint, you MUST search for existing endpoints.**

```bash
# Search for existing endpoints
grep -r "@Get\|@Post\|@Put\|@Patch\|@Delete" backend/src/modules/ --include="*.controller.ts"
```

| Frontend Need | Check First |
|---------------|-------------|
| Get user profile | `GET /users/:id` or `GET /users/me` |
| Update user | `PATCH /users/:id` |
| Get list with filters | Existing `GET /` with query params |

**Only create new endpoint when**:
- Operation is fundamentally different
- Business logic is completely distinct
- Access control requirements differ

---

## NestJS Coding Standards

### General Principles

1. **Use TypeScript Strict Mode**: Enable strict type checking
2. **Follow Single Responsibility Principle**: Each class should have one clear purpose
3. **Dependency Injection**: Use constructor injection for all dependencies
4. **Immutability**: Prefer const over let, avoid mutations when possible
5. **Async/Await**: Always use async/await, never promise chains

### Naming Conventions

- **Files**: kebab-case (e.g., `user.controller.ts`, `auth.service.ts`)
- **Classes**: PascalCase (e.g., `UserController`, `AuthService`)
- **Variables/Functions**: camelCase (e.g., `findUser`, `isActive`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`, `API_URL`)
- **Interfaces**: PascalCase with 'I' prefix (e.g., `IJwtPayload`, `IUser`)
- **DTOs**: PascalCase with suffix (e.g., `CreateUserDto`, `UpdatePostDto`)
- **Entities**: PascalCase (e.g., `User`, `Post`)

### Controller Best Practices

**MANDATORY: Controllers MUST extend BaseController. Writing a controller without extending BaseController is PROHIBITED.**

```typescript
// ✅ GOOD: Extends BaseController, uses decorators, no try/catch
@ApiTags('Users')
@Controller('users')
export class UserController extends BaseController<
    User,
    CreateUserDto,
    UpdateUserDto
> {
    constructor(private readonly userService: UserService) {
        super(userService);
    }

    // Custom endpoint beyond CRUD — override only when needed
    @Post(':id/reset-password')
    @Roles('admin')
    async resetPassword(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: ResetPasswordDto,
    ): Promise<void> {
        await this.userService.resetPassword(id, dto);
    }
}

// ❌ PROHIBITED: No base class — will FAIL backend gate check
export class UserController {
    async getUser(req, res) {
        try {
            const user = await this.userService.findById(req.params.id);
            res.json(user);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}
```

### Service Best Practices

**MANDATORY: Services MUST extend BaseService. Services MUST inject custom repository classes — using `@InjectRepository(Entity)` directly in services is PROHIBITED.**

```typescript
// ✅ GOOD: Extends BaseService, injects custom repository
@Injectable()
export class UserService extends BaseService<User> {
    constructor(
        protected readonly repository: UserRepository,  // ✅ Custom repository
        private readonly mailService: MailService,
    ) {
        super(repository, 'User');
    }

    async findByEmail(email: string): Promise<User> {
        const user = await this.repository.findOne({ where: { email } });

        if (!user) {
            throw new NotFoundException(`User with email ${email} not found`);
        }

        return user;
    }

    async createUser(dto: CreateUserDto): Promise<User> {
        const existing = await this.repository.findOne({
            where: { email: dto.email },
        });

        if (existing) {
            throw new ConflictException('Email already exists');
        }

        const user = await this.repository.save(dto);
        await this.mailService.sendWelcomeEmail(user.email);

        return user;
    }
}

// ❌ PROHIBITED: Direct @InjectRepository — will FAIL backend gate check
@Injectable()
export class UserService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,  // ❌ WRONG
    ) {}
}

// ❌ PROHIBITED: No base class
export class UserService {
    async getUser(id) {
        return User.findOne(id); // No validation, no error handling
    }
}
```

### DTO Best Practices

```typescript
// GOOD: class-validator decorators, Swagger docs, proper typing
export class CreateUserDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ example: 'Password@123' })
    @IsString()
    @MinLength(8)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
        message: 'Password must contain uppercase, lowercase, and number',
    })
    password: string;

    @ApiPropertyOptional({ example: 'John' })
    @IsString()
    @IsOptional()
    firstName?: string;
}

// BAD: No validation, plain interface
interface CreateUserDto {
    email: string;
    password: string;
}
```

### Entity Best Practices

```typescript
// GOOD: Extends BaseEntity, proper decorators, relationships
@Entity('users')
export class User extends BaseEntity {
    @Column({ unique: true })
    @Index()
    email: string;

    @Column()
    password: string;

    @Column({ nullable: true })
    firstName: string;

    @Column({ nullable: true })
    lastName: string;

    @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
    role: UserRole;

    @OneToMany(() => Post, (post) => post.author)
    posts: Post[];

    @BeforeInsert()
    async hashPassword() {
        this.password = await bcrypt.hash(this.password, 10);
    }
}

// BAD: No base class, missing indexes, business logic in entity
@Entity()
export class User {
    @PrimaryGeneratedColumn()
    id: number; // Should be UUID

    @Column()
    email: string; // Should have unique constraint

    async validatePassword(password: string) {
        // Business logic should be in service
        return bcrypt.compare(password, this.password);
    }
}
```

## Error Handling Patterns

### DO

```typescript
// Throw HTTP exceptions from services
throw new NotFoundException('User not found');
throw new ConflictException('Email already exists');
throw new BadRequestException('Invalid input');

// Let exception filters handle errors in controllers
@Get(':id')
async findOne(@Param('id') id: string) {
    return await this.service.findById(id); // No try/catch
}

// Add Sentry context for unexpected errors
Sentry.withScope((scope) => {
    scope.setContext('user', { id, email });
    Sentry.captureException(error);
});
```

### DON'T

```typescript
// Don't use try/catch in controllers
@Get(':id')
async findOne(@Param('id') id: string) {
    try {
        return await this.service.findById(id);
    } catch (error) {
        throw error; // Exception filter will handle it
    }
}

// Don't swallow errors
catch (error) {
    console.error(error); // Lost error
    return null;
}

// Don't use generic error messages
throw new Error('Error occurred'); // Too generic
```

## Database Patterns

**MANDATORY: `createQueryBuilder()` MUST only be used in repository files — using it in services is PROHIBITED. Services access data through custom repository methods.**

### DO

```typescript
// ✅ GOOD: createQueryBuilder in REPOSITORY layer
// user.repository.ts
@Injectable()
export class UserRepository extends BaseRepository<User> {
    async findAdminsWithPosts(): Promise<User[]> {
        return this.repository
            .createQueryBuilder('user')
            .leftJoinAndSelect('user.posts', 'posts')
            .where('user.role = :role', { role: UserRole.ADMIN })
            .getMany();
    }
}

// ✅ GOOD: Service calls repository method
// user.service.ts
async getAdmins(): Promise<User[]> {
    return this.repository.findAdminsWithPosts();
}

// ✅ GOOD: Use transactions for multi-step operations
const queryRunner = this.dataSource.createQueryRunner();
await queryRunner.connect();
await queryRunner.startTransaction();

try {
    await queryRunner.manager.save(user);
    await queryRunner.manager.save(profile);
    await queryRunner.commitTransaction();
} catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
} finally {
    await queryRunner.release();
}
```

### DON'T

```typescript
// ❌ PROHIBITED: createQueryBuilder in SERVICE — will FAIL backend gate check
// user.service.ts
async getAdmins() {
    return this.repository.createQueryBuilder('user')
        .where('user.role = :role', { role: 'admin' })
        .getMany();
}

// ❌ Don't use raw SQL
const users = await this.dataSource.query('SELECT * FROM users');

// ❌ Don't hard delete (use soft delete)
await this.repository.delete(id); // Use remove() instead

// ❌ Don't forget to release query runners
const queryRunner = this.dataSource.createQueryRunner();
await queryRunner.startTransaction();
// ... operations
await queryRunner.commitTransaction();
// Missing: await queryRunner.release();
```

## Security Best Practices

1. **Never commit secrets**: Use environment variables
2. **Hash passwords**: Use bcrypt before storing
3. **Validate all inputs**: Use class-validator decorators
4. **Use UUIDs**: Never expose auto-increment IDs
5. **Implement rate limiting**: Protect against brute force
6. **Enable CORS properly**: Only allow trusted origins
7. **Use HTTPS**: In production environments
8. **Sanitize user input**: Prevent XSS and SQL injection

## Performance Best Practices

1. **Use pagination**: For all list endpoints
2. **Index database columns**: For frequently queried fields
3. **Eager vs lazy loading**: Choose based on use case
4. **Cache frequently accessed data**: Use Redis when appropriate
5. **Optimize database queries**: Avoid N+1 queries
6. **Use compression**: Enable gzip compression
7. **Monitor slow queries**: Set up database query logging

## Testing Best Practices

1. **Write unit tests for services**: Test business logic
2. **Write e2e tests for controllers**: Test API endpoints
3. **Mock external dependencies**: Don't call real APIs in tests
4. **Use test database**: Never test against production
5. **Clean up after tests**: Reset database state
6. **Test edge cases**: Not just happy paths
7. **Achieve good coverage**: Aim for >80% coverage

## curl API Testing Best Practices

### Token Authentication with curl

**CRITICAL: Always use single quotes for curl commands to prevent shell variable expansion issues!**

#### Correct Format (Single Quotes)

```bash
# GET request
curl -s -X GET 'http://localhost:3000/users' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  | python3 -m json.tool

# POST request with JSON body
curl -s -X POST 'http://localhost:3000/posts' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'Content-Type: application/json' \
  -d '{"title":"My Post","content":"Content here...","published":true}' \
  | python3 -m json.tool
```

#### Why Shell Variables Fail

Using shell variables with `$TOKEN` often fails due to shell expansion issues:

```bash
# THIS OFTEN FAILS - token becomes empty!
TOKEN="eyJhbGci..."
curl -X GET "http://localhost:3000/users" -H "Authorization: Bearer $TOKEN"
# Result: Authorization: Bearer  (empty!)

# WORKAROUND if you must use variables - use && in same line:
TOKEN="eyJhbGci..." && curl -s -X GET "http://localhost:3000/users" -H "Authorization: Bearer $TOKEN"
```

### Getting a Valid Token

**Step 1: Login to get a token**

```bash
curl -s -X POST 'http://localhost:3000/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email": "admin@example.com", "password": "Password123!"}' | python3 -m json.tool
```

**Note**: Login uses `email` and `password`.

### Generating Test Tokens

Use the helper script:

```bash
cd backend
node test/generate-test-token.js
```

Or manually:

```javascript
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'your-secret-key';  // from .env AUTH_JWT_SECRET

const token = jwt.sign({
  id: 'USER_UUID_FROM_DB',
  email: 'user@example.com',
  role: 2,  // 1=ADMIN, 2=USER, 3=MODERATOR
  fullName: 'User Name',
}, JWT_SECRET, { expiresIn: '24h' });

console.log(token);
```

### User Roles Reference

| Role | Value | Description |
|------|-------|-------------|
| ADMIN | 1 | Full system access |
| USER | 2 | Standard user (default) |
| MODERATOR | 3 | Content moderation |

**Usage**: Use `@Roles(RolesEnum.ADMIN)` decorator to restrict access.

### Common Token Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Authorization: Bearer ` (empty) | Shell variable expansion failed | Use single quotes with inline token |
| `Invalid or missing token` | Token expired or malformed | Get fresh token via login |
| `Access denied. Required roles: ADMIN` | Wrong role in token | Login with correct user role |
| `property username should not exist` | Login expects `email` | Use `{"email": "user@example.com", ...}` |

### Complete curl Examples

```bash
# Create post (authenticated)
curl -s -X POST 'http://localhost:3000/posts' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"title":"My Post","content":"Post content here...","published":true}' \
  | python3 -m json.tool

# Get all users (authenticated)
curl -s -X GET 'http://localhost:3000/users' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  | python3 -m json.tool

# Get published posts (public)
curl -s -X GET 'http://localhost:3000/posts/published' \
  | python3 -m json.tool
```

## Redis Caching Best Practices

### What to Cache

| Data Type | TTL | Example |
|-----------|-----|---------|
| Static catalogs | `'catalog'` (1h) | Items, products, categories |
| Entity lists | `'list'` (30m) | Users, assignments, meetings |
| Computed stats | `'stats'` (15m) | Dashboard, aggregates |
| User-specific | `'default'` (5m) | Profiles, preferences |
| Real-time | NEVER | Notifications, live status |

### DO

```typescript
// Cache GET endpoints with appropriate TTL
@Get()
@Cacheable({ key: 'items:all', ttl: 'catalog' })
async findAll() { ... }

// Invalidate on mutations
@Post()
@CacheInvalidate({ patterns: ['items:*'] })
async create(@Body() dto: CreateDto) { ... }

// Use userAware for user-specific data
@Cacheable({ key: 'profile', ttl: 'default', userAware: true })
```

### DON'T

```typescript
// Don't cache mutation endpoints
@Post()
@Cacheable({ key: 'result' })  // WRONG!
async create() { ... }

// Don't forget to invalidate related caches
@Patch(':id')
// Missing @CacheInvalidate!
async update() { ... }

// Don't use overly long TTLs for dynamic data
@Cacheable({ key: 'notifications', ttl: 3600 })  // Too long!
```

See [workflow-implement-redis-caching.md](workflow-implement-redis-caching.md) for complete documentation.

---

## Socket.IO (WebSocket) Best Practices

### Backend Gateway Pattern

```typescript
// GOOD: Proper gateway with authentication and validation
@WebSocketGateway({
    namespace: '/chat',
    cors: {
        origin: '*',
        credentials: true,
    },
})
@UseFilters(WsExceptionFilter)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> socketIds

    async handleConnection(client: AuthenticatedSocket) {
        try {
            const token = this.extractTokenFromCookie(client);
            const payload = await this.jwtService.verifyAsync(token);
            client.userId = payload.sub || payload.id;

            // Track user connections (supports multi-device)
            if (!this.connectedUsers.has(client.userId)) {
                this.connectedUsers.set(client.userId, new Set());
            }
            this.connectedUsers.get(client.userId).add(client.id);
        } catch (error) {
            client.disconnect();
        }
    }

    @SubscribeMessage('room:join')
    async handleJoinRoom(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() data: WsJoinRoomDto,
    ) {
        await this.verifyAccess(data.roomId, client.userId);
        await client.join(`room:${data.roomId}`);
        return { event: 'room:joined', data: { success: true } };
    }
}
```

### Socket Authentication via Cookies

```typescript
// Backend: Extract token from HTTP-only cookie
private extractToken(client: Socket): string | null {
    const cookieHeader = client.handshake.headers.cookie;
    if (cookieHeader) {
        const cookies = this.parseCookies(cookieHeader);
        return cookies['NestjsStartKit'] || null;
    }
    return null;
}
```

### Common Socket Event Naming

| Event | Direction | Purpose |
|-------|-----------|---------|
| `room:join` | Client -> Server | Join a room |
| `room:leave` | Client -> Server | Leave a room |
| `message:send` | Client -> Server | Send a message |
| `message:new` | Server -> Client | New message broadcast |
| `message:typing` | Bidirectional | Typing indicator |
| `message:read` | Bidirectional | Read receipt |
| `user:online` | Server -> Client | Online status change |

---

## MANDATORY Rules (from Base Architecture)

### UnifiedConfig — No Direct `process.env`

All environment variable access MUST go through `UnifiedConfig`:

```typescript
// BAD: Direct process.env access
const secret = process.env.JWT_SECRET;

// GOOD: UnifiedConfig
import { UnifiedConfig } from '@/config/unified-config';
const secret = UnifiedConfig.jwt.secret;
```

- NEVER use `process.env` directly in services, controllers, or utilities
- All config values defined in `UnifiedConfig` class with validation
- Missing required values MUST throw on startup (not fallback to defaults)

### Enum Centralization

ALL constrained values (status, role, type) MUST be TypeScript enums:

```typescript
// Location: backend/src/shared/enums/user-status.enum.ts
export enum UserStatusEnum {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
}
```

- Create in `backend/src/shared/enums/` with `Enum` suffix
- Export from barrel `backend/src/shared/enums/index.ts`
- Reference in entity: `@Column({ type: 'enum', enum: UserStatusEnum })`
- After creating/modifying enums, run `/sync-enums` to sync to frontend
- No hardcoded string literals for constrained values

### Pagination Defaults

- Default `limit`: 20
- Maximum `limit`: 100
- All list endpoints MUST support pagination
- Response shape: `{ data: T[], total: number, totalPages: number, page: number, limit: number }`

### Rate Limiting

- Public endpoints (login, register, forgot-password) MUST have rate limiting
- Use `@nestjs/throttler` or custom guard
- Default: 10 requests per 60 seconds for auth endpoints

### File Size Constraints

| Layer | Max Lines | Action at Limit |
|-------|-----------|-----------------|
| Controller | 200 | Split into sub-controllers |
| Service | 300 | Extract helper services |
| Repository | 200 | Extract query builders |

### Sentry Error Context

When throwing exceptions in services, enrich with Sentry context:

```typescript
import * as Sentry from '@sentry/node';

// Add context before throwing
Sentry.setContext('operation', { userId, action: 'createOrder' });
throw new ConflictException(I18nHelper.t('order.alreadyExists'));
```
