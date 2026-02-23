export function parseArgs(argv: string[]): { debug: boolean } {
  return {
    debug: argv.includes("--debug"),
  };
}
