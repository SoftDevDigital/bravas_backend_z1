// Tipos de AWS Lambda
interface Handler<TEvent = any, TResult = any> {
  (event: TEvent, context: any): Promise<TResult>;
}

interface S3EventRecord {
  eventName: string;
  s3: {
    bucket: { name: string };
    object: { key: string };
  };
}

interface S3Event {
  Records: S3EventRecord[];
}

interface DynamoDBStreamRecord {
  eventName: string;
  eventSourceARN?: string;
  dynamodb?: {
    NewImage?: any;
    OldImage?: any;
  };
}

interface DynamoDBStreamEvent {
  Records: DynamoDBStreamRecord[];
}
import { NestFactory } from '@nestjs/core';
import { UserServiceModule } from '../user-service.module';
import { S3EventListener } from '../listeners/s3-event.listener';
import { DynamoDBStreamListener } from '../listeners/dynamodb-stream.listener';

/**
 * Lambda Handler para eventos de S3
 * Se activa automáticamente cuando se suben archivos a S3
 */
export const s3EventHandler: Handler<S3Event> = async (event) => {
  const app = await NestFactory.createApplicationContext(UserServiceModule);
  const s3Listener = app.get(S3EventListener);
  
  try {
    await s3Listener.handleS3Event(event);
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error: any) {
    console.error('Error procesando evento S3:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

/**
 * Lambda Handler para DynamoDB Streams
 * Se activa automáticamente cuando hay cambios en DynamoDB
 */
export const dynamoDBStreamHandler: Handler<DynamoDBStreamEvent> = async (event) => {
  const app = await NestFactory.createApplicationContext(UserServiceModule);
  const streamListener = app.get(DynamoDBStreamListener);
  
  try {
    await streamListener.handleStreamEvent(event);
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error: any) {
    console.error('Error procesando DynamoDB Stream:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

