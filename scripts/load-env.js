/**
 * Script helper para cargar variables de entorno desde archivo .env
 * Uso: node scripts/load-env.js [env]
 * Ejemplo: node scripts/load-env.js dev
 */

const fs = require('fs');
const path = require('path');

const env = process.argv[2] || process.env.NODE_ENV || 'dev';
const envFile = path.resolve(__dirname, '..', `.env.${env}`);

if (!fs.existsSync(envFile)) {
  console.error(`❌ Archivo .env.${env} no encontrado en: ${envFile}`);
  console.log(`💡 Crea el archivo copiando .env.example a .env.${env}`);
  process.exit(1);
}

// Leer y parsear el archivo .env
const envContent = fs.readFileSync(envFile, 'utf-8');
const envVars = {};

envContent.split('\n').forEach((line) => {
  line = line.trim();
  
  // Ignorar comentarios y líneas vacías
  if (!line || line.startsWith('#')) {
    return;
  }
  
  // Parsear KEY=VALUE
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let value = match[2].trim();
    
    // Remover comillas si existen
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    envVars[key] = value;
  }
});

// Exportar variables
console.log(`✅ Cargando variables de entorno desde .env.${env}`);
Object.keys(envVars).forEach((key) => {
  process.env[key] = envVars[key];
  console.log(`   ${key}=${key.includes('SECRET') || key.includes('KEY') ? '***' : envVars[key]}`);
});

console.log(`\n✅ ${Object.keys(envVars).length} variables cargadas`);



























