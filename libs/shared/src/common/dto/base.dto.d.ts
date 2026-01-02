export declare class BaseDto {
    id?: string;
    createdAt?: string;
    updatedAt?: string;
}
export declare class PaginationDto {
    page?: number;
    limit?: number;
}
export declare class PaginatedResponse<T> {
    data: T[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}
export declare enum UserRole {
    USER = "user",
    MODEL = "model",
    AGENCY = "agency",
    ADMIN_LEVEL_1 = "admin_level_1",
    ADMIN_LEVEL_2 = "admin_level_2",
    ADMIN_LEVEL_3 = "admin_level_3",
    SUPPORT = "support",
    MODERATOR = "moderator"
}
export declare enum AdminLevel {
    LEVEL_1 = 1,
    LEVEL_2 = 2,
    LEVEL_3 = 3
}
export declare function isAdminRole(role: UserRole): boolean;
export declare function getAdminLevel(role: UserRole): number | null;
export declare function hasAdminLevel(role: UserRole, requiredLevel: number): boolean;
export declare class RoleDto {
    role: UserRole;
}
