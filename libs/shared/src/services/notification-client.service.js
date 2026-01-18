"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationClient = void 0;
const axios_1 = __importDefault(require("axios"));
class NotificationClient {
    client;
    apiKey;
    constructor(baseUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3006/api/v1', apiKey = process.env.INTERNAL_API_KEY || 'bravas-internal-key-dev') {
        this.client = axios_1.default.create({
            baseURL: baseUrl,
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-API-Key': apiKey,
            },
        });
        this.apiKey = apiKey;
    }
    async createNotification(params) {
        try {
            const response = await this.client.post('/notifications/internal/create', params);
            return response.data?.data || null;
        }
        catch (error) {
            console.error('[NotificationClient] Error al crear notificación:', error.message);
            return null;
        }
    }
    async createNotifications(params) {
        if (params.length === 0)
            return [];
        try {
            const response = await this.client.post('/notifications/internal/create-batch', {
                notifications: params,
            });
            if (response.data?.success && response.data?.data?.notifications) {
                return response.data.data.notifications;
            }
            return await this.createNotificationsFallback(params);
        }
        catch (error) {
            if (error.response?.status === 404) {
                return await this.createNotificationsFallback(params);
            }
            console.error('[NotificationClient] Error al crear notificaciones en batch:', error.message);
            return [];
        }
    }
    async createNotificationsFallback(params) {
        const batchSize = 10;
        const results = [];
        for (let i = 0; i < params.length; i += batchSize) {
            const batch = params.slice(i, i + batchSize);
            const promises = batch.map(p => this.createNotification(p));
            const batchResults = await Promise.allSettled(promises);
            const successful = batchResults
                .filter((r) => r.status === 'fulfilled' && r.value !== null)
                .map(r => r.value);
            results.push(...successful);
        }
        return results;
    }
    async createBulkNotification(userIds, type, title, message, options) {
        const notifications = userIds.map(userId => ({
            userId,
            type,
            title,
            message,
            link: options?.link,
            metadata: options?.metadata,
            ttl: options?.ttl,
        }));
        const results = await this.createNotifications(notifications);
        return {
            created: results.length,
            failed: userIds.length - results.length,
        };
    }
}
exports.NotificationClient = NotificationClient;
//# sourceMappingURL=notification-client.service.js.map