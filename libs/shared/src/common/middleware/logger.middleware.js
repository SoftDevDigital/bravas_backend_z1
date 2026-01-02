"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestLoggerMiddleware = void 0;
const common_1 = require("@nestjs/common");
const uuid_1 = require("uuid");
let RequestLoggerMiddleware = class RequestLoggerMiddleware {
    logger = new common_1.Logger('HTTP');
    use(req, res, next) {
        const isSwaggerRoute = req.originalUrl.startsWith('/api-docs') ||
            req.originalUrl.startsWith('/openapi.json') ||
            req.originalUrl.startsWith('/swagger-ui') ||
            req.originalUrl.startsWith('/favicon.ico');
        if (isSwaggerRoute) {
            return next();
        }
        const requestId = req.headers['x-request-id'] || (0, uuid_1.v4)();
        req.requestId = requestId;
        res.setHeader('X-Request-ID', requestId);
        const { method, originalUrl, ip } = req;
        const userAgent = req.get('user-agent') || '';
        const startTime = Date.now();
        const logger = this.logger;
        this.logger.log(`[${requestId}] ${method} ${originalUrl} - ${ip} - ${userAgent}`);
        const originalSend = res.send;
        res.send = function (body) {
            const duration = Date.now() - startTime;
            const statusCode = res.statusCode;
            if (statusCode >= 400) {
                logger.error(`[${requestId}] ${method} ${originalUrl} ${statusCode} - ${duration}ms`, {
                    requestId,
                    method,
                    url: originalUrl,
                    statusCode,
                    duration,
                    ip,
                    userId: req.user?.userId,
                });
            }
            else {
                logger.log(`[${requestId}] ${method} ${originalUrl} ${statusCode} - ${duration}ms`);
            }
            return originalSend.call(this, body);
        };
        next();
    }
};
exports.RequestLoggerMiddleware = RequestLoggerMiddleware;
exports.RequestLoggerMiddleware = RequestLoggerMiddleware = __decorate([
    (0, common_1.Injectable)()
], RequestLoggerMiddleware);
//# sourceMappingURL=logger.middleware.js.map