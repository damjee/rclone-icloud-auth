export interface DebugCapture {
  captureState(saveFn: () => Promise<void>): void;
}
