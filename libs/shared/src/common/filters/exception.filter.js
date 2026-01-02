"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var GlobalExceptionFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
let GlobalExceptionFilter = GlobalExceptionFilter_1 = class GlobalExceptionFilter {
    logger = new common_1.Logger(GlobalExceptionFilter_1.name);
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        let status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';
        let errorCode = 'INTERNAL_ERROR';
        let details = null;
        if (exception instanceof common_1.HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();
            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
            }
            else if (typeof exceptionResponse === 'object') {
                const responseObj = exceptionResponse;
                message = responseObj.message || exception.message || message;
                errorCode = responseObj.errorCode || this.getErrorCode(status);
                details = responseObj.details || null;
            }
        }
        else if (exception instanceof Error) {
            message = exception.message;
            errorCode = 'UNKNOWN_ERROR';
        }
        this.logger.error(`Exception caught: ${errorCode} - ${message}`, {
            errorCode,
            message,
            status,
            path: request.path,
            method: request.method,
            userId: request.user?.userId,
            ip: request.ip,
            stack: process.env.NODE_ENV === 'development' ? exception.stack : undefined,
        });
        const responseBody = {
            success: false,
            error: {
                code: errorCode,
                message,
                statusCode: status,
                timestamp: new Date().toISOString(),
                path: request.path,
            },
        };
        if (details) {
            responseBody.error.details = details;
        }
        if (process.env.NODE_ENV === 'development' && exception instanceof Error && exception.stack) {
            responseBody.error.stack = exception.stack;
        }
        response.status(status).json(responseBody);
    }
    getErrorCode(status) {
        const errorCodes = {
            400: 'BAD_REQUEST',
            401: 'UNAUTHORIZED',
            403: 'FORBIDDEN',
            404: 'NOT_FOUND',
            409: 'CONFLICT',
            422: 'UNPROCESSABLE_ENTITY',
            429: 'TOO_MANY_REQUESTS',
            500: 'INTERNAL_SERVER_ERROR',
            502: 'BAD_GATEWAY',
            503: 'SERVICE_UNAVAILABLE',
        };
        return errorCodes[status] || 'UNKNOWN_ERROR';
    }
};
exports.GlobalExceptionFilter = GlobalExceptionFilter;
exports.GlobalExceptionFilter = GlobalExceptionFilter = GlobalExceptionFilter_1 = __decorate([
    (0, common_1.Catch)()
], GlobalExceptionFilter);
//# sourceMappingURL=exception.filter.js.map