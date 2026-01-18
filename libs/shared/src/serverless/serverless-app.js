"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerlessApp = void 0;
const core_1 = require("@nestjs/core");
const platform_express_1 = require("@nestjs/platform-express");
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const common_1 = require("@nestjs/common");
const exception_filter_1 = require("../common/filters/exception.filter");
const transform_interceptor_1 = require("../common/interceptors/transform.interceptor");
const logger_middleware_1 = require("../common/middleware/logger.middleware");
const documentation_1 = require("../documentation");
class ServerlessApp {
    options;
    app;
    expressApp;
    constructor(options) {
        this.options = options;
    }
    async createApp() {
        this.expressApp = (0, express_1.default)();
        const adapter = new platform_express_1.ExpressAdapter(this.expressApp);
        this.app = await core_1.NestFactory.create(this.options.module, adapter, {
            logger: ['error', 'warn', 'log'],
        });
        this.app.use((0, helmet_1.default)());
        this.app.use((0, compression_1.default)({
            level: 6,
            threshold: 1024,
            filter: (req, res) => {
                if (req.headers['x-no-compression']) {
                    return false;
                }
                return compression_1.default.filter(req, res);
            },
        }));
        if (this.options.enableCors !== false) {
            this.app.enableCors({
                origin: this.options.corsOrigin || '*',
                methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
                allowedHeaders: 'Content-Type, Authorization, X-Requested-With',
                credentials: true,
            });
        }
        if (this.options.globalPrefix) {
            this.app.setGlobalPrefix(this.options.globalPrefix);
        }
        this.app.useGlobalPipes(new common_1.ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        }));
        this.app.useGlobalFilters(new exception_filter_1.GlobalExceptionFilter());
        this.app.useGlobalInterceptors(new transform_interceptor_1.TransformInterceptor());
        const loggerMiddleware = new logger_middleware_1.RequestLoggerMiddleware();
        this.app.use(loggerMiddleware.use.bind(loggerMiddleware));
        if (this.options.enableSwagger !== false) {
            const isProduction = process.env.NODE_ENV === 'production';
            if (!isProduction || this.options.enableSwagger === true) {
                (0, documentation_1.setupSwagger)(this.app, {
                    ...this.options.swaggerConfig,
                    environment: isProduction ? 'prod' : 'dev',
                    globalPrefix: this.options.globalPrefix,
                });
            }
        }
        await this.app.init();
        return this.app;
    }
    getApp() {
        return this.app;
    }
    getExpressApp() {
        return this.expressApp;
    }
    async close() {
        if (this.app) {
            await this.app.close();
        }
    }
}
exports.ServerlessApp = ServerlessApp;
//# sourceMappingURL=serverless-app.js.map