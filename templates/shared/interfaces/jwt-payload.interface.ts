/**
 * JWT token payload interface.
 *
 * TODO: CUSTOMIZE — Add/remove fields to match your project's user model.
 * The `role` field uses string to stay generic — projects can narrow to their own RoleEnum.
 */
export interface IJwtPayload {
    id: string;
    email: string;
    role: string;

    // Common optional fields — uncomment as needed:
    // fullName?: string;
    // phone?: string | null;
    // image?: string | null;
    // isActive?: boolean;
}
