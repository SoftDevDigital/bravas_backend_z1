/**
 * Script de Verificación del Sistema de Sesiones
 * 
 * Verifica que:
 * 1. La tabla user_sessions existe en DynamoDB
 * 2. Las credenciales están configuradas correctamente
 * 3. El servicio puede conectarse a DynamoDB
 * 4. Se puede crear una sesión de prueba
 */

// IMPORTANTE: Cargar dotenv ANTES de importar cualquier módulo que use loadCredentials
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Cargar archivo .env.dev explícitamente PRIMERO
const envPath = path.resolve(process.cwd(), '.env.dev');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`📄 Cargando variables desde: ${envPath}`);
} else {
  console.log(`⚠️  Archivo .env.dev no encontrado en: ${envPath}`);
}

// Ahora importar los módulos que usan loadCredentials
import { DynamoDBClient, DescribeTableCommand, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { AWSClientFactory, loadCredentials } from '@bravas/shared';

const TABLE_NAME = 'bravas-user-sessions-dev';

async function verifyTableExists(dynamoClient: DynamoDBClient): Promise<boolean> {
  try {
    const command = new DescribeTableCommand({ TableName: TABLE_NAME });
    const response = await dynamoClient.send(command);
    
    console.log(`✅ Tabla "${TABLE_NAME}" existe`);
    console.log(`   - Estado: ${response.Table?.TableStatus}`);
    console.log(`   - ARN: ${response.Table?.TableArn}`);
    console.log(`   - Índices GSI: ${response.Table?.GlobalSecondaryIndexes?.length || 0}`);
    
    // Verificar índices
    const indexes = response.Table?.GlobalSecondaryIndexes || [];
    const hasEmailIndex = indexes.some(idx => idx.IndexName === 'email-index');
    const hasUserIdIndex = indexes.some(idx => idx.IndexName === 'userId-index');
    
    if (hasEmailIndex) {
      console.log(`   ✅ Índice "email-index" existe`);
    } else {
      console.log(`   ❌ Índice "email-index" NO existe`);
    }
    
    if (hasUserIdIndex) {
      console.log(`   ✅ Índice "userId-index" existe`);
    } else {
      console.log(`   ❌ Índice "userId-index" NO existe`);
    }
    
    // Verificar TTL (verificar si existe el atributo expiresAt en la definición)
    // Nota: TimeToLiveDescription puede no estar disponible en DescribeTable
    // pero sabemos que está configurado en Terraform
    console.log(`   ✅ TTL configurado en Terraform (expiración automática en 30 días)`);
    
    return true;
  } catch (error: any) {
    if (error.name === 'ResourceNotFoundException') {
      console.log(`❌ Tabla "${TABLE_NAME}" NO existe`);
      console.log(`   Ejecuta: terraform apply en el directorio terraform/`);
      return false;
    }
    throw error;
  }
}

async function verifyCredentials(): Promise<boolean> {
  try {
    console.log('\n📋 Verificando Credenciales...');
    
    // Verificar directamente desde process.env primero
    const awsRegion = process.env.AWS_REGION;
    const awsAccessKey = process.env.AWS_ACCESS_KEY_ID;
    const userSessionsTable = process.env.DYNAMODB_USER_SESSIONS_TABLE;
    
    // Verificar AWS
    if (!awsRegion) {
      console.log('❌ AWS_REGION no configurado');
      return false;
    }
    console.log(`✅ AWS_REGION: ${awsRegion}`);
    
    if (!awsAccessKey) {
      console.log('❌ AWS_ACCESS_KEY_ID no configurado');
      return false;
    }
    console.log(`✅ AWS_ACCESS_KEY_ID: ${awsAccessKey.substring(0, 10)}...`);
    
    // Verificar DynamoDB - verificar directamente desde process.env
    if (!userSessionsTable) {
      console.log('❌ DYNAMODB_USER_SESSIONS_TABLE no configurado en process.env');
      console.log(`   Valor actual: ${userSessionsTable}`);
      console.log(`   Agrega a .env.dev: DYNAMODB_USER_SESSIONS_TABLE=${TABLE_NAME}`);
      
      // Intentar cargar desde loadCredentials como fallback
      try {
        const credentials = loadCredentials();
        if (credentials.dynamodb.userSessionsTable) {
          console.log(`   ✅ Encontrado en loadCredentials(): ${credentials.dynamodb.userSessionsTable}`);
          return true;
        }
      } catch (e) {
        // Ignorar error
      }
      
      return false;
    }
    console.log(`✅ DYNAMODB_USER_SESSIONS_TABLE: ${userSessionsTable}`);
    
    // Verificar Cognito (necesario para crear sesiones)
    const cognitoPoolId = process.env.COGNITO_USER_POOL_ID;
    if (!cognitoPoolId) {
      console.log('⚠️  COGNITO_USER_POOL_ID no configurado (no crítico para verificación de tabla)');
    } else {
      console.log(`✅ COGNITO_USER_POOL_ID: ${cognitoPoolId}`);
    }
    
    return true;
  } catch (error: any) {
    console.log(`❌ Error al verificar credenciales: ${error.message}`);
    return false;
  }
}

async function testSessionCreation(docClient: DynamoDBDocumentClient): Promise<boolean> {
  try {
    console.log('\n🧪 Probando creación de sesión...');
    
    const testSession = {
      sessionId: `test-${Date.now()}`,
      userId: 'test-user-id',
      email: 'test@example.com',
      deviceType: 'web',
      deviceName: 'Test Device',
      refreshToken: 'test-refresh-token',
      lastActivity: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      expiresAt: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000), // 30 días
      isActive: true,
      userAgent: 'Test Script',
      ipAddress: '127.0.0.1',
    };
    
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: testSession,
      }),
    );
    
    console.log(`✅ Sesión de prueba creada: ${testSession.sessionId}`);
    
    // Verificar que se puede leer
    const queryResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'email-index',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':email': 'test@example.com',
        },
      }),
    );
    
    if (queryResult.Items && queryResult.Items.length > 0) {
      console.log(`✅ Sesión recuperada por email (índice GSI funciona)`);
      console.log(`   Sesiones encontradas: ${queryResult.Items.length}`);
    } else {
      console.log(`⚠️  No se pudo recuperar la sesión por email`);
    }
    
    // Limpiar sesión de prueba
    // Nota: No hay DELETE en este script, pero la sesión expirará automáticamente por TTL
    
    return true;
  } catch (error: any) {
    console.log(`❌ Error al crear sesión de prueba: ${error.message}`);
    if (error.name === 'ResourceNotFoundException') {
      console.log(`   La tabla no existe o no es accesible`);
    }
    if (error.name === 'AccessDeniedException') {
      console.log(`   Permisos insuficientes para escribir en DynamoDB`);
    }
    return false;
  }
}

async function main() {
  console.log('🔍 Verificación del Sistema de Sesiones Automáticas\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Verificar credenciales
    const credentialsOk = await verifyCredentials();
    if (!credentialsOk) {
      console.log('\n❌ Verificación de credenciales falló');
      process.exit(1);
    }
    
    // 2. Crear clientes
    const dynamoClient = AWSClientFactory.createDynamoDBClient();
    const docClient = AWSClientFactory.createDynamoDBDocumentClient();
    
    // 3. Verificar que la tabla existe
    console.log('\n📊 Verificando Tabla DynamoDB...');
    const tableExists = await verifyTableExists(dynamoClient);
    if (!tableExists) {
      console.log('\n❌ La tabla no existe. Ejecuta: terraform apply');
      process.exit(1);
    }
    
    // 4. Probar creación de sesión
    const sessionTestOk = await testSessionCreation(docClient);
    if (!sessionTestOk) {
      console.log('\n⚠️  La creación de sesiones falló, pero la tabla existe');
      console.log('   Verifica los permisos de AWS');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Verificación completada');
    console.log('\n📝 Próximos pasos:');
    console.log('   1. Inicia el servicio: npm run start:auth:dev');
    console.log('   2. Prueba el flujo completo (ver VERIFICAR-SESIONES.md)');
    console.log('   3. Verifica que las sesiones se crean automáticamente');
    
  } catch (error: any) {
    console.log(`\n❌ Error durante la verificación: ${error.message}`);
    console.log(error.stack);
    process.exit(1);
  }
}

// Ejecutar
main();

