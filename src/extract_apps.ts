import fs from 'fs';

const logContent = fs.readFileSync('src/sdmaid_debug.log', 'utf8');
const match = logContent.match(/getRunningPackages\(\)=\[(.*?)\]/);

if (match) {
  const packagesString = match[1];
  const pkgIds = [];
  const regex = /pkgId=([^,]+)/g;
  let pkgMatch;
  while ((pkgMatch = regex.exec(packagesString)) !== null) {
    pkgIds.push(pkgMatch[1]);
  }
  console.log(JSON.stringify(pkgIds, null, 2));
} else {
  console.log("Could not find getRunningPackages list.");
}
