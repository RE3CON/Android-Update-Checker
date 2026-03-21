import fs from 'fs';

const logContent = fs.readFileSync('src/sdmaid_debug.log', 'utf8');
const fullData = JSON.parse(fs.readFileSync('src/fullData.json', 'utf8'));

// Extract package IDs from log
const match = logContent.match(/getRunningPackages\(\)=\[(.*?)\]/);
const pkgIds = [];
if (match) {
  const packagesString = match[1];
  const regex = /pkgId=([^,]+)/g;
  let pkgMatch;
  while ((pkgMatch = regex.exec(packagesString)) !== null) {
    pkgIds.push(pkgMatch[1]);
  }
}

// Create a map for quick lookup
const appMap = new Map(fullData.map((app: any) => [app.name, app.label]));

// Merge
const mergedApps = pkgIds.map(pkgId => ({
  name: pkgId,
  label: appMap.get(pkgId) || 'Unknown'
}));

console.log(JSON.stringify(mergedApps, null, 2));
