# Backend Best Practices

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

```typescript
// GOOD: Extends BaseController, uses decorators, no try/catch
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

    // Custom endpoint beyond CRUD
    @Post(':id/reset-password')
    @Roles('admin')
    async resetPassword(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: ResetPasswordDto,
    ): Promise<void> {
        await this.userService.resetPassword(id, dto);
    }
}

// BAD: No base class, try/catch, missing decorators
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

```typescript
// GOOD: Extends BaseService, throws HTTP exceptions, dependency injection
@Injectable()
export class UserService extends BaseService<User> {
    constructor(
        protected readonly repository: UserRepository,
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

// BAD: No error handling, direct database access
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

### DO

```typescript
// Use repositories for data access
const user = await this.userRepository.findOne({ where: { email } });

// Use query builder for complex queries
const users = await this.userRepository
    .createQueryBuilder('user')
    .leftJoinAndSelect('user.posts', 'posts')
    .where('user.role = :role', { role: UserRole.ADMIN })
    .getMany();

// Use transactions for multi-step operations
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
// Don't use raw SQL
const users = await this.dataSource.query('SELECT * FROM users');

// Don't hard delete (use soft delete)
await this.repository.delete(id); // Use remove() instead

// Don't forget to release query runners
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
