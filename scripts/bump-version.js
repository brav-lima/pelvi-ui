#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const type = process.argv[2] || 'patch';
if (!['patch', 'minor', 'major'].includes(type)) {
  console.error(`Tipo inválido: "${type}". Use patch, minor ou major.`);
  process.exit(1);
}

const pkgPath = path.join(__dirname, '..', 'frontend', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const oldVersion = pkg.version;
const [major, minor, patch] = pkg.version.split('.').map(Number);

if (type === 'major') pkg.version = `${major + 1}.0.0`;
else if (type === 'minor') pkg.version = `${major}.${minor + 1}.0`;
else pkg.version = `${major}.${minor}.${patch + 1}`;

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

execSync(`git add "${pkgPath}"`, { stdio: 'inherit' });
execSync(`git commit -m "chore: bump version to ${pkg.version}"`, { stdio: 'inherit' });

console.log(`\n✓ ${oldVersion} → ${pkg.version}`);
