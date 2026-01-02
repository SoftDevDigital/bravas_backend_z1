"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelationshipGuard = exports.AdminLevelGuard = exports.RolesGuard = exports.hasAdminLevel = exports.getAdminLevel = exports.isAdminRole = void 0;
exports.UseRoleGuards = UseRoleGuards;
const common_1 = require("@nestjs/common");
const base_dto_1 = require("../dto/base.dto");
Object.defineProperty(exports, "isAdminRole", { enumerable: true, get: function () { return base_dto_1.isAdminRole; } });
Object.defineProperty(exports, "getAdminLevel", { enumerable: true, get: function () { return base_dto_1.getAdminLevel; } });
Object.defineProperty(exports, "hasAdminLevel", { enumerable: true, get: function () { return base_dto_1.hasAdminLevel; } });
let RolesGuard = class RolesGuard {
    allowedRoles;
    constructor(allowedRoles) {
        this.allowedRoles = allowedRoles;
    }
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user) {
            throw new common_1.UnauthorizedException('Usuario no autenticado');
        }
        const userRole = user.role;
        if (!this.allowedRoles.includes(userRole)) {
            throw new common_1.ForbiddenException(`No tienes permisos para acceder a este recurso. Roles permitidos: ${this.allowedRoles.join(', ')}`);
        }
        return true;
    }
};
exports.RolesGuard = RolesGuard;
exports.RolesGuard = RolesGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Array])
], RolesGuard);
let AdminLevelGuard = class AdminLevelGuard {
    requiredLevel;
    constructor(requiredLevel) {
        this.requiredLevel = requiredLevel;
    }
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user) {
            throw new common_1.UnauthorizedException('Usuario no autenticado');
        }
        const userRole = user.role;
        if (!(0, base_dto_1.isAdminRole)(userRole)) {
            throw new common_1.ForbiddenException('Este recurso requiere permisos de administrador');
        }
        if (!(0, base_dto_1.hasAdminLevel)(userRole, this.requiredLevel)) {
            throw new common_1.ForbiddenException(`Este recurso requiere nivel de admin ${this.requiredLevel} o superior`);
        }
        return true;
    }
};
exports.AdminLevelGuard = AdminLevelGuard;
exports.AdminLevelGuard = AdminLevelGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Number])
], AdminLevelGuard);
let RelationshipGuard = class RelationshipGuard {
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const targetUserId = request.params.id || request.params.userId;
        if (!user) {
            throw new common_1.UnauthorizedException('Usuario no autenticado');
        }
        const userRole = user.role;
        const userId = user.userId || user.id;
        if (userId === targetUserId) {
            return true;
        }
        if ((0, base_dto_1.isAdminRole)(userRole)) {
            const level = (0, base_dto_1.getAdminLevel)(userRole);
            if (level === 3) {
                return true;
            }
        }
        if (userRole === base_dto_1.UserRole.SUPPORT) {
            return true;
        }
        throw new common_1.ForbiddenException('No tienes permisos para acceder a este recurso');
    }
};
exports.RelationshipGuard = RelationshipGuard;
exports.RelationshipGuard = RelationshipGuard = __decorate([
    (0, common_1.Injectable)()
], RelationshipGuard);
function UseRoleGuards(...guards) {
    return function (target, propertyKey, descriptor) {
    };
}
//# sourceMappingURL=roles.guard.js.map