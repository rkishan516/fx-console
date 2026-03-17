import * as assert from 'assert';
import { FxCli } from '../fxCli';
import { FxProject, RunOptions } from '../types';

/** Creates a mock execFile function that returns the given stdout */
function mockExecFile(stdout: string, err?: Error) {
  return (
    _file: string,
    args: string[],
    _opts: unknown,
    cb: (error: Error | null, stdout: string, stderr: string) => void
  ) => {
    // Capture args for assertion
    (mockExecFile as { lastArgs?: string[] }).lastArgs = args;
    if (err) {
      cb(err, '', err.message);
    } else {
      cb(null, stdout, '');
    }
  };
}

suite('FxCli', () => {
  test('listProjects parses fx show projects --json output', async () => {
    const mockData: FxProject[] = [
      {
        name: 'my_app',
        type: 'flutter_app',
        path: '/ws/apps/my_app',
        tags: ['app'],
        dependencies: ['core'],
        dependents: [],
        targets: { build: { executor: 'flutter build' } },
      },
    ];

    let capturedArgs: string[] = [];
    const execFn = (
      _file: string,
      args: string[],
      _opts: unknown,
      cb: (e: Error | null, out: string, err: string) => void
    ) => {
      capturedArgs = args;
      cb(null, JSON.stringify(mockData), '');
    };

    const cli = new FxCli('fx', execFn as never);
    const projects = await cli.listProjects();

    assert.strictEqual(projects.length, 1);
    assert.strictEqual(projects[0].name, 'my_app');
    assert.deepStrictEqual(projects[0].tags, ['app']);
    assert.deepStrictEqual(projects[0].targets, { build: { executor: 'flutter build' } });
    assert.ok(capturedArgs.includes('show'));
    assert.ok(capturedArgs.includes('projects'));
    assert.ok(capturedArgs.includes('--json'));
  });

  test('listProjects propagates exec errors', async () => {
    const execFn = (
      _file: string,
      _args: string[],
      _opts: unknown,
      cb: (e: Error | null, out: string, err: string) => void
    ) => {
      cb(new Error('Not inside an fx workspace'), '', 'Not inside an fx workspace');
    };

    const cli = new FxCli('fx', execFn as never);
    await assert.rejects(() => cli.listProjects(), /Not inside an fx workspace/);
  });

  test('showProject calls fx show project <name> --json', async () => {
    const mockProject: FxProject = {
      name: 'core',
      type: 'dart_package',
      path: '/ws/packages/core',
      tags: [],
      dependencies: [],
      dependents: ['my_app'],
      targets: { test: { executor: 'dart test' } },
    };

    let capturedArgs: string[] = [];
    const execFn = (
      _file: string,
      args: string[],
      _opts: unknown,
      cb: (e: Error | null, out: string, err: string) => void
    ) => {
      capturedArgs = args;
      cb(null, JSON.stringify(mockProject), '');
    };

    const cli = new FxCli('fx', execFn as never);
    const project = await cli.showProject('core');

    assert.strictEqual(project.name, 'core');
    assert.deepStrictEqual(project.dependents, ['my_app']);
    assert.ok(capturedArgs.includes('show'));
    assert.ok(capturedArgs.includes('project'));
    assert.ok(capturedArgs.includes('core'));
    assert.ok(capturedArgs.includes('--json'));
  });

  test('getGraphData calls fx graph --format json and returns nodes/edges', async () => {
    const mockGraph = {
      nodes: ['app', 'core', 'utils'],
      edges: [
        { from: 'app', to: 'core' },
        { from: 'app', to: 'utils' },
      ],
    };

    let capturedArgs: string[] = [];
    const execFn = (
      _file: string,
      args: string[],
      _opts: unknown,
      cb: (e: Error | null, out: string, err: string) => void
    ) => {
      capturedArgs = args;
      cb(null, JSON.stringify(mockGraph), '');
    };

    const cli = new FxCli('fx', execFn as never);
    const graph = await cli.getGraphData();

    assert.deepStrictEqual(graph.nodes, ['app', 'core', 'utils']);
    assert.strictEqual(graph.edges.length, 2);
    assert.strictEqual(graph.edges[0].from, 'app');
    assert.strictEqual(graph.edges[0].to, 'core');
    assert.ok(capturedArgs.includes('graph'));
    assert.ok(capturedArgs.includes('--format'));
    assert.ok(capturedArgs.includes('json'));
  });

  test('getGenerators parses fx generate --list plain text output', async () => {
    const plainText = `Available generators:
  dart_package             Create a new Dart package
  flutter_package          Create a new Flutter package
  flutter_app              Create a new Flutter application
  dart_cli                 Create a new Dart CLI tool
`;

    let capturedArgs: string[] = [];
    const execFn = (
      _file: string,
      args: string[],
      _opts: unknown,
      cb: (e: Error | null, out: string, err: string) => void
    ) => {
      capturedArgs = args;
      cb(null, plainText, '');
    };

    const cli = new FxCli('fx', execFn as never);
    const generators = await cli.getGenerators();

    assert.strictEqual(generators.length, 4);
    assert.strictEqual(generators[0].name, 'dart_package');
    assert.strictEqual(generators[0].description, 'Create a new Dart package');
    assert.strictEqual(generators[1].name, 'flutter_package');
    assert.strictEqual(generators[3].name, 'dart_cli');
    assert.ok(capturedArgs.includes('generate'));
    assert.ok(capturedArgs.includes('--list'));
  });

  test('getGenerators handles empty list gracefully', async () => {
    const execFn = (
      _file: string,
      _args: string[],
      _opts: unknown,
      cb: (e: Error | null, out: string, err: string) => void
    ) => {
      cb(null, 'Available generators:\n', '');
    };

    const cli = new FxCli('fx', execFn as never);
    const generators = await cli.getGenerators();
    assert.strictEqual(generators.length, 0);
  });

  test('buildRunCommand returns positional args command', () => {
    const cli = new FxCli('fx');
    const cmd = cli.buildRunCommand('my_app', 'test');
    assert.strictEqual(cmd, 'fx run my_app test');
  });

  test('buildRunCommand with verbose flag (legacy boolean)', () => {
    const cli = new FxCli('fx');
    const cmd = cli.buildRunCommand('my_app', 'build', true);
    assert.strictEqual(cmd, 'fx run my_app build --verbose');
  });

  test('buildRunCommand with RunOptions verbose', () => {
    const cli = new FxCli('fx');
    const opts: RunOptions = { verbose: true };
    const cmd = cli.buildRunCommand('my_app', 'test', opts);
    assert.ok(cmd.includes('--verbose'), `expected --verbose in: ${cmd}`);
  });

  test('buildRunCommand with RunOptions skipCache appends --skip-cache', () => {
    const cli = new FxCli('fx');
    const opts: RunOptions = { skipCache: true };
    const cmd = cli.buildRunCommand('my_app', 'test', opts);
    assert.ok(cmd.includes('--skip-cache'), `expected --skip-cache in: ${cmd}`);
    assert.ok(cmd.startsWith('fx run my_app test'));
  });

  test('buildRunCommand with RunOptions configuration appends --configuration', () => {
    const cli = new FxCli('fx');
    const opts: RunOptions = { configuration: 'production' };
    const cmd = cli.buildRunCommand('my_app', 'build', opts);
    assert.ok(cmd.includes('--configuration production'), `expected --configuration production in: ${cmd}`);
  });

  test('buildRunCommand with RunOptions excludeTaskDependencies', () => {
    const cli = new FxCli('fx');
    const opts: RunOptions = { excludeTaskDependencies: true };
    const cmd = cli.buildRunCommand('my_app', 'test', opts);
    assert.ok(cmd.includes('--exclude-task-dependencies'), `expected flag in: ${cmd}`);
  });

  test('buildRunCommand with RunOptions extraArgs', () => {
    const cli = new FxCli('fx');
    const opts: RunOptions = { extraArgs: '--reporter json' };
    const cmd = cli.buildRunCommand('my_app', 'test', opts);
    assert.ok(cmd.includes('--reporter json'), `expected extra args in: ${cmd}`);
  });

  test('buildRunCommand with combined RunOptions', () => {
    const cli = new FxCli('fx');
    const opts: RunOptions = { verbose: true, skipCache: true, configuration: 'staging' };
    const cmd = cli.buildRunCommand('my_app', 'build', opts);
    assert.ok(cmd.includes('--verbose'));
    assert.ok(cmd.includes('--skip-cache'));
    assert.ok(cmd.includes('--configuration staging'));
  });

  test('isFxAvailable returns true when fx is on PATH', async () => {
    const execFn = (
      _file: string,
      _args: string[],
      _opts: unknown,
      cb: (e: Error | null, out: string, err: string) => void
    ) => {
      cb(null, 'fx version 1.0.0', '');
    };

    const cli = new FxCli('fx', execFn as never);
    const available = await cli.isFxAvailable();
    assert.strictEqual(available, true);
  });

  test('isFxAvailable returns false when fx is not found (ENOENT)', async () => {
    const execFn = (
      _file: string,
      _args: string[],
      _opts: unknown,
      cb: (e: Error | null, out: string, err: string) => void
    ) => {
      const err = new Error('spawn fx ENOENT') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      cb(err, '', '');
    };

    const cli = new FxCli('fx', execFn as never);
    const available = await cli.isFxAvailable();
    assert.strictEqual(available, false);
  });

  test('getAffectedProjects parses fx affected output (one project per line)', async () => {
    const execFn = (
      _file: string,
      args: string[],
      _opts: unknown,
      cb: (e: Error | null, out: string, err: string) => void
    ) => {
      void args;
      cb(null, '  app1\n  core\n  utils\n', '');
    };

    const cli = new FxCli('fx', execFn as never);
    const affected = await cli.getAffectedProjects();

    assert.deepStrictEqual(affected, ['app1', 'core', 'utils']);
  });

  test('getAffectedProjects calls fx affected command', async () => {
    let capturedArgs: string[] = [];
    const execFn = (
      _file: string,
      args: string[],
      _opts: unknown,
      cb: (e: Error | null, out: string, err: string) => void
    ) => {
      capturedArgs = args;
      cb(null, '  app1\n', '');
    };

    const cli = new FxCli('fx', execFn as never);
    await cli.getAffectedProjects();

    assert.ok(capturedArgs.includes('affected'), `expected 'affected' in args: ${capturedArgs.join(' ')}`);
  });

  test('getAffectedProjects returns empty array when no affected projects', async () => {
    const execFn = (
      _file: string,
      _args: string[],
      _opts: unknown,
      cb: (e: Error | null, out: string, err: string) => void
    ) => {
      cb(null, '\n', '');
    };

    const cli = new FxCli('fx', execFn as never);
    const affected = await cli.getAffectedProjects();
    assert.deepStrictEqual(affected, []);
  });

  test('stderr content is not treated as error on success', async () => {
    const mockData: FxProject[] = [{
      name: 'app', type: 'flutter_app', path: '/ws/apps/app',
      tags: [], dependencies: [], dependents: [], targets: {}
    }];

    const execFn = (
      _file: string,
      _args: string[],
      _opts: unknown,
      cb: (e: Error | null, out: string, err: string) => void
    ) => {
      // Stderr has content but exit code is 0 (null error)
      cb(null, JSON.stringify(mockData), 'Warning: implicit dependency detected');
    };

    const cli = new FxCli('fx', execFn as never);
    // Should not throw even though stderr has content
    const projects = await cli.listProjects();
    assert.strictEqual(projects.length, 1);
  });
});
