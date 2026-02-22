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

export function resumePrompt(): void {
  readlineInterface.resume();
}

export function closePrompt(): void {
  readlineInterface.close();
}
