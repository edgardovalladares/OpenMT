import type { LyricsSyncMessage, LyricsDisplayOptions } from '../types/lyrics';
import type { DataConnection } from 'peerjs';

export const CHANNEL_NAME = 'openmt_lyrics_channel';
export const STORAGE_KEY = 'openmt_lyrics_state';
export const LOCAL_API_SYNC = '/api/lyrics/sync';
export const LOCAL_API_EVENTS = '/api/lyrics/events';
export const ROOM_KEY = 'openmt_persistent_room';
export const ROOM_LOCKED_KEY = 'openmt_room_locked';

export function getPersistentRoom(): string {
  if (typeof window === 'undefined') return 'openmt-live-default';
  try {
    let r = localStorage.getItem(ROOM_KEY);
    if (!r) {
      r = `openmt-live-${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem(ROOM_KEY, r);
    }
    return r;
  } catch {
    return 'openmt-live-default';
  }
}

export function isRoomLocked(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const val = localStorage.getItem(ROOM_LOCKED_KEY);
    // Por defecto bloqueado para evitar tener que cambiar el enlace en OBS
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setRoomLocked(locked: boolean) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ROOM_LOCKED_KEY, String(locked));
  } catch {
    // ignore
  }
}

export function regeneratePersistentRoom(): string {
  if (typeof window === 'undefined') return getPersistentRoom();
  try {
    const newRoom = `openmt-live-${Math.random().toString(36).substring(2, 8)}`;
    localStorage.setItem(ROOM_KEY, newRoom);
    setActiveRoom(newRoom);
    return newRoom;
  } catch {
    return getPersistentRoom();
  }
}

let channel: BroadcastChannel | null = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
} catch {
  channel = null;
}

let activeRoom: string | null = typeof window !== 'undefined' ? getPersistentRoom() : null;
let lastSyncPostTime = 0;
let lastTimeBroadcast = 0;

// Host WebRTC connections (PeerJS)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let hostPeerInstance: any = null;
const hostPeerConnections = new Set<DataConnection>();

export function isLocalHost(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '[::1]' ||
    h.startsWith('192.168.') ||
    h.startsWith('10.') ||
    h.startsWith('172.') ||
    h.endsWith('.local')
  );
}

export function setActiveRoom(room: string | null) {
  activeRoom = room;
  if (!room) {
    if (hostPeerInstance) {
      try {
        hostPeerInstance.destroy();
      } catch {
        // ignore
      }
      hostPeerInstance = null;
      hostPeerConnections.clear();
    }
    return;
  }

  // Si ya tenemos un peer con esta sala, conservarlo
  if (hostPeerInstance && hostPeerInstance.id === room) return;

  if (typeof window !== 'undefined') {
    try {
      if (hostPeerInstance) {
        try {
          hostPeerInstance.destroy();
        } catch {
          // ignore
        }
        hostPeerConnections.clear();
      }

      import('peerjs')
        .then(({ Peer }) => {
          const p = new Peer(room, {
            debug: 0,
            config: {
              iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' },
              ],
            },
          });

          p.on('open', () => {
            hostPeerInstance = p;
          });

          p.on('connection', (conn) => {
            hostPeerConnections.add(conn);

            conn.on('open', () => {
              // Enviar inmediatamente sincronización completa al nuevo visor
              const stored = getStoredLyricsState();
              try {
                conn.send({
                  type: 'FULL_SYNC',
                  rawLrc: stored.rawLrc ?? '',
                  offsetMs: stored.offsetMs ?? 350,
                  position: stored.position ?? 0,
                  transport: stored.transport ?? 'stopped',
                  duration: stored.duration ?? 0,
                  options: stored.options,
                  projectName: stored.projectName,
                  room,
                  timestamp: Date.now(),
                });
              } catch {
                // ignore
              }
            });

            conn.on('data', (data: unknown) => {
              const msg = data as { type?: string };
              if (msg && msg.type === 'REQUEST_FULL_SYNC') {
                const stored = getStoredLyricsState();
                try {
                  conn.send({
                    type: 'FULL_SYNC',
                    rawLrc: stored.rawLrc ?? '',
                    offsetMs: stored.offsetMs ?? 350,
                    position: stored.position ?? 0,
                    transport: stored.transport ?? 'stopped',
                    duration: stored.duration ?? 0,
                    options: stored.options,
                    projectName: stored.projectName,
                    room,
                    timestamp: Date.now(),
                  });
                } catch {
                  // ignore
                }
              }
            });

            conn.on('close', () => {
              hostPeerConnections.delete(conn);
            });

            conn.on('error', () => {
              hostPeerConnections.delete(conn);
            });
          });

          p.on('error', (err) => {
            console.warn('[OpenMT PeerJS Host]', err?.type || err);
          });
        })
        .catch(() => {});
    } catch {
      // ignore
    }
  }
}

export function getActiveRoom(): string | null {
  return activeRoom;
}

/**
 * Envia el mensaje a todos los visores remotos conectados por WebRTC
 */
function sendToPeerClients(msg: LyricsSyncMessage) {
  if (hostPeerConnections.size > 0) {
    for (const conn of hostPeerConnections) {
      if (conn.open) {
        try {
          conn.send(msg);
        } catch {
          hostPeerConnections.delete(conn);
        }
      }
    }
  }
}

/**
 * Envia actualización al endpoint local de Vite (/api/lyrics/sync)
 */
function postToServerRelay(msg: LyricsSyncMessage) {
  if (isLocalHost()) {
    try {
      void fetch(LOCAL_API_SYNC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg),
      }).catch(() => {
        // Silenciar si no está corriendo el dev server
      });
    } catch {
      // ignore
    }
  }
}

/**
 * Emite una actualización de tiempo desde el DAW principal
 */
export function broadcastTimeUpdate(
  position: number,
  transport: 'playing' | 'stopped' | 'paused',
  duration: number,
) {
  const now = Date.now();
  // Throttling: ~25 actualizaciones por segundo cuando reproduce
  if (transport === 'playing' && now - lastTimeBroadcast < 40) {
    return;
  }
  lastTimeBroadcast = now;

  const msg: LyricsSyncMessage = {
    type: 'TIME_UPDATE',
    position,
    transport,
    duration,
    timestamp: now,
  };

  // 1. BroadcastChannel (mismo navegador)
  if (channel) {
    try {
      channel.postMessage(msg);
    } catch {
      // ignore
    }
  }

  // 1.1 IPC directo nativo de Electron para servidor LAN
  if (typeof window !== 'undefined' && window.electronAPI?.sendLyricsSync) {
    try {
      window.electronAPI.sendLyricsSync(msg);
    } catch {
      // ignore
    }
  }

  // 2. Relay local para OBS en el equipo
  if (now - lastSyncPostTime > 50 || transport !== 'playing') {
    lastSyncPostTime = now;
    postToServerRelay(msg);
  }

  // 3. WebRTC DataChannels para pantallas remotas
  sendToPeerClients(msg);

  // 4. Guardar en localStorage (incluyendo explícitamente type y timestamp)
  try {
    const existing = getStoredLyricsState();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...existing,
        type: 'TIME_UPDATE',
        position,
        transport,
        duration,
        timestamp: now,
      }),
    );
  } catch {
    // ignore
  }
}

/**
 * Emite una actualización completa de letra, offset y opciones visuales
 */
export function broadcastLyricsUpdate(
  rawLrc: string,
  offsetMs: number,
  projectName?: string,
  options?: Partial<LyricsDisplayOptions>,
) {
  const now = Date.now();
  const msg: LyricsSyncMessage = {
    type: 'LYRICS_UPDATE',
    rawLrc,
    offsetMs,
    projectName,
    options,
    room: activeRoom ?? undefined,
    timestamp: now,
  };

  if (channel) {
    try {
      channel.postMessage(msg);
    } catch {
      // ignore
    }
  }

  if (typeof window !== 'undefined' && window.electronAPI?.sendLyricsSync) {
    try {
      window.electronAPI.sendLyricsSync(msg);
    } catch {
      // ignore
    }
  }

  postToServerRelay(msg);
  sendToPeerClients(msg);

  try {
    const existing = getStoredLyricsState();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...existing,
        type: 'LYRICS_UPDATE',
        rawLrc,
        offsetMs,
        projectName: projectName ?? existing.projectName,
        options: options ?? existing.options,
        timestamp: now,
      }),
    );
  } catch {
    // ignore
  }
}

/**
 * Responde a peticiones de sincronización completa
 */
export function broadcastFullSync(state: {
  rawLrc: string;
  offsetMs: number;
  position: number;
  transport: 'playing' | 'stopped' | 'paused';
  duration: number;
  projectName: string;
  options?: Partial<LyricsDisplayOptions>;
}) {
  const now = Date.now();
  const msg: LyricsSyncMessage = {
    type: 'FULL_SYNC',
    ...state,
    room: activeRoom ?? undefined,
    timestamp: now,
  };

  if (channel) {
    try {
      channel.postMessage(msg);
    } catch {
      // ignore
    }
  }

  if (typeof window !== 'undefined' && window.electronAPI?.sendLyricsSync) {
    try {
      window.electronAPI.sendLyricsSync(msg);
    } catch {
      // ignore
    }
  }

  postToServerRelay(msg);
  sendToPeerClients(msg);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msg));
  } catch {
    // ignore
  }
}

/**
 * Solicita sincronización completa
 */
export function requestFullSync() {
  if (channel) {
    try {
      channel.postMessage({ type: 'REQUEST_FULL_SYNC', timestamp: Date.now() });
    } catch {
      // ignore
    }
  }
}

/**
 * Obtiene el estado guardado más reciente desde localStorage
 */
export function getStoredLyricsState(): Partial<LyricsSyncMessage> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Se suscribe a los mensajes de sincronización de letra (para OBS, popup o pantallas)
 * Combina:
 * 1. BroadcastChannel (para ventanas del mismo navegador)
 * 2. EventSource local de Vite (/api/lyrics/events para OBS en localhost/red)
 * 3. WebRTC DataChannel directo (si se especifica room)
 * 4. Eventos de localStorage
 */
export function subscribeLyricsSync(
  callback: (msg: LyricsSyncMessage) => void,
  room?: string,
): () => void {
  // 1. BroadcastChannel
  const handleMessage = (e: MessageEvent<LyricsSyncMessage>) => {
    if (e.data) {
      callback(e.data);
    }
  };

  if (channel) {
    channel.addEventListener('message', handleMessage);
  }

  // 2. Storage event
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed) {
          callback(parsed);
        }
      } catch {
        // ignore
      }
    }
  };
  window.addEventListener('storage', handleStorage);

  // 3. Server-Sent Events (SSE) local para OBS en localhost / red local
  let sse: EventSource | null = null;
  let sseTimeoutId: ReturnType<typeof setTimeout> | null = null;

  function connectLocalSSE() {
    if (isLocalHost()) {
      try {
        sse = new EventSource(LOCAL_API_EVENTS);
        sse.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed) {
              callback(parsed);
            }
          } catch {
            // ignore
          }
        };
        sse.onerror = () => {
          if (sse) {
            try {
              sse.close();
            } catch {
              // ignore
            }
            sse = null;
          }
          // Reconectar en 2 segundos
          sseTimeoutId = setTimeout(connectLocalSSE, 2000);
        };
      } catch {
        sse = null;
      }
    }
  }

  connectLocalSSE();

  // 4. WebRTC PeerJS Client si hay sala remota configurada
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let clientPeer: any = null;

  if (room && typeof window !== 'undefined') {
    try {
      import('peerjs')
        .then(({ Peer }) => {
          clientPeer = new Peer({
            debug: 0,
            config: {
              iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' },
              ],
            },
          });

          clientPeer.on('open', () => {
            const conn = clientPeer.connect(room, { reliable: true });

            conn.on('open', () => {
              try {
                conn.send({ type: 'REQUEST_FULL_SYNC', timestamp: Date.now() });
              } catch {
                // ignore
              }
            });

            conn.on('data', (data: unknown) => {
              if (data) {
                callback(data as LyricsSyncMessage);
              }
            });

            conn.on('close', () => {
              // Reintentar conexión tras 2 segundos si el peer sigue vivo
              setTimeout(() => {
                if (clientPeer && !clientPeer.destroyed) {
                  try {
                    const retry = clientPeer.connect(room, { reliable: true });
                    retry.on('data', (d: unknown) => {
                      if (d) callback(d as LyricsSyncMessage);
                    });
                  } catch {
                    // ignore
                  }
                }
              }, 2000);
            });
          });

          clientPeer.on('error', (err: unknown) => {
            console.warn('[OpenMT PeerJS Client]', err);
          });
        })
        .catch(() => {});
    } catch {
      // ignore
    }
  }

  let unlistenIpc: (() => void) | null = null;
  if (typeof window !== 'undefined' && window.electronAPI?.onLyricsSync) {
    try {
      unlistenIpc = window.electronAPI.onLyricsSync((data) => {
        if (data) callback(data as LyricsSyncMessage);
      });
    } catch {
      // ignore
    }
  }

  return () => {
    if (unlistenIpc) {
      unlistenIpc();
    }
    if (channel) {
      channel.removeEventListener('message', handleMessage);
    }
    window.removeEventListener('storage', handleStorage);
    if (sseTimeoutId) {
      clearTimeout(sseTimeoutId);
    }
    if (sse) {
      try {
        sse.close();
      } catch {
        // ignore
      }
    }
    if (clientPeer) {
      try {
        clientPeer.destroy();
      } catch {
        // ignore
      }
    }
  };
}
