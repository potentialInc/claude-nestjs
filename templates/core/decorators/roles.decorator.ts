import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Mark a route with required roles.
 * Uses string[] to stay generic — projects can narrow to their own RoleEnum after copying.
 *
 * Usage: @Roles('admin', 'manager')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
