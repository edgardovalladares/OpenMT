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
    };
  }
}
