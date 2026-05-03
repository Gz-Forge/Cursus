#!/usr/bin/env node
/**
 * bump-version.js
 * Abre una ventana en el navegador para ver y actualizar la versión de la app
 * en todos los archivos del proyecto donde aparezca.
 *
 * Uso: node scripts/bump-version.js
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { exec } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// ─── Directorios y archivos a ignorar ────────────────────────────────────────
const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.expo', 'dist', 'build',
  'android', 'ios', '.tauri', 'coverage',
]);
const INCLUDE_EXTS = new Set([
  '.json', '.ts', '.tsx', '.js', '.jsx', '.md',
]);
// Archivos individuales a ignorar (se compara el nombre base)
const IGNORE_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
]);

// ─── Leer versión actual desde package.json ──────────────────────────────────
function readCurrentVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  return pkg.version;
}

// ─── Buscar todos los archivos que contienen la versión ──────────────────────
function findFilesWithVersion(version) {
  const results = [];

  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir); } catch { return; }

    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry)) continue;
      const full = path.join(dir, entry);
      let stat;
      try { stat = fs.statSync(full); } catch { continue; }

      if (stat.isDirectory()) {
        walk(full);
      } else if (
        INCLUDE_EXTS.has(path.extname(entry).toLowerCase()) &&
        !IGNORE_FILES.has(entry)
      ) {
        let content;
        try { content = fs.readFileSync(full, 'utf8'); } catch { continue; }
        const count = (content.match(new RegExp(escapeRegex(version), 'g')) || []).length;
        if (count > 0) {
          results.push({
            file: path.relative(ROOT, full).replace(/\\/g, '/'),
            count,
          });
        }
      }
    }
  }

  walk(ROOT);
  return results;
}

// ─── Reemplazar versión en todos los archivos ────────────────────────────────
function replaceVersionInFiles(oldVer, newVer) {
  const files = findFilesWithVersion(oldVer);
  const updated = [];
  const errors  = [];

  for (const { file } of files) {
    const full = path.join(ROOT, file);
    try {
      const original = fs.readFileSync(full, 'utf8');
      const replaced  = original.split(oldVer).join(newVer);
      fs.writeFileSync(full, replaced, 'utf8');
      updated.push(file);
    } catch (e) {
      errors.push({ file, error: e.message });
    }
  }

  return { updated, errors };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── HTML de la interfaz ─────────────────────────────────────────────────────
function buildHTML(version, files) {
  const rows = files.map(f =>
    `<tr>
      <td class="file">${f.file}</td>
      <td class="count">${f.count} ${f.count === 1 ? 'vez' : 'veces'}</td>
    </tr>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bump Version — Cursus</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: #0f0f13;
      color: #e0e0e0;
      min-height: 100vh;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 40px 16px 60px;
    }

    .card {
      background: #1a1a24;
      border: 1px solid #2e2e3e;
      border-radius: 14px;
      padding: 36px 40px;
      width: 100%;
      max-width: 640px;
      box-shadow: 0 8px 40px rgba(0,0,0,.5);
    }

    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #BB86FC;
      margin-bottom: 4px;
    }

    .subtitle {
      font-size: 13px;
      color: #888;
      margin-bottom: 32px;
    }

    .version-row {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 28px;
    }

    .version-badge {
      background: #2a2a38;
      border: 1px solid #3e3e54;
      border-radius: 8px;
      padding: 10px 18px;
      font-size: 26px;
      font-weight: 700;
      color: #fff;
      letter-spacing: 1px;
      font-family: monospace;
      flex-shrink: 0;
    }

    .arrow {
      font-size: 22px;
      color: #555;
      flex-shrink: 0;
    }

    .input-wrap {
      flex: 1;
    }

    .input-wrap label {
      display: block;
      font-size: 11px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: .7px;
      margin-bottom: 6px;
    }

    input[type="text"] {
      width: 100%;
      background: #0f0f13;
      border: 1px solid #3e3e54;
      border-radius: 8px;
      color: #fff;
      font-size: 20px;
      font-weight: 700;
      font-family: monospace;
      padding: 10px 14px;
      outline: none;
      transition: border-color .2s;
    }

    input[type="text"]:focus {
      border-color: #BB86FC;
    }

    .btn {
      width: 100%;
      padding: 14px;
      background: #BB86FC;
      color: #000;
      font-size: 15px;
      font-weight: 700;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      transition: background .15s, opacity .15s;
      margin-bottom: 28px;
    }

    .btn:hover:not(:disabled) { background: #cda0ff; }
    .btn:disabled { opacity: .45; cursor: not-allowed; }

    .section-title {
      font-size: 11px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: .7px;
      margin-bottom: 10px;
    }

    .files-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .files-table tr {
      border-bottom: 1px solid #22222e;
    }

    .files-table tr:last-child {
      border-bottom: none;
    }

    td {
      padding: 8px 4px;
    }

    td.file {
      font-family: monospace;
      color: #ccc;
      word-break: break-all;
    }

    td.count {
      text-align: right;
      color: #888;
      white-space: nowrap;
      padding-left: 16px;
    }

    .empty {
      color: #555;
      font-size: 13px;
      font-style: italic;
      padding: 8px 0;
    }

    #result {
      margin-top: 20px;
      padding: 14px 18px;
      border-radius: 8px;
      font-size: 14px;
      display: none;
    }

    #result.ok {
      background: #1a2e1a;
      border: 1px solid #2a4a2a;
      color: #6fcf97;
      display: block;
    }

    #result.err {
      background: #2e1a1a;
      border: 1px solid #4a2a2a;
      color: #eb5757;
      display: block;
    }

    #result ul {
      margin-top: 8px;
      padding-left: 18px;
      font-family: monospace;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Bump Version — Cursus</h1>
    <p class="subtitle">Reemplaza la versión en todos los archivos del proyecto</p>

    <div class="version-row">
      <div>
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.7px;margin-bottom:6px">Versión actual</div>
        <div class="version-badge" id="currentBadge">${version}</div>
      </div>
      <div class="arrow">→</div>
      <div class="input-wrap">
        <label for="newVersion">Nueva versión</label>
        <input
          type="text"
          id="newVersion"
          placeholder="${version}"
          autocomplete="off"
          spellcheck="false"
        />
      </div>
    </div>

    <button class="btn" id="btnUpdate" onclick="doUpdate()">Actualizar</button>

    <div class="section-title">Archivos afectados (${files.length})</div>
    ${
      files.length === 0
        ? '<p class="empty">No se encontró la versión en ningún archivo.</p>'
        : `<table class="files-table"><tbody>${rows}</tbody></table>`
    }

    <div id="result"></div>
  </div>

  <script>
    const currentVersion = ${JSON.stringify(version)};

    async function doUpdate() {
      const newVer = document.getElementById('newVersion').value.trim();
      if (!newVer) { alert('Ingresá la nueva versión.'); return; }
      if (newVer === currentVersion) { alert('La versión nueva es igual a la actual.'); return; }
      if (!/^\\d+\\.\\d+\\.\\d+/.test(newVer)) {
        if (!confirm('El formato no parece semver (ej: 1.2.3). ¿Continuar igual?')) return;
      }

      const btn = document.getElementById('btnUpdate');
      btn.disabled = true;
      btn.textContent = 'Actualizando…';

      try {
        const res  = await fetch('/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldVersion: currentVersion, newVersion: newVer }),
        });
        const data = await res.json();

        const el = document.getElementById('result');
        if (data.ok) {
          el.className = 'ok';
          el.innerHTML =
            '<strong>✓ Versión actualizada a ' + newVer + '</strong>' +
            '<ul>' + data.updated.map(f => '<li>' + f + '</li>').join('') + '</ul>';
          document.getElementById('currentBadge').textContent = newVer;
        } else {
          el.className = 'err';
          el.innerHTML = '<strong>✗ Error al actualizar</strong>' +
            (data.errors?.length
              ? '<ul>' + data.errors.map(e => '<li>' + e.file + ': ' + e.error + '</li>').join('') + '</ul>'
              : '');
        }
      } catch (e) {
        const el = document.getElementById('result');
        el.className = 'err';
        el.textContent = 'Error de conexión: ' + e.message;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Actualizar';
      }
    }
  </script>
</body>
</html>`;
}

// ─── Servidor HTTP ────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    const version = readCurrentVersion();
    const files   = findFilesWithVersion(version);
    const html    = buildHTML(version, files);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  if (req.method === 'POST' && req.url === '/update') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { oldVersion, newVersion } = JSON.parse(body);
        if (!oldVersion || !newVersion || oldVersion === newVersion) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, errors: [{ file: '-', error: 'Versiones inválidas' }] }));
          return;
        }
        const { updated, errors } = replaceVersionInFiles(oldVersion, newVersion);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: errors.length === 0, updated, errors }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, errors: [{ file: '-', error: e.message }] }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(0, '127.0.0.1', () => {
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}`;
  console.log(`\n  Bump Version abierto en: ${url}\n  Presioná Ctrl+C para cerrar.\n`);

  // Abrir navegador (Windows / macOS / Linux)
  const opener =
    process.platform === 'win32'  ? `start "" "${url}"` :
    process.platform === 'darwin' ? `open "${url}"` :
    `xdg-open "${url}"`;

  exec(opener, err => {
    if (err) console.log(`  Abrí manualmente: ${url}`);
  });
});
