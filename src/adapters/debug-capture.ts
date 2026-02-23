import type { DebugCapture } from "../core/debug-capture.js";

export class FileDebugCapture implements DebugCapture {
  captureState(saveFn: () => Promise<void>): void {
    saveFn().catch(() => {});
  }
}

export class NoopDebugCapture implements DebugCapture {
  captureState(_saveFn: () => Promise<void>): void {}
}
