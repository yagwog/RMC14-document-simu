// Script to generate template structure from submodule
const fs = require('fs');
const path = require('path');

function scanDirectory(dir, baseDir = '') {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  const result = {};
  
  for (const item of items) {
    if (item.name.startsWith('.') || item.name === 'Before Tags') continue;
    
    const fullPath = path.join(dir, item.name);
    
    if (item.isDirectory()) {
      const subResult = scanDirectory(fullPath, path.join(baseDir, item.name));
      if (Object.keys(subResult).length > 0) {
        result[item.name] = subResult;
      }
    } else if (item.name.endsWith('.txt')) {
      if (!result._files) result._files = [];
      result._files.push(item.name);
    }
  }
  
  // Convert _files arrays to direct arrays for leaf directories
  if (result._files && Object.keys(result).length === 1) {
    return result._files;
  }
  
  return result;
}

const templateDir = path.join(__dirname, 'templates-upstream', 'Main', 'RMC14');
if (fs.existsSync(templateDir)) {
  const structure = scanDirectory(templateDir);
  
  // Generate the structure object for logic.js
  const output = `// Auto-generated template structure
const TEMPLATE_STRUCTURE = ${JSON.stringify(structure, null, 2)};`;
  
  fs.writeFileSync(path.join(__dirname, 'template-structure.js'), output);
  console.log('Template structure updated!');
} else {
  console.log('Template directory not found. Run git submodule update --init first.');
}