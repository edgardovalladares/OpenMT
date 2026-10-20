import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';

function lyricsSyncPlugin(): Plugin {
  let currentState: Record<string, unknown> = {
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

  const sseClients = new Set<ServerResponse>();

  return {
    name: 'openmt-lyrics-sync',
    configureServer(server) {
      server.middlewares.use('/api/lyrics/events', (req: IncomingMessage, res: ServerResponse) => {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
        });
        sseClients.add(res);

        // Enviar estado actual de inmediato al conectar
        res.write(`data: ${JSON.stringify({ type: 'FULL_SYNC', ...currentState })}\n\n`);

        req.on('close', () => {
          sseClients.delete(res);
        });
      });

      server.middlewares.use('/api/lyrics/sync', (req: IncomingMessage, res: ServerResponse) => {
        // Manejar preflight OPTIONS
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          });
          res.end();
          return;
        }

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
              res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              });
              res.end(JSON.stringify({ ok: true }));
            } catch {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
          });
        } else {
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(JSON.stringify({ type: 'FULL_SYNC', ...currentState }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), lyricsSyncPlugin()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1200, // el WASM de Signalsmith viene embebido en el paquete
  },
});
