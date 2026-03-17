export const DEFAULT_COMMON_COMMANDS = ['run', 'run-many', 'affected', 'generate', 'graph', 'lint'];

export type CommandAction =
  | { type: 'vscode'; command: string }
  | { type: 'terminal'; command: string };

const COMMAND_MAP: Record<string, string> = {
  'run': 'fx-console.runTarget',
  'run-many': 'fx-console.runMany',
  'affected': 'fx-console.runAffected',
  'generate': 'fx-console.generate',
  'graph': 'fx-console.showGraph',
};

/**
 * Resolves a command name to its action (VS Code command or terminal command).
 * Pure function — testable without VS Code.
 */
export function resolveCommandAction(name: string): CommandAction {
  if (COMMAND_MAP[name]) {
    return { type: 'vscode', command: COMMAND_MAP[name] };
  }
  return { type: 'terminal', command: `fx ${name}` };
}
