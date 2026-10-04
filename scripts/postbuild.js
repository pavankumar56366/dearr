const fs = require('fs');
const path = require('path');

function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  for (const item of fs.readdirSync(src)) {
    const s = path.join(src, item);
    const d = path.join(dest, item);
    if (fs.statSync(s).isDirectory()) {
      copyRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

function findFile(dir, fileName) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        const found = findFile(fullPath, fileName);
        if (found) return found;
      } else if (file === fileName) {
        return fullPath;
      }
    } catch {
      // ignore unreadable entries
    }
  }
  return null;
}

const rootDir = process.cwd();
const standaloneDir = path.join(rootDir, '.next', 'standalone');

if (!fs.existsSync(standaloneDir)) {
  console.log('[postbuild] Warning: .next/standalone does not exist.');
  process.exit(0);
}

const directServerJs = path.join(standaloneDir, 'server.js');

if (!fs.existsSync(directServerJs)) {
  console.log('[postbuild] server.js not at top of .next/standalone. Searching...');
  const foundServerJs = findFile(standaloneDir, 'server.js');
  if (foundServerJs) {
    const sourceDir = path.dirname(foundServerJs);
    console.log(`[postbuild] Flattening nested standalone from ${sourceDir} to ${standaloneDir}`);
    copyRecursive(sourceDir, standaloneDir);
  }
}

// Copy public assets to standalone
const publicSrc = path.join(rootDir, 'public');
const publicDest = path.join(standaloneDir, 'public');
if (fs.existsSync(publicSrc)) {
  console.log('[postbuild] Copying public assets to .next/standalone/public');
  copyRecursive(publicSrc, publicDest);
}

// Copy static assets to standalone
const staticSrc = path.join(rootDir, '.next', 'static');
const staticDest = path.join(standaloneDir, '.next', 'static');
if (fs.existsSync(staticSrc)) {
  console.log('[postbuild] Copying static assets to .next/standalone/.next/static');
  copyRecursive(staticSrc, staticDest);
}

// Also place server.js at .next/server.js and root server.js to satisfy any platform path convention
if (fs.existsSync(directServerJs)) {
  const nextServerJs = path.join(rootDir, '.next', 'server.js');
  fs.copyFileSync(directServerJs, nextServerJs);
  console.log('[postbuild] Copied server.js to .next/server.js');
}

console.log('[postbuild] Done. Standalone server verified at:', directServerJs, 'Exists:', fs.existsSync(directServerJs));
