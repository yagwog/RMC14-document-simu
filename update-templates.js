// Script to generate template list from submodule
const fs = require('fs');
const path = require('path');

function scanDirectory(dir, basePath = '') {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  const templates = [];
  
  for (const item of items) {
    if (item.name.startsWith('.') || item.name === 'Before Tags') continue;
    
    const fullPath = path.join(dir, item.name);
    const relativePath = basePath ? `${basePath}/${item.name}` : item.name;
    
    if (item.isDirectory()) {
      templates.push(...scanDirectory(fullPath, relativePath));
    } else if (item.name.endsWith('.txt')) {
      templates.push(relativePath);
    }
  }
  
  return templates;
}

const templateDir = path.join(__dirname, 'templates-upstream', 'Main', 'RMC14');
if (fs.existsSync(templateDir)) {
  const templates = scanDirectory(templateDir);
  
  fs.writeFileSync(path.join(__dirname, 'template-list.json'), JSON.stringify(templates, null, 2));
  console.log(`Generated template list with ${templates.length} templates`);
} else {
  console.log('Template directory not found. Run git submodule update --init first.');
}