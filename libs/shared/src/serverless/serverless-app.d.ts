import { NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import { SwaggerConfigOptions } from '../documentation';
export interface ServerlessAppOptions {
    module: any;
    globalPrefix?: string;
    enableCors?: boolean;
    enableSwagger?: boolean;
    swaggerConfig?: SwaggerConfigOptions;
    corsOrigin?: string | string[];
}
export declare class ServerlessApp {
    private options;
    private app;
    private expressApp;
    constructor(options: ServerlessAppOptions);
    createApp(): Promise<NestExpressApplication>;
    getApp(): NestExpressApplication;
    getExpressApp(): express.Application;
    close(): Promise<void>;
}
