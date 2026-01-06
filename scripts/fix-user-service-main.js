const fs = require('fs');
const path = require('path');

const mainPath = path.join(__dirname, '../dist/apps/user-service/main.js');
const nestedMainPath = path.join(__dirname, '../dist/apps/user-service/apps/user-service/src/main.js');
const directMainPath = path.join(__dirname, '../dist/apps/user-service/src/main.js');

function createMainFile() {
  // Check if nested main.js exists (old structure)
  if (fs.existsSync(nestedMainPath)) {
    // Create main.js that re-exports from nested location
    const content = "module.exports = require('./apps/user-service/src/main.js');\n";
    if (!fs.existsSync(mainPath) || fs.readFileSync(mainPath, 'utf8') !== content) {
      // Asegurar que el directorio existe
      const mainDir = path.dirname(mainPath);
      if (!fs.existsSync(mainDir)) {
        fs.mkdirSync(mainDir, { recursive: true });
      }
      fs.writeFileSync(mainPath, content);
      console.log('✅ Created/updated main.js at expected location (from nested path)');
    }
    return true;
  } 
  // Check if direct main.js exists (new structure with rootDir)
  else if (fs.existsSync(directMainPath)) {
    // Create main.js that re-exports from direct location
    const content = "module.exports = require('./src/main.js');\n";
    if (!fs.existsSync(mainPath) || fs.readFileSync(mainPath, 'utf8') !== content) {
      // Asegurar que el directorio existe
      const mainDir = path.dirname(mainPath);
      if (!fs.existsSync(mainDir)) {
        fs.mkdirSync(mainDir, { recursive: true });
      }
      fs.writeFileSync(mainPath, content);
      console.log('✅ Created/updated main.js at expected location (from direct path)');
    }
    return true;
  } 
  else {
    return false;
  }
}

// Ejecutar inmediatamente
if (!createMainFile()) {
  console.log('⚠️  main.js not found in expected locations, skipping...');
  console.log('   Looking for:', nestedMainPath);
  console.log('   Or:', directMainPath);
}

// Exportar función para uso en otros scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createMainFile };
}

























