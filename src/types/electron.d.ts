export interface ElectronLanInfo {
  localUrl: string;
  ips: string[];
  port: number;
}

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      getLanInfo: () => Promise<ElectronLanInfo>;
      sendLyricsSync: (msg: unknown) => void;
      onLyricsSync: (cb: (msg: unknown) => void) => () => void;
    };
  }
}
