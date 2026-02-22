export function parseArgs(argv: string[]): { headless: boolean; debug: boolean } {
  return {
    headless: argv.includes("--headless"),
    debug: argv.includes("--debug"),
  };
}
