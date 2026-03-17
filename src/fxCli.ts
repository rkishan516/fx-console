import * as cp from 'child_process';
import { FxProject, FxGraphData, FxGenerator, FxMigration, FxMigrationStep, RunOptions } from './types';

type ExecFileFn = (
  file: string,
  args: string[],
  options: { timeout: number; maxBuffer: number },
  callback: (error: Error | null, stdout: string, stderr: string) => void
) => void;

/** Wraps the fx CLI, handling JSON parsing and error handling. */
export class FxCli {
  private readonly _execFile: ExecFileFn;

  constructor(
    private readonly fxBinaryPath: string = 'fx',
    execFileFn?: ExecFileFn
  ) {
    this._execFile = execFileFn ?? (cp.execFile as unknown as ExecFileFn);
  }

  /**
   * Lists all workspace projects with full details (targets, tags, dependents).
   * Uses `fx show projects --json`.
   */
  async listProjects(): Promise<FxProject[]> {
    const output = await this._exec(['show', 'projects', '--json']);
    return JSON.parse(output) as FxProject[];
  }

  /**
   * Shows full details for a single project.
   * Uses `fx show project <name> --json`.
   */
  async showProject(name: string): Promise<FxProject> {
    const output = await this._exec(['show', 'project', name, '--json']);
    return JSON.parse(output) as FxProject;
  }

  /**
   * Returns the project dependency graph.
   * Uses `fx graph --format json`.
   * Note: nodes are plain strings, edges use {from, to}.
   */
  async getGraphData(): Promise<FxGraphData> {
    const output = await this._exec(['graph', '--format', 'json']);
    return JSON.parse(output) as FxGraphData;
  }

  /**
   * Lists available generators by parsing plain text output.
   * Uses `fx generate --list` (no --json flag exists).
   */
  async getGenerators(): Promise<FxGenerator[]> {
    const output = await this._exec(['generate', '--list']);
    return this._parseGeneratorList(output);
  }

  /**
   * Returns the command string to run a target in a terminal.
   * Uses positional arguments: fx run <project> <target>
   * Accepts a RunOptions object or a legacy boolean for verbose.
   */
  buildRunCommand(project: string, target: string, options?: RunOptions | boolean): string {
    const opts: RunOptions = typeof options === 'boolean' ? { verbose: options } : (options ?? {});
    const parts = [this.fxBinaryPath, 'run', project, target];
    if (opts.verbose) parts.push('--verbose');
    if (opts.skipCache) parts.push('--skip-cache');
    if (opts.configuration) parts.push('--configuration', opts.configuration);
    if (opts.excludeTaskDependencies) parts.push('--exclude-task-dependencies');
    if (opts.extraArgs) parts.push(opts.extraArgs);
    return parts.join(' ');
  }

  /**
   * Returns a list of project names affected by current changes.
   * Uses `fx affected` (no --target), which prints affected project names one per line.
   */
  async getAffectedProjects(): Promise<string[]> {
    const output = await this._exec(['affected']);
    return output
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }

  /**
   * Lists available migrations.
   * Uses `fx migrate --list --json`.
   */
  async listMigrations(): Promise<FxMigration[]> {
    const output = await this._exec(['migrate', '--list', '--json']);
    return JSON.parse(output) as FxMigration[];
  }

  /**
   * Dry-runs a plugin migration, returning the proposed changes.
   * Uses `fx migrate --plugin <name> --from <from> --to <to> --dry-run --json`.
   */
  async previewMigration(pluginName: string, fromVersion: string, toVersion: string): Promise<FxMigrationStep[]> {
    const output = await this._exec([
      'migrate', '--plugin', pluginName, '--from', fromVersion, '--to', toVersion, '--dry-run', '--json'
    ]);
    return JSON.parse(output) as FxMigrationStep[];
  }

  /**
   * Applies a single migration step.
   * Uses `fx migrate --plugin <name> --from <from> --to <to>`.
   */
  async applyMigration(pluginName: string, fromVersion: string, toVersion: string): Promise<string> {
    return this._exec([
      'migrate', '--plugin', pluginName, '--from', fromVersion, '--to', toVersion
    ]);
  }

  /**
   * Checks if the fx binary is available on PATH.
   */
  async isFxAvailable(): Promise<boolean> {
    try {
      await this._exec(['--version']);
      return true;
    } catch (err: unknown) {
      if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      // Any other error still means fx is present (e.g., unknown flag)
      return true;
    }
  }

  /** Parse plain text output of `fx generate --list` */
  private _parseGeneratorList(output: string): FxGenerator[] {
    const generators: FxGenerator[] = [];
    // Each generator line: "  <name padded to 24 chars> <description>"
    // Example: "  dart_package             Create a new Dart package"
    const lineRegex = /^\s{2}(\S+)\s+(.+)$/;

    for (const line of output.split('\n')) {
      const match = lineRegex.exec(line);
      if (match) {
        generators.push({
          name: match[1].trim(),
          description: match[2].trim(),
        });
      }
    }

    return generators;
  }

  /** Execute an fx command and return stdout. Stderr is ignored unless exit code is non-zero. */
  private _exec(args: string[], timeoutMs = 30_000): Promise<string> {
    return new Promise((resolve, reject) => {
      this._execFile(
        this.fxBinaryPath,
        args,
        { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 },
        (err, stdout, _stderr) => {
          if (err) {
            reject(err);
            return;
          }
          // stderr is not treated as an error — fx CLI writes warnings to stderr
          resolve(stdout);
        }
      );
    });
  }
}
