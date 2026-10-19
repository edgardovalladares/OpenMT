declare module 'signalsmith-stretch' {
  export interface StretchSchedule {
    output?: number;          // tiempo del AudioContext en que aplica el cambio
    active?: boolean;         // procesar audio sí/no
    input?: number;           // posición (segundos) en el audio cargado
    rate?: number;            // velocidad: 1 = original (tempo, sin cambiar el tono)
    semitones?: number;       // transposición en semitonos (admite decimales)
    loopStart?: number;
    loopEnd?: number;
  }
  export interface StretchNode extends AudioNode {
    inputTime: number;
    schedule(params: StretchSchedule): void;
    start(when?: number, offset?: number, duration?: number, rate?: number, semitones?: number): void;
    stop(when?: number): void;
    addBuffers(channels: Float32Array[]): Promise<number>;
    dropBuffers(toSeconds?: number): Promise<void>;
    latency(): number;
  }
  export default function SignalsmithStretch(
    context: BaseAudioContext,
    options?: AudioWorkletNodeOptions,
  ): Promise<StretchNode>;
}
