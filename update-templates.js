// Manual template structure updater

const fs = require('fs');
const path = require('path');

function scanDirectory(dir, basePath = '') {
  const structure = {};
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      const subStructure = scanDirectory(fullPath, path.join(basePath, item));
      if (Object.keys(subStructure).length > 0) {
        Object.assign(structure, subStructure);
      }
    } else if (item.endsWith('.txt')) {
      const folder = path.basename(dir);
      if (!structure[folder]) structure[folder] = [];
      structure[folder].push(item);
    }
  }
  
  return structure;
}

const templatesDir = './templates-upstream/Main/Updated RMC14';
if (fs.existsSync(templatesDir)) {
  const structure = scanDirectory(templatesDir);
  console.log('Template structure:');
  console.log(JSON.stringify(structure, null, 2));
  console.log('\nCopy this into the fetchTemplates() function in logic.js');
} else {
  console.log('Templates directory not found. Make sure submodule is initialized.');
}