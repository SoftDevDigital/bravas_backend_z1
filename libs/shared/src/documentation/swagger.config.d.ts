import { INestApplication } from '@nestjs/common';
export interface SwaggerConfigOptions {
    title?: string;
    description?: string;
    version?: string;
    path?: string;
    environment?: 'dev' | 'prod';
    apiBaseUrl?: string;
}
export declare function setupSwagger(app: INestApplication, options?: SwaggerConfigOptions): void;
