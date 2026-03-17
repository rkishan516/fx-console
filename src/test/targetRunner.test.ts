import * as assert from 'assert';
import { FxCli } from '../fxCli';
import { applyRunOptionsFlags } from '../utils/runOptionsBuilder';

// Tests for the command-building logic (pure, no vscode dependency)
suite('TargetRunner command building', () => {
  test('buildRunCommand produces correct positional arg format', () => {
    const cli = new FxCli('fx');
    assert.strictEqual(cli.buildRunCommand('my_app', 'test'), 'fx run my_app test');
  });

  test('buildRunCommand with --verbose flag', () => {
    const cli = new FxCli('fx');
    assert.strictEqual(cli.buildRunCommand('my_app', 'build', true), 'fx run my_app build --verbose');
  });

  test('buildRunCommand with custom binary path', () => {
    const cli = new FxCli('/usr/local/bin/fx');
    assert.strictEqual(
      cli.buildRunCommand('core', 'analyze'),
      '/usr/local/bin/fx run core analyze'
    );
  });

  test('buildRunCommand handles project names with underscores', () => {
    const cli = new FxCli('fx');
    assert.strictEqual(
      cli.buildRunCommand('my_flutter_app', 'test'),
      'fx run my_flutter_app test'
    );
  });
});

suite('applyRunOptionsFlags', () => {
  test('returns empty object when no flags selected', () => {
    const opts = applyRunOptionsFlags([], undefined);
    assert.deepStrictEqual(opts, {});
  });

  test('skipCache flag produces skipCache: true', () => {
    const opts = applyRunOptionsFlags(['--skip-cache'], undefined);
    assert.strictEqual(opts.skipCache, true);
  });

  test('verbose flag produces verbose: true', () => {
    const opts = applyRunOptionsFlags(['--verbose'], undefined);
    assert.strictEqual(opts.verbose, true);
  });

  test('excludeTaskDependencies flag', () => {
    const opts = applyRunOptionsFlags(['--exclude-task-dependencies'], undefined);
    assert.strictEqual(opts.excludeTaskDependencies, true);
  });

  test('configuration string is passed through', () => {
    const opts = applyRunOptionsFlags([], 'production');
    assert.strictEqual(opts.configuration, 'production');
  });

  test('multiple flags combined', () => {
    const opts = applyRunOptionsFlags(['--skip-cache', '--verbose'], 'staging');
    assert.strictEqual(opts.skipCache, true);
    assert.strictEqual(opts.verbose, true);
    assert.strictEqual(opts.configuration, 'staging');
  });

  test('empty configuration string is ignored', () => {
    const opts = applyRunOptionsFlags([], '');
    assert.strictEqual(opts.configuration, undefined);
  });
});
