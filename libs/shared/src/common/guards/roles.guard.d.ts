import { CanActivate, ExecutionContext } from '@nestjs/common';
import { UserRole, isAdminRole, getAdminLevel, hasAdminLevel } from '../dto/base.dto';
export { isAdminRole, getAdminLevel, hasAdminLevel };
export declare class RolesGuard implements CanActivate {
    private readonly allowedRoles;
    constructor(allowedRoles: UserRole[]);
    canActivate(context: ExecutionContext): boolean;
}
export declare class AdminLevelGuard implements CanActivate {
    private readonly requiredLevel;
    constructor(requiredLevel: number);
    canActivate(context: ExecutionContext): boolean;
}
export declare class RelationshipGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean;
}
export declare function UseRoleGuards(...guards: any[]): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void;
