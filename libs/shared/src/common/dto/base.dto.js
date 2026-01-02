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
exports.RoleDto = exports.AdminLevel = exports.UserRole = exports.PaginatedResponse = exports.PaginationDto = exports.BaseDto = void 0;
exports.isAdminRole = isAdminRole;
exports.getAdminLevel = getAdminLevel;
exports.hasAdminLevel = hasAdminLevel;
const class_validator_1 = require("class-validator");
class BaseDto {
    id;
    createdAt;
    updatedAt;
}
exports.BaseDto = BaseDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BaseDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], BaseDto.prototype, "createdAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], BaseDto.prototype, "updatedAt", void 0);
class PaginationDto {
    page = 1;
    limit = 10;
}
exports.PaginationDto = PaginationDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], PaginationDto.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], PaginationDto.prototype, "limit", void 0);
class PaginatedResponse {
    data;
    page;
    limit;
    total;
    totalPages;
}
exports.PaginatedResponse = PaginatedResponse;
var UserRole;
(function (UserRole) {
    UserRole["USER"] = "user";
    UserRole["MODEL"] = "model";
    UserRole["AGENCY"] = "agency";
    UserRole["ADMIN_LEVEL_1"] = "admin_level_1";
    UserRole["ADMIN_LEVEL_2"] = "admin_level_2";
    UserRole["ADMIN_LEVEL_3"] = "admin_level_3";
    UserRole["SUPPORT"] = "support";
    UserRole["MODERATOR"] = "moderator";
})(UserRole || (exports.UserRole = UserRole = {}));
var AdminLevel;
(function (AdminLevel) {
    AdminLevel[AdminLevel["LEVEL_1"] = 1] = "LEVEL_1";
    AdminLevel[AdminLevel["LEVEL_2"] = 2] = "LEVEL_2";
    AdminLevel[AdminLevel["LEVEL_3"] = 3] = "LEVEL_3";
})(AdminLevel || (exports.AdminLevel = AdminLevel = {}));
function isAdminRole(role) {
    return role === UserRole.ADMIN_LEVEL_1 ||
        role === UserRole.ADMIN_LEVEL_2 ||
        role === UserRole.ADMIN_LEVEL_3;
}
function getAdminLevel(role) {
    switch (role) {
        case UserRole.ADMIN_LEVEL_1:
            return 1;
        case UserRole.ADMIN_LEVEL_2:
            return 2;
        case UserRole.ADMIN_LEVEL_3:
            return 3;
        default:
            return null;
    }
}
function hasAdminLevel(role, requiredLevel) {
    const level = getAdminLevel(role);
    return level !== null && level >= requiredLevel;
}
class RoleDto {
    role;
}
exports.RoleDto = RoleDto;
__decorate([
    (0, class_validator_1.IsEnum)(UserRole),
    __metadata("design:type", String)
], RoleDto.prototype, "role", void 0);
//# sourceMappingURL=base.dto.js.map