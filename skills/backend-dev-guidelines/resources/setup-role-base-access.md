# Role-Based Access Control (RBAC) Setup Guide

This guide explains how to implement role-based access control for API endpoints in NestJS applications.

## Overview

The application uses a layered authorization system:

1. **JwtAuthGuard** (Global) - All routes require JWT authentication by default
2. **RolesGuard** (Per-controller) - Restricts access based on user roles
3. **OwnerOrAdminGuard** - Allows access if user is admin OR resource owner
4. **ResourceAssignmentGuard** - Verifies user has assignment to access a resource (custom)

## Core Roles

Define your application roles in an enum:

```typescript
// src/shared/enums/role.enum.ts
export enum RolesEnum {
    ADMIN = 1,
    USER = 2,
    MODERATOR = 3,
    // Add your domain-specific roles here
    // Example: MANAGER = 4, EMPLOYEE = 5
    // Example: SELLER = 4, BUYER = 5
    // Example: INSTRUCTOR = 4, STUDENT = 5
}
```

## Core Decorators

### Import Statement

```typescript
import {
    Public,
    AdminOnly,
    AdminOrOwner,
    ModeratorOrAdmin,
    RequireRoles,
} from 'src/core/decorators';
```

### Decorator Reference

| Decorator             | Description             | Use Case                              |
| --------------------- | ----------------------- | ------------------------------------- |
| `@Public()`           | Bypasses authentication | Login, registration, public endpoints |
| `@AdminOnly()`        | Admin role required     | User management, system settings      |
| `@AdminOrOwner()`     | Admin OR resource owner | View/edit own profile                 |
| `@ModeratorOrAdmin()` | Moderator or Admin      | Content moderation                    |
| `@RequireRoles(...)`  | Custom role combination | Flexible access control               |

## Usage Examples

### 1. Public Endpoint (No Authentication)

```typescript
@Public()
@Post('register')
async register(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
}
```

### 2. Admin-Only Endpoint

```typescript
@AdminOnly()
@Get('users')
async listAllUsers() {
    return this.userService.findAll();
}
```

### 3. Admin or Resource Owner

```typescript
@AdminOrOwner()
@Get(':id')
async getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.findOne(id);
}
```

### 4. Custom Role Requirement

```typescript
@RequireRoles(RolesEnum.MODERATOR, RolesEnum.ADMIN)
@Delete('comments/:id')
async deleteComment(@Param('id') id: string) {
    return this.commentService.remove(id);
}
```

---

## Creating Domain-Specific Roles

When your application has domain-specific roles (e.g., Manager/Employee, Seller/Buyer, Instructor/Student), follow this pattern:

### Step 1: Add Roles to Enum

```typescript
// src/shared/enums/role.enum.ts
export enum RolesEnum {
    ADMIN = 1,
    USER = 2,
    MODERATOR = 3,
    // Domain-specific roles
    MANAGER = 4,
    EMPLOYEE = 5,
}
```

### Step 2: Create Composite Decorators

```typescript
// src/core/decorators/role-access.decorator.ts
import { applyDecorators, UseGuards, SetMetadata } from '@nestjs/common';
import { RolesGuard } from '../guards/roles.guard';
import { RolesEnum } from '@shared/enums/role.enum';

// Decorator for manager-only endpoints
export const ManagerOnly = () =>
    applyDecorators(SetMetadata('roles', [RolesEnum.MANAGER]), UseGuards(RolesGuard));

// Decorator for employee-only endpoints
export const EmployeeOnly = () =>
    applyDecorators(SetMetadata('roles', [RolesEnum.EMPLOYEE]), UseGuards(RolesGuard));

// Decorator for manager or admin
export const ManagerOrAdmin = () =>
    applyDecorators(
        SetMetadata('roles', [RolesEnum.MANAGER, RolesEnum.ADMIN]),
        UseGuards(RolesGuard),
    );

// Decorator for manager or employee
export const ManagerOrEmployee = () =>
    applyDecorators(
        SetMetadata('roles', [RolesEnum.MANAGER, RolesEnum.EMPLOYEE]),
        UseGuards(RolesGuard),
    );
```

### Step 3: Use in Controllers

```typescript
@ApiTags('Reports')
@Controller('reports')
export class ReportController {
    // Manager creates reports
    @ManagerOnly()
    @Post()
    async create(@Body() dto: CreateReportDto) {}

    // Employee views their own reports
    @EmployeeOnly()
    @Get('my-reports')
    async getMyReports(@CurrentUser('id') userId: string) {}

    // Manager views all team reports
    @ManagerOrAdmin()
    @Get('team')
    async getTeamReports() {}
}
```

---

## Resource Assignment Pattern

For scenarios where one role needs access to another's data (e.g., manager viewing employee data, instructor viewing student work), implement an assignment-based access model.

### Step 1: Create Assignment Entity

```typescript
// src/modules/assignments/resource-assignment.entity.ts
@Entity('resource_assignments')
export class ResourceAssignment extends BaseEntity {
    @Column({ name: 'owner_id', type: 'uuid' })
    ownerId: string; // The user who has access (e.g., manager)

    @Column({ name: 'resource_owner_id', type: 'uuid' })
    resourceOwnerId: string; // The user whose resources can be accessed (e.g., employee)

    @Column({ name: 'is_active', type: 'boolean', default: true })
    isActive: boolean;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'owner_id' })
    owner: User;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'resource_owner_id' })
    resourceOwner: User;
}
```

### Step 2: Create Assignment Service

```typescript
// src/modules/assignments/resource-assignment.service.ts
@Injectable()
export class ResourceAssignmentService {
    constructor(private readonly repository: ResourceAssignmentRepository) {}

    async isResourceAssigned(ownerId: string, resourceOwnerId: string): Promise<boolean> {
        const assignment = await this.repository.findOne({
            where: { ownerId, resourceOwnerId, isActive: true },
        });
        return !!assignment;
    }

    async assignResource(ownerId: string, resourceOwnerId: string): Promise<ResourceAssignment> {
        return this.repository.create({ ownerId, resourceOwnerId, isActive: true });
    }

    async removeAssignment(ownerId: string, resourceOwnerId: string): Promise<void> {
        await this.repository.update(
            { ownerId, resourceOwnerId },
            { isActive: false },
        );
    }

    async getAssignedResources(ownerId: string): Promise<User[]> {
        const assignments = await this.repository.find({
            where: { ownerId, isActive: true },
            relations: ['resourceOwner'],
        });
        return assignments.map((a) => a.resourceOwner);
    }
}
```

### Step 3: Create Assignment Guard

```typescript
// src/core/guards/resource-assignment.guard.ts
@Injectable()
export class ResourceAssignmentGuard implements CanActivate {
    constructor(private readonly assignmentService: ResourceAssignmentService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        // Admins bypass assignment check
        if (user.role === RolesEnum.ADMIN) {
            return true;
        }

        // Get resource owner ID from route parameter
        const resourceOwnerId = request.params.userId || request.params.resourceOwnerId;

        if (!resourceOwnerId) {
            throw new BadRequestException('Resource owner ID not found in request');
        }

        const isAssigned = await this.assignmentService.isResourceAssigned(
            user.id,
            resourceOwnerId,
        );

        if (!isAssigned) {
            throw new ForbiddenException('Access denied. Resource is not assigned to you.');
        }

        return true;
    }
}
```

### Step 4: Create Composite Decorator

```typescript
// src/core/decorators/role-access.decorator.ts
export const AssignedResourceOnly = () =>
    applyDecorators(
        SetMetadata('roles', [RolesEnum.MANAGER]),
        UseGuards(RolesGuard, ResourceAssignmentGuard),
    );
```

### Step 5: Use in Controllers

```typescript
@ApiTags('Employee Data')
@Controller('employees')
export class EmployeeDataController {
    // Employee views their own data
    @EmployeeOnly()
    @Get('my-data')
    async getMyData(@CurrentUser('id') userId: string) {}

    // Manager views assigned employee's data
    @AssignedResourceOnly()
    @Get(':userId/data')
    async getEmployeeData(@Param('userId', ParseUUIDPipe) userId: string) {}
}
```

---

## Controller Setup Patterns

### Pattern 1: Resource Owner with Supervisor View

```typescript
@ApiTags('Tasks')
@Controller('tasks')
export class TaskController {
    // Employee submits their own task
    @EmployeeOnly()
    @Post()
    async create(@CurrentUser('id') userId: string, @Body() dto: CreateTaskDto) {}

    // Employee views their own tasks
    @EmployeeOnly()
    @Get('my-tasks')
    async getMyTasks(@CurrentUser('id') userId: string) {}

    // Manager views assigned employee's tasks
    @AssignedResourceOnly()
    @Get('user/:userId')
    async getEmployeeTasks(@Param('userId') userId: string) {}
}
```

### Pattern 2: Admin-Managed Resources

```typescript
@ApiTags('Products')
@Controller('products')
export class ProductController {
    // Admin creates products
    @AdminOnly()
    @Post()
    async create(@Body() dto: CreateProductDto) {}

    // All authenticated users can view
    @Get()
    async findAll() {}

    // Admin updates
    @AdminOnly()
    @Patch(':id')
    async update(@Param('id') id: string) {}

    // Admin deletes
    @AdminOnly()
    @Delete(':id')
    async remove(@Param('id') id: string) {}
}
```

### Pattern 3: Role-Specific Endpoints

```typescript
@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
    // Manager dashboard
    @ManagerOnly()
    @Get('manager')
    async getManagerDashboard(@CurrentUser('id') userId: string) {}

    // Employee dashboard
    @EmployeeOnly()
    @Get('employee')
    async getEmployeeDashboard(@CurrentUser('id') userId: string) {}

    // Admin dashboard (all data)
    @AdminOnly()
    @Get('admin')
    async getAdminDashboard() {}
}
```

---

## Error Responses

### 401 Unauthorized

- Missing JWT token
- Invalid/expired token

### 403 Forbidden

- Valid token but insufficient role
- Not the resource owner
- Resource not assigned to user

Example error responses:

```json
{
    "statusCode": 403,
    "message": "Access denied. Required roles: MANAGER",
    "error": "Forbidden"
}
```

```json
{
    "statusCode": 403,
    "message": "Access denied. Resource is not assigned to you.",
    "error": "Forbidden"
}
```

---

## Swagger Documentation

Add 403 error to ApiSwagger decorator when using role restrictions:

```typescript
@ManagerOnly()
@Get('team/summary')
@ApiSwagger({
    resourceName: 'Reports',
    operation: 'getTeamSummary',
    errors: [
        { status: 401, description: 'Unauthorized' },
        { status: 403, description: 'Forbidden - Manager access required' },
    ],
})
async getTeamSummary() {}
```

---

## Files Reference

| File                                           | Purpose                    |
| ---------------------------------------------- | -------------------------- |
| `src/core/decorators/role-access.decorator.ts` | Composite decorators       |
| `src/core/decorators/roles.decorator.ts`       | Base @Roles() decorator    |
| `src/core/guards/roles.guard.ts`               | Role validation guard      |
| `src/core/guards/owner-or-admin.guard.ts`      | Owner/admin check guard    |
| `src/core/guards/resource-assignment.guard.ts` | Assignment validation      |
| `src/shared/enums/role.enum.ts`                | Role definitions           |
| `src/modules/assignments/`                     | Assignment entity/service  |

---

## Best Practices

1. **Use composite decorators** (e.g., `@ManagerOnly()`) instead of `@UseGuards(RolesGuard) @Roles(...)` for cleaner code

2. **Apply at method level** for granular control, class level for uniform access

3. **Always document** 403 errors in Swagger when using role restrictions

4. **Use assignment guards** for hierarchical access patterns (supervisor viewing subordinate data)

5. **Keep `@Public()`** only for truly public endpoints (login, register, public content)

6. **Delete operations** should typically be `@AdminOnly()` for safety

7. **Organize role-specific endpoints** with clear URL prefixes (e.g., `/manager/...`, `/employee/...`)

8. **Supervisor-view of subordinate data** should use `/:userId/...` pattern with assignment guards
