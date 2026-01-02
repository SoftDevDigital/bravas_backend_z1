const fs = require('fs');
const path = require('path');

const mainPath = path.join(__dirname, '../dist/apps/user-service/main.js');
const nestedMainPath = path.join(__dirname, '../dist/apps/user-service/apps/user-service/src/main.js');

// Check if nested main.js exists
if (fs.existsSync(nestedMainPath)) {
  // Create main.js that re-exports from nested location
  fs.writeFileSync(mainPath, "module.exports = require('./apps/user-service/src/main.js');\n");
  console.log('✅ Created main.js at expected location');
} else {
  console.log('⚠️  Nested main.js not found, skipping...');
}
















