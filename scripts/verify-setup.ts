/**
 * Script completo de verificación del setup del proyecto
 * Verifica: compilación, configuración, dependencias, etc.
 */

import * as fs from 'fs';
import * as path from 'path';

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

const checks: CheckResult[] = [];

console.log('🔍 Verificando setup del proyecto BRAVAS_BACKEND_Z1...\n');

// 1. Verificar estructura de directorios
function checkDirectory(dir: string, required: boolean = true): CheckResult {
  const exists = fs.existsSync(path.resolve(process.cwd(), dir));
  return {
    name: `Directorio: ${dir}`,
    status: exists ? 'pass' : (required ? 'fail' : 'warn'),
    message: exists ? '✅ Existe' : (required ? '❌ No existe (requerido)' : '⚠️ No existe (opcional)'),
  };
}

// 2. Verificar archivos de configuración
function checkFile(file: string, required: boolean = true): CheckResult {
  const exists = fs.existsSync(path.resolve(process.cwd(), file));
  return {
    name: `Archivo: ${file}`,
    status: exists ? 'pass' : (required ? 'fail' : 'warn'),
    message: exists ? '✅ Existe' : (required ? '❌ No existe (requerido)' : '⚠️ No existe (opcional)'),
  };
}

// 3. Verificar que existe al menos un método de configuración
function checkConfigMethod(): CheckResult {
  const envDev = fs.existsSync(path.resolve(process.cwd(), '.env.dev'));
  const credsDev = fs.existsSync(path.resolve(process.cwd(), 'config/credentials/credentials.dev.json'));
  const envExample = fs.existsSync(path.resolve(process.cwd(), '.env.example'));
  
  if (envDev || credsDev) {
    return {
      name: 'Método de configuración',
      status: 'pass',
      message: envDev ? '✅ Variables de entorno (.env.dev)' : '✅ Archivo JSON (credentials.dev.json)',
    };
  }
  
  if (envExample) {
    return {
      name: 'Método de configuración',
      status: 'warn',
      message: '⚠️ Solo existe .env.example - crea .env.dev o credentials.dev.json',
    };
  }
  
  return {
    name: 'Método de configuración',
    status: 'warn',
    message: '⚠️ No se encontró .env.dev ni credentials.dev.json - Crea uno de estos archivos para continuar (ver CONFIGURACION-COMPLETA.md)',
  };
}

// Ejecutar verificaciones
checks.push(checkDirectory('libs/shared', true));
checks.push(checkDirectory('config/credentials', true));
checks.push(checkDirectory('terraform', true));
checks.push(checkDirectory('serverless', true));
checks.push(checkFile('package.json', true));
checks.push(checkFile('tsconfig.json', true));
checks.push(checkFile('.env.example', false));
checks.push(checkFile('config/credentials/credentials.example.json', false));
checks.push(checkConfigMethod());
checks.push(checkFile('libs/shared/package.json', true));
checks.push(checkFile('libs/shared/tsconfig.json', true));

// Verificar que shared tiene las dependencias necesarias
function checkSharedDependencies(): CheckResult {
  try {
    const pkgPath = path.resolve(process.cwd(), 'libs/shared/package.json');
    if (!fs.existsSync(pkgPath)) {
      return {
        name: 'Dependencias de @bravas/shared',
        status: 'fail',
        message: '❌ package.json no encontrado',
      };
    }
    
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const hasNestConfig = pkg.dependencies?.['@nestjs/config'];
    const hasDotenv = pkg.dependencies?.['dotenv'];
    
    if (hasNestConfig && hasDotenv) {
      return {
        name: 'Dependencias de @bravas/shared',
        status: 'pass',
        message: '✅ @nestjs/config y dotenv instalados',
      };
    }
    
    return {
      name: 'Dependencias de @bravas/shared',
      status: 'warn',
      message: `⚠️ Faltan dependencias: ${!hasNestConfig ? '@nestjs/config ' : ''}${!hasDotenv ? 'dotenv' : ''}`,
    };
  } catch (error) {
    return {
      name: 'Dependencias de @bravas/shared',
      status: 'fail',
      message: `❌ Error al leer package.json: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

checks.push(checkSharedDependencies());

// Mostrar resultados
console.log('📋 Resultados de verificación:\n');

let passCount = 0;
let warnCount = 0;
let failCount = 0;

checks.forEach((check) => {
  const icon = check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌';
  console.log(`${icon} ${check.name}: ${check.message}`);
  
  if (check.status === 'pass') passCount++;
  else if (check.status === 'warn') warnCount++;
  else failCount++;
});

console.log('\n📊 Resumen:');
console.log(`   ✅ Pasaron: ${passCount}`);
console.log(`   ⚠️  Advertencias: ${warnCount}`);
console.log(`   ❌ Fallaron: ${failCount}`);

if (failCount === 0) {
  console.log('\n🎉 ¡Setup verificado correctamente!');
  if (warnCount > 0) {
    console.log('⚠️  Hay algunas advertencias, pero no son críticas.');
  }
  process.exit(0);
} else {
  console.log('\n❌ Hay errores que deben corregirse antes de continuar.');
  process.exit(1);
}

