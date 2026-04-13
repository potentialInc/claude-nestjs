# WebSocket Gateway with Socket.io

This guide covers the NestJS WebSocket gateway pattern using Socket.io for real-time bidirectional communication with JWT authentication via httpOnly cookies.

## Why WebSocket Gateways?

### REST Polling vs WebSocket

| Feature             | REST Polling       | WebSocket            |
| ------------------- | ------------------ | -------------------- |
| Latency             | ❌ High (interval) | ✅ Instant push      |
| Server Load         | ❌ Repeated calls  | ✅ Single connection |
| Bidirectional       | ❌ Client-only     | ✅ Both directions   |
| Real-time Updates   | ❌ Delayed         | ✅ Immediate         |
| Connection Overhead | ❌ Per request     | ✅ Persistent        |

**Use WebSocket gateways when the PRD requires:** real-time updates, live collaboration, push notifications, drag-and-drop sync, or chat functionality.

---

## Architecture Integration

WebSocket gateways sit alongside controllers in feature modules — they share the same service layer but handle a different transport:

```
┌──────────────────────────────────────────────────┐
│                   Client                          │
│         HTTP Requests    WebSocket Events         │
└─────────┬────────────────────┬───────────────────┘
          │                    │
          ▼                    ▼
┌─────────────────┐  ┌────────────────────┐
│   Controller     │  │    Gateway          │
│   (REST API)     │  │    (Socket.io)      │
└────────┬────────┘  └────────┬───────────┘
         │                    │
         ▼                    ▼
┌──────────────────────────────────────────┐
│              Service Layer               │
│     (Business logic — shared by both)    │
└─────────────────┬────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────┐
│           Repository Layer               │
└─────────────────┬────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────┐
│              Entity Layer                │
└──────────────────────────────────────────┘
```

**Key Points:**

- Gateways do **NOT** extend `BaseController` — they are a separate transport concern
- Gateways **inject the same services** as controllers
- Gateways live in the same module directory: `src/modules/{feature}/`
- One gateway per feature namespace (e.g., `/{feature}`)

### File Structure

```
src/modules/{feature}/
├── {feature}.entity.ts          # Entity (extends BaseEntity)
├── {feature}.repository.ts      # Repository (extends BaseRepository)
├── {feature}.service.ts         # Service (extends BaseService)
├── {feature}.controller.ts      # REST Controller (extends BaseController)
├── {feature}.gateway.ts         # ✅ WebSocket Gateway (NEW)
├── {feature}.module.ts          # Module registration
└── dtos/
    ├── create-{feature}.dto.ts
    ├── update-{feature}.dto.ts
    └── {feature}-response.dto.ts
```

---

## Gateway Implementation

### 1. Basic Gateway Setup

```typescript
// src/modules/{feature}/{feature}.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { {Feature}Service } from './{feature}.service';

@WebSocketGateway({
  namespace: '/{feature}',
})
export class {Feature}Gateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger({Feature}Gateway.name);

  constructor(
    private readonly {feature}Service: {Feature}Service,
    private readonly configService: ConfigService,
  ) {}

  afterInit() {
    this.logger.log('{Feature} WebSocket gateway initialized');
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('{feature}-updated')
  async handleUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { id: string; [key: string]: any },
  ) {
    const result = await this.{feature}Service.update(data.id, data);
    // Broadcast to all clients in the room except sender
    client.to(data.roomId).emit('{feature}-updated', result);
    return result;
  }
}
```

**Key Points:**

- `@WebSocketGateway()` decorator registers the class as a gateway
- CORS is inherited from `main.ts` `app.enableCors()` — do NOT set `cors` in the decorator (use `ConfigService` in `main.ts` instead of `process.env`)
- `namespace` isolates events per feature (e.g., `/board`, `/chat`)
- `@WebSocketServer()` injects the Socket.io `Server` instance
- Implement lifecycle interfaces: `OnGatewayInit`, `OnGatewayConnection`, `OnGatewayDisconnect`

---

### 2. JWT Authentication via Cookie Handshake

Gateways must authenticate connections using the same httpOnly cookie pattern as HTTP routes:

```typescript
// src/modules/{feature}/{feature}.gateway.ts
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { parse } from 'cookie';
import { WsException } from '@nestjs/websockets';

@WebSocketGateway({
  namespace: '/{feature}',
})
export class {Feature}Gateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger({Feature}Gateway.name);

  constructor(
    private readonly {feature}Service: {Feature}Service,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const cookies = client.handshake.headers.cookie;
      if (!cookies) {
        this.logger.warn(`Client ${client.id} has no cookies — disconnecting`);
        client.disconnect();
        return;
      }

      const parsed = parse(cookies);
      const tokenCookieName = this.configService.get<string>(
        'AUTH_TOKEN_COOKIE_NAME',
      );
      const token = parsed[tokenCookieName];

      if (!token) {
        this.logger.warn(`Client ${client.id} missing auth cookie — disconnecting`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      // Attach user data to socket for use in event handlers
      client.data.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };

      this.logger.log(`Client authenticated: ${client.id} (user: ${payload.email})`);
    } catch (error) {
      this.logger.warn(`Client ${client.id} auth failed — disconnecting`);
      client.disconnect();
    }
  }

  // Access authenticated user in event handlers
  @SubscribeMessage('{feature}-action')
  async handleAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const user = client.data.user;
    if (!user) {
      throw new WsException('Unauthorized');
    }
    // Use user.id, user.email, user.role for authorization
    return this.{feature}Service.doAction(data, user.id);
  }
}
```

**Key Points:**

- Extract JWT from `client.handshake.headers.cookie` using the `cookie` package
- Use `ConfigService` for cookie name — NEVER hardcode
- Call `client.disconnect()` on auth failure — do not throw
- Attach user payload to `client.data.user` for access in event handlers
- Always verify JWT with `jwtService.verify()` — same secret as HTTP auth

---

### 3. Room Management

Rooms group clients for targeted broadcasting (e.g., all users viewing the same board):

```typescript
@SubscribeMessage('join-{feature}')
handleJoinRoom(
  @ConnectedSocket() client: Socket,
  @MessageBody() roomId: string,
) {
  const user = client.data.user;
  if (!user) {
    throw new WsException('Unauthorized');
  }

  client.join(roomId);
  this.logger.log(`User ${user.email} joined room: ${roomId}`);

  // Notify room members (optional)
  client.to(roomId).emit('user-joined', {
    userId: user.id,
    roomId,
  });
}

@SubscribeMessage('leave-{feature}')
handleLeaveRoom(
  @ConnectedSocket() client: Socket,
  @MessageBody() roomId: string,
) {
  const user = client.data.user;
  client.leave(roomId);
  this.logger.log(`User ${user?.email} left room: ${roomId}`);

  // Notify room members (optional)
  client.to(roomId).emit('user-left', {
    userId: user?.id,
    roomId,
  });
}

handleDisconnect(client: Socket) {
  // Socket.io automatically removes client from all rooms on disconnect
  this.logger.log(`Client disconnected: ${client.id}`);
}
```

**Key Points:**

- `client.join(roomId)` — add client to a room
- `client.leave(roomId)` — remove client from a room
- `client.to(roomId).emit()` — broadcast to room **excluding** sender
- `this.server.to(roomId).emit()` — broadcast to room **including** sender
- Socket.io auto-cleans rooms on disconnect — no manual cleanup needed

---

### 4. Broadcasting from Services

When REST API mutations need to trigger real-time updates, inject the gateway into the service or use an event-based approach:

#### Option A: Inject Gateway into Service (Simple)

```typescript
// src/modules/{feature}/{feature}.service.ts
import { Injectable } from '@nestjs/common';
import { {Feature}Gateway } from './{feature}.gateway';

@Injectable()
export class {Feature}Service extends BaseService<{Feature}> {
  constructor(
    private readonly {feature}Repository: {Feature}Repository,
    private readonly {feature}Gateway: {Feature}Gateway,
  ) {
    super({feature}Repository, '{Feature}');
  }

  async updateAndBroadcast(id: string, data: any, roomId: string) {
    const result = await this.update(id, data);
    // Broadcast to all clients in the room
    this.{feature}Gateway.server.to(roomId).emit('{feature}-updated', result);
    return result;
  }
}
```

#### Option B: EventEmitter Pattern (Decoupled)

```typescript
// src/modules/{feature}/{feature}.service.ts
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class {Feature}Service extends BaseService<{Feature}> {
  constructor(
    private readonly {feature}Repository: {Feature}Repository,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super({feature}Repository, '{Feature}');
  }

  async updateItem(id: string, data: any, roomId: string) {
    const result = await this.update(id, data);
    this.eventEmitter.emit('{feature}.updated', { result, roomId });
    return result;
  }
}

// src/modules/{feature}/{feature}.gateway.ts
import { OnEvent } from '@nestjs/event-emitter';

@WebSocketGateway({ /* ... */ })
export class {Feature}Gateway {
  @OnEvent('{feature}.updated')
  handleItemUpdated(payload: { result: any; roomId: string }) {
    this.server.to(payload.roomId).emit('{feature}-updated', payload.result);
  }
}
```

**Key Points:**

- Option A is simpler — use when gateway and service are in the same module
- Option B decouples modules — use when multiple gateways need to react to the same event
- Option B requires `@nestjs/event-emitter` package and `EventEmitterModule.forRoot()` in `AppModule`

---

### 5. Error Handling

```typescript
import { WsException } from '@nestjs/websockets';

@SubscribeMessage('{feature}-action')
async handleAction(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: any,
) {
  try {
    const user = client.data.user;
    if (!user) {
      throw new WsException('Unauthorized');
    }

    // Validate input
    if (!data.id) {
      throw new WsException('Missing required field: id');
    }

    const result = await this.{feature}Service.findByIdOrFail(data.id);
    return { event: '{feature}-action-response', data: result };
  } catch (error) {
    if (error instanceof WsException) {
      throw error;
    }

    // Handle service-level exceptions
    client.emit('exception', {
      status: 'error',
      message: error.message || 'Internal server error',
    });
  }
}
```

**Key Points:**

- Use `WsException` from `@nestjs/websockets` for WebSocket-specific errors
- Catch service exceptions and emit as `exception` events to the client
- Return value from `@SubscribeMessage` is sent as acknowledgement to the sender
- Use `client.emit('exception', ...)` for error feedback to the specific client

---

## Module Registration

```typescript
// src/modules/{feature}/{feature}.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { {Feature} } from './{feature}.entity';
import { {Feature}Repository } from './{feature}.repository';
import { {Feature}Service } from './{feature}.service';
import { {Feature}Controller } from './{feature}.controller';
import { {Feature}Gateway } from './{feature}.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([{Feature}]),
    JwtModule, // Required for gateway JWT verification
  ],
  controllers: [{Feature}Controller],
  providers: [
    {Feature}Repository,
    {Feature}Service,
    {Feature}Gateway, // ✅ Register gateway as provider
  ],
  exports: [{Feature}Service],
})
export class {Feature}Module {}
```

**Key Points:**

- Gateway is registered as a **provider** (not a controller)
- Import `JwtModule` for JWT verification in gateway `handleConnection`
- No special configuration needed in `AppModule` — each gateway self-registers
- Gateway is NOT exported — it is internal to the module

### Dependencies

Install required packages:

```bash
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io cookie
npm install -D @types/cookie
```

### Main.ts Configuration

No additional WebSocket configuration is needed in `main.ts` when using `@nestjs/platform-socket.io`. The gateway decorator handles everything. Ensure CORS is configured:

```typescript
// src/main.ts
const configService = app.get(ConfigService);
app.enableCors({
  origin: configService.get<string>("FRONTEND_URL") || "http://localhost:5173",
  credentials: true, // Required for cookie-based WebSocket auth
});
```

---

## Testing Gateway Events

### E2E Test Pattern

```typescript
// test/e2e/{feature}-gateway.e2e-spec.ts
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { io, Socket as ClientSocket } from "socket.io-client";
import * as cookieParser from "cookie-parser";

describe("{Feature}Gateway (e2e)", () => {
  let app: INestApplication;
  let clientSocket: ClientSocket;
  let authCookie: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.listen(0); // Random port

    const port = app.getHttpServer().address().port;

    // Login to get auth cookie
    const loginResponse = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "test@example.com", password: "password123" });

    authCookie = loginResponse.headers["set-cookie"]
      .map((c: string) => c.split(";")[0])
      .join("; ");

    // Connect socket with auth cookie
    clientSocket = io(`http://localhost:${port}/{feature}`, {
      extraHeaders: { cookie: authCookie },
      transports: ["websocket"],
    });

    await new Promise<void>((resolve) => {
      clientSocket.on("connect", resolve);
    });
  });

  afterAll(async () => {
    clientSocket?.disconnect();
    await app?.close();
  });

  it("should connect with valid auth cookie", () => {
    expect(clientSocket.connected).toBe(true);
  });

  it("should join a room", (done) => {
    clientSocket.emit("join-{feature}", "room-123", (response: any) => {
      expect(response).toBeDefined();
      done();
    });
  });

  it("should receive broadcast events", (done) => {
    clientSocket.on("{feature}-updated", (data) => {
      expect(data).toHaveProperty("id");
      done();
    });

    // Trigger the event from another client or directly
    clientSocket.emit("{feature}-updated", {
      id: "test-id",
      roomId: "room-123",
    });
  });

  it("should reject connection without auth cookie", (done) => {
    const unauthSocket = io(`http://localhost:${port}/{feature}`, {
      transports: ["websocket"],
      // No cookie
    });

    unauthSocket.on("disconnect", () => {
      expect(unauthSocket.connected).toBe(false);
      done();
    });
  });
});
```

**Key Points:**

- Use `app.listen(0)` for random port in tests
- Extract auth cookie from login response for socket connection
- Pass cookie via `extraHeaders` in socket.io-client
- Test connection, room join, broadcast, and unauthorized rejection
- Always clean up: `clientSocket.disconnect()` and `app.close()`

---

## Common Patterns

### Typed Events

Define event interfaces for type safety:

```typescript
// src/modules/{feature}/types/{feature}-events.ts
export interface ServerToClientEvents {
  "{feature}-updated": (data: { id: string; [key: string]: any }) => void;
  "{feature}-created": (data: { id: string; [key: string]: any }) => void;
  "{feature}-deleted": (data: { id: string }) => void;
  "user-joined": (data: { userId: string; roomId: string }) => void;
  "user-left": (data: { userId: string; roomId: string }) => void;
  exception: (data: { status: string; message: string }) => void;
}

export interface ClientToServerEvents {
  "join-{feature}": (roomId: string) => void;
  "leave-{feature}": (roomId: string) => void;
  "{feature}-updated": (data: {
    id: string;
    roomId: string;
    [key: string]: any;
  }) => void;
}
```

### Presence Tracking

Track connected users per room:

```typescript
private connectedUsers = new Map<string, Set<string>>();

async handleConnection(client: Socket) {
  // ... auth logic ...
  const userId = client.data.user.id;
  // Track per-room presence in join handler
}

@SubscribeMessage('join-{feature}')
handleJoin(@ConnectedSocket() client: Socket, @MessageBody() roomId: string) {
  client.join(roomId);

  if (!this.connectedUsers.has(roomId)) {
    this.connectedUsers.set(roomId, new Set());
  }
  this.connectedUsers.get(roomId).add(client.data.user.id);

  // Broadcast updated presence
  this.server.to(roomId).emit('presence-update', {
    users: Array.from(this.connectedUsers.get(roomId)),
  });
}
```

---

## Prohibited Patterns

| Pattern                            | Why It's Wrong                    | Correct Approach                         |
| ---------------------------------- | --------------------------------- | ---------------------------------------- |
| ❌ Token in query string           | Exposes token in server logs/URLs | ✅ httpOnly cookie via handshake headers |
| ❌ `localStorage.getItem('token')` | XSS vulnerable                    | ✅ Cookie sent automatically             |
| ❌ No auth in `handleConnection`   | Unauthenticated access            | ✅ Verify JWT and disconnect on failure  |
| ❌ Gateway without namespace       | Event name collisions             | ✅ Use `namespace: '/{feature}'`         |
| ❌ Direct DB queries in gateway    | Bypasses service layer            | ✅ Inject and use service methods        |
| ❌ Hardcoded cookie name           | Breaks across environments        | ✅ Use `ConfigService.get()`             |

---

## Checklist

### Backend Gateway

- [ ] Install `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`, `cookie`
- [ ] Gateway class with `@WebSocketGateway()` decorator
- [ ] CORS configured with `credentials: true`
- [ ] Namespace set to `/{feature}`
- [ ] JWT auth in `handleConnection()` via cookie extraction
- [ ] Room join/leave handlers with `@SubscribeMessage()`
- [ ] Error handling with `WsException`
- [ ] Gateway registered as provider in module
- [ ] `JwtModule` imported in module
- [ ] E2E tests for gateway events

---

**Related Guides:**

- [authentication-cookies.md](authentication-cookies.md) - httpOnly cookie JWT pattern
- [middleware-guide.md](middleware-guide.md) - Guards and interceptors
- [services-and-repositories.md](services-and-repositories.md) - Service layer patterns
- [testing-guide.md](testing-guide.md) - Testing strategies
