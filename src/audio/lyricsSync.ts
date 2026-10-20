import type { LyricsSyncMessage, LyricsDisplayOptions } from '../types/lyrics';

const CHANNEL_NAME = 'openmt_lyrics_channel';
const STORAGE_KEY = 'openmt_lyrics_state';
const LOCAL_API_SYNC = '/api/lyrics/sync';
const LOCAL_API_EVENTS = '/api/lyrics/events';

let channel: BroadcastChannel | null = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
} catch {
  channel = null;
}

let activeRoom: string | null = null;
let lastSyncPostTime = 0;
let lastTimeBroadcast = 0;

export function setActiveRoom(room: string | null) {
  activeRoom = room;
}

export function getActiveRoom(): string | null {
  return activeRoom;
}

/**
 * Envia actualización al endpoint local de Vite (/api/lyrics/sync) y a la sala online si está activa.
 */
function postToServerRelay(msg: LyricsSyncMessage) {
  // 1. Servidor local de Vite (para OBS en localhost)
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
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

  // 2. Si hay una sala remota activa (para enlaces temporales de compartir)
  if (activeRoom) {
    try {
      void fetch(`https://ntfy.sh/${activeRoom}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg),
      }).catch(() => {
        // ignore
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
  // Throttling: máximo 20-25 actualizaciones por segundo para transporte jugando (suficiente para 60fps visuales suaves)
  if (transport === 'playing' && now - lastTimeBroadcast < 45) {
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

  if (channel) {
    try {
      channel.postMessage(msg);
    } catch {
      // ignore
    }
  }

  // Enviar a los servidores locales y online
  if (now - lastSyncPostTime > 60 || transport !== 'playing') {
    lastSyncPostTime = now;
    postToServerRelay(msg);
  }

  // Guardar en localStorage
  try {
    const existing = getStoredLyricsState();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...existing,
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
  const msg: LyricsSyncMessage = {
    type: 'LYRICS_UPDATE',
    rawLrc,
    offsetMs,
    projectName,
    options,
    room: activeRoom ?? undefined,
    timestamp: Date.now(),
  };

  if (channel) {
    try {
      channel.postMessage(msg);
    } catch {
      // ignore
    }
  }

  postToServerRelay(msg);

  try {
    const existing = getStoredLyricsState();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...existing,
        rawLrc,
        offsetMs,
        projectName: projectName ?? existing.projectName,
        options: options ?? existing.options,
        timestamp: Date.now(),
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
  const msg: LyricsSyncMessage = {
    type: 'FULL_SYNC',
    ...state,
    room: activeRoom ?? undefined,
    timestamp: Date.now(),
  };

  if (channel) {
    try {
      channel.postMessage(msg);
    } catch {
      // ignore
    }
  }

  postToServerRelay(msg);

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
 * 2. EventSource local de Vite (/api/lyrics/events para OBS en localhost)
 * 3. EventSource remoto (si se especifica room)
 * 4. Eventos de localStorage
 */
export function subscribeLyricsSync(
  callback: (msg: LyricsSyncMessage) => void,
  room?: string,
): () => void {
  // 1. BroadcastChannel
  const handleMessage = (e: MessageEvent<LyricsSyncMessage>) => {
    if (e.data && e.data.type) {
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
        callback(parsed);
      } catch {
        // ignore
      }
    }
  };
  window.addEventListener('storage', handleStorage);

  // 3. Server-Sent Events (SSE)
  let sse: EventSource | null = null;

  // Si hay una sala remota especificada (por ejemplo en un enlace compartido)
  if (room) {
    try {
      sse = new EventSource(`https://ntfy.sh/${room}/sse`);
      sse.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          callback(parsed);
        } catch {
          // ignore
        }
      };
    } catch {
      sse = null;
    }
  } else if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    // Conexión local SSE para OBS Browser Source en localhost
    try {
      sse = new EventSource(LOCAL_API_EVENTS);
      sse.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          callback(parsed);
        } catch {
          // ignore
        }
      };
    } catch {
      sse = null;
    }
  }

  return () => {
    if (channel) {
      channel.removeEventListener('message', handleMessage);
    }
    window.removeEventListener('storage', handleStorage);
    if (sse) {
      sse.close();
    }
  };
}
