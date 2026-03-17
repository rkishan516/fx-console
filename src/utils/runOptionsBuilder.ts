import { RunOptions } from '../types';

/**
 * Converts selected flag strings and optional configuration value into a RunOptions object.
 * Pure function — testable without VS Code.
 *
 * @param selectedFlags - Array of flag strings selected by the user (e.g. ['--skip-cache', '--verbose'])
 * @param configuration - Optional configuration name (e.g. 'production')
 */
export function applyRunOptionsFlags(
  selectedFlags: string[],
  configuration: string | undefined
): RunOptions {
  const opts: RunOptions = {};
  if (selectedFlags.includes('--skip-cache')) opts.skipCache = true;
  if (selectedFlags.includes('--verbose')) opts.verbose = true;
  if (selectedFlags.includes('--exclude-task-dependencies')) opts.excludeTaskDependencies = true;
  if (configuration) opts.configuration = configuration;
  return opts;
}

/** The available flag options shown in the run-with-options picker */
export const RUN_OPTION_FLAGS = [
  { label: '--skip-cache', description: 'Skip the nx/fx cache and re-run the task' },
  { label: '--verbose', description: 'Print additional logs' },
  { label: '--exclude-task-dependencies', description: 'Do not run dependent tasks first' },
];
