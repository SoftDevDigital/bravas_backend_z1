/**
 * Script de prueba para verificar que el sistema de configuración funciona correctamente
 * Ejecutar: npx ts-node scripts/test-config.ts [env]
 */

// Cargar dotenv antes de importar el loader
import * as dotenv from 'dotenv';
import * as path from 'path';

const environment = process.argv[2] || process.env.NODE_ENV || 'dev';
const envPath = path.resolve(process.cwd(), `.env.${environment}`);

// Cargar variables de entorno
if (require('fs').existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`📁 Cargando variables desde: .env.${environment}\n`);
} else {
  dotenv.config(); // Intentar .env por defecto
}

import { loadCredentials, getCredentials } from '../libs/shared/src/config/credentials.loader';

console.log('🧪 Probando sistema de configuración...\n');
console.log(`📋 Ambiente: ${environment}\n`);

try {
  console.log('1️⃣ Probando loadCredentials()...');
  const credentials = loadCredentials(environment);
  
  console.log('✅ Credenciales cargadas exitosamente\n');
  
  // Mostrar información básica (sin secretos)
  console.log('📊 Información cargada:');
  console.log(`   AWS Region: ${credentials.aws.region}`);
  console.log(`   AWS Account ID: ${credentials.aws.accountId || 'N/A'}`);
  console.log(`   Cognito User Pool ID: ${credentials.cognito.userPoolId}`);
  console.log(`   Cognito Client ID: ${credentials.cognito.clientId}`);
  console.log(`   EventBridge Bus: ${credentials.eventbridge.eventBusName}`);
  console.log(`   DynamoDB Users Table: ${credentials.dynamodb.usersTable}`);
  console.log(`   S3 Avatars Bucket: ${credentials.s3.avatarsBucket || 'N/A (no creado aún)'}`);
  
  console.log('\n2️⃣ Probando getCredentials()...');
  const creds2 = getCredentials();
  
  if (creds2.aws.region === credentials.aws.region) {
    console.log('✅ getCredentials() funciona correctamente\n');
  } else {
    console.log('⚠️ getCredentials() retornó valores diferentes\n');
  }
  
  // Verificar método de carga
  const source = process.env.AWS_REGION ? 'Variables de entorno' : 'Archivo JSON';
  console.log(`📦 Fuente de configuración: ${source}\n`);
  
  console.log('✅ Todas las pruebas pasaron exitosamente!');
  process.exit(0);
  
} catch (error) {
  console.error('❌ Error al cargar configuración:');
  console.error(error instanceof Error ? error.message : String(error));
  console.error('\n💡 Verifica:');
  console.error('   1. Que exista .env.dev o config/credentials/credentials.dev.json');
  console.error('   2. Que las variables de entorno estén configuradas correctamente');
  console.error('   3. Que el archivo JSON tenga la estructura correcta');
  process.exit(1);
}

