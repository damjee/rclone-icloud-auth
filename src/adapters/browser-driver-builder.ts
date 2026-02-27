import { BrowserDriver } from "./browser-driver.js";
import { DebuggingBrowserDriver } from "./debugging-browser-driver.js";
import { BrowserAuthAdapter } from "./launcher.js";
import type { AuthFlowDriver } from "../core/auth-flow.js";

export class BrowserDriverBuilder {
  private debug = false;

  withDebug(): this {
    this.debug = true;
    return this;
  }

  build(): AuthFlowDriver {
    return this.debug ? new DebuggingBrowserDriver() : new BrowserDriver();
  }
}

export function buildAuthAdapter(debug: boolean): BrowserAuthAdapter {
  const builder = new BrowserDriverBuilder();
  if (debug) builder.withDebug();
  return new BrowserAuthAdapter(builder.build());
}
