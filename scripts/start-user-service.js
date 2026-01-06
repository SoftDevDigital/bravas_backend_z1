const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Ejecutar el script de fix primero
const fixScriptPath = path.join(__dirname, 'fix-user-service-main.js');
console.log('🔧 Ejecutando fix de main.js...');
try {
  require(fixScriptPath);
} catch (error) {
  console.warn('⚠️  Error al ejecutar fix script:', error.message);
}

// Verificar que main.js existe
const mainPath = path.join(__dirname, '../dist/apps/user-service/main.js');
if (!fs.existsSync(mainPath)) {
  console.error('❌ Error: main.js no encontrado en:', mainPath);
  console.error('   Por favor ejecuta: npm run build:user');
  process.exit(1);
}

console.log('✅ main.js encontrado, iniciando servicio...\n');

// Ejecutar nest start
const isWatch = process.argv.includes('--watch');
const command = isWatch 
  ? 'nest start user-service --watch'
  : 'nest start user-service';

if (isWatch) {
  // En modo watch, ejecutar el fix periódicamente
  const fixInterval = setInterval(() => {
    try {
      require(fixScriptPath);
    } catch (error) {
      // Ignorar errores en el intervalo
    }
  }, 2000); // Cada 2 segundos
  
  // Limpiar intervalo al salir
  process.on('SIGINT', () => {
    clearInterval(fixInterval);
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    clearInterval(fixInterval);
    process.exit(0);
  });
}

try {
  execSync(command, { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
} catch (error) {
  process.exit(error.status || 1);
}

