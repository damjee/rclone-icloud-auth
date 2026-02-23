import * as readline from "readline";

const readlineInterface = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

export function promptUser(question: string): Promise<string> {
  return new Promise((resolve) => {
    readlineInterface.question(question, (answer) => {
      readlineInterface.pause();
      resolve(answer);
    });
  });
}

export async function promptSelectRemote(remotes: string[], defaultRemote?: string): Promise<string> {
  console.log("\nAvailable iCloud remotes:");
  remotes.forEach((name, i) => {
    const marker = name === defaultRemote ? " (default)" : "";
    console.log(`  ${i + 1}) ${name}${marker}`);
  });

  const defaultIndex = defaultRemote ? remotes.indexOf(defaultRemote) + 1 : undefined;
  const hint = defaultIndex ? ` [${defaultIndex}]` : "";

  while (true) {
    readlineInterface.resume();
    const answer = await promptUser(`\nSelect remote${hint}: `);
    const trimmed = answer.trim();

    if (trimmed === "" && defaultIndex !== undefined) {
      return remotes[defaultIndex - 1];
    }

    const index = parseInt(trimmed, 10);
    if (!isNaN(index) && index >= 1 && index <= remotes.length) {
      return remotes[index - 1];
    }

    console.log(`  Please enter a number between 1 and ${remotes.length}.`);
  }
}

export function resumePrompt(): void {
  readlineInterface.resume();
}

export function closePrompt(): void {
  readlineInterface.close();
}
