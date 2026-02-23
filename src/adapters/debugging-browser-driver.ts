import { BrowserDriver } from "./browser-driver.js";

export class DebuggingBrowserDriver extends BrowserDriver {
  protected override afterNavigateToSignIn(): void {
    this.page.screenshot({ path: "/tmp/icloud-debug-01-after-signin-click.png" }).catch(() => {});
  }

  protected override afterEnterAppleId(): void {
    this.page.screenshot({ path: "/tmp/icloud-debug-03-after-appleid.png" }).catch(() => {});
  }

  protected override afterEnterPassword(): void {
    this.page.screenshot({ path: "/tmp/icloud-debug-05-after-password.png" }).catch(() => {});
  }

  protected override afterCheckTwoFactor(twoFactorRequired: boolean): void {
    const path = twoFactorRequired
      ? "/tmp/icloud-debug-07-2fa-screen.png"
      : "/tmp/icloud-debug-07-2fa-not-found.png";
    this.page.screenshot({ path }).catch(() => {});
  }

  protected override afterSubmitTwoFactorCode(): void {
    this.page.screenshot({ path: "/tmp/icloud-debug-08-after-2fa.png" }).catch(() => {});
  }
}
