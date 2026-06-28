#!/usr/bin/env node
/**
 * Dev helper: writes gallery-tested-cards.json when the debug panel toggles "Tested".
 * Run alongside Expo: npm run gallery-tested-sync
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'gallery-tested-cards.json');
const PORT = 3939;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readFileIds() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return [...new Set(raw.testedDefinitionIds ?? [])].sort();
  } catch {
    return [];
  }
}

function writeFileIds(ids) {
  const sorted = [...new Set(ids)].sort();
  fs.writeFileSync(
    FILE,
    `${JSON.stringify({ testedDefinitionIds: sorted }, null, 2)}\n`
  );
  return sorted;
}

const server = http.createServer((req, res) => {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/gallery-tested-cards') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ testedDefinitionIds: readFileIds() }));
    return;
  }

  if (req.method === 'PUT' && req.url === '/gallery-tested-cards') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body || '{}');
        const ids = parsed.testedDefinitionIds ?? parsed;
        if (!Array.isArray(ids)) {
          res.writeHead(400);
          res.end('expected testedDefinitionIds array');
          return;
        }
        const written = writeFileIds(ids);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ testedDefinitionIds: written }));
        console.log(`[gallery-tested-sync] wrote ${written.length} ids`);
      } catch (err) {
        res.writeHead(400);
        res.end(String(err));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[gallery-tested-sync] http://127.0.0.1:${PORT}/gallery-tested-cards`);
  console.log(`[gallery-tested-sync] file: ${FILE}`);
});
