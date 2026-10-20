const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const os = require('os');

let mainWindow = null;
let lanServer = null;
let lanPort = 3000;
let lanIps = [];

// Estado compartido de letras en el servidor local
let currentState = {
  type: 'FULL_SYNC',
  rawLrc: '',
  offsetMs: 350,
  position: 0,
  transport: 'stopped',
  duration: 0,
  projectName: 'OpenMT',
  options: {
    theme: 'transparent',
    mode: 'lowerthird',
    fontSize: 'large',
    uppercase: false,
    showNext: true,
  },
  timestamp: Date.now(),
};

const sseClients = new Set();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

function getLocalIpAddresses() {
  const ifaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(ifaces)) {
    for (const net of ifaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips.length > 0 ? ips : ['127.0.0.1'];
}

function startLanServer(distDir) {
  lanIps = getLocalIpAddresses();

  lanServer = http.createServer((req, res) => {
    // CORS headers para permitir conexiones de OBS y cualquier navegador
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    // 1. Endpoint SSE para letras en vivo (/api/lyrics/events)
    if (pathname === '/api/lyrics/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      });
      sseClients.add(res);
      res.write(`data: ${JSON.stringify(currentState)}\n\n`);

      req.on('close', () => {
        sseClients.delete(res);
      });
      return;
    }

    // 2. Endpoint REST (/api/lyrics/sync)
    if (pathname === '/api/lyrics/sync') {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            currentState = { ...currentState, ...data, timestamp: Date.now() };
            const payload = `data: ${JSON.stringify({ type: data.type || 'FULL_SYNC', ...currentState })}\n\n`;
            for (const client of sseClients) {
              try {
                client.write(payload);
              } catch {
                // ignore
              }
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'JSON inválido' }));
          }
        });
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(currentState));
      return;
    }

    // 3. Servir archivos estáticos desde dist
    if (!fs.existsSync(distDir)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('OpenMT Build directory not found');
      return;
    }

    let filePath = path.join(distDir, pathname === '/' ? 'index.html' : pathname);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Error al leer archivo: ${err.message}`);
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  });

  const tryListen = (port) => {
    lanServer.listen(port, '0.0.0.0', () => {
      lanPort = port;
      console.log(`[OpenMT LAN Server] Escuchando en 0.0.0.0:${lanPort}`);
    });

    lanServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        tryListen(port + 1);
      }
    });
  };

  tryListen(3000);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 820,
    minWidth: 920,
    minHeight: 620,
    title: 'OpenMT — Open Multitrack Workstation',
    icon: path.join(__dirname, '../public/images/favicon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
    autoHideMenuBar: true,
  });

  const distDir = path.join(__dirname, '../dist');
  startLanServer(distDir);

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    // En producción, cargar el servidor LAN local
    mainWindow.loadURL(`http://localhost:${lanPort}`);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('get-lan-info', () => {
  const primaryIp = lanIps[0] || '127.0.0.1';
  return {
    localUrl: `http://${primaryIp}:${lanPort}`,
    ips: lanIps,
    port: lanPort,
  };
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (lanServer) {
    try {
      lanServer.close();
    } catch {
      // ignore
    }
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
