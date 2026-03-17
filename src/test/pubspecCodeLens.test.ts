import * as assert from 'assert';
import { extractFxTargets, parsePubspec } from '../utils/pubspecParser';

// Code lens relies on pubspecParser — test the parsing logic here
// The CodeLensProvider itself requires vscode and is tested via the parser

suite('PubspecCodeLens (parser logic)', () => {
  test('detects targets under fx: section with correct line numbers', () => {
    const content = `name: my_app
version: 1.0.0
fx:
  targets:
    build:
      executor: flutter build
    test:
      executor: flutter test
`;
    const targets = extractFxTargets(content);

    assert.strictEqual(targets.length, 2);
    assert.ok(targets.some(t => t.name === 'build'));
    assert.ok(targets.some(t => t.name === 'test'));

    // build should come before test
    const buildLine = targets.find(t => t.name === 'build')!.line;
    const testLine = targets.find(t => t.name === 'test')!.line;
    assert.ok(buildLine < testLine);
  });

  test('extracts project name for code lens command arguments', () => {
    const content = `name: my_flutter_app
description: A Flutter app
`;
    const parsed = parsePubspec(content);
    assert.strictEqual(parsed.name, 'my_flutter_app');
  });

  test('no targets when fx: section missing', () => {
    const content = `name: pure_package
dependencies:
  path: ^1.8.0
`;
    const targets = extractFxTargets(content);
    assert.strictEqual(targets.length, 0);
  });

  test('no targets when fx: section has no targets key', () => {
    const content = `name: tagged_package
fx:
  tags:
    - scope:shared
`;
    const targets = extractFxTargets(content);
    assert.strictEqual(targets.length, 0);
  });

  test('handles target names with underscores and hyphens in pattern', () => {
    const content = `name: my_app
fx:
  targets:
    run_debug:
      executor: flutter run --debug
    build_release:
      executor: flutter build --release
`;
    const targets = extractFxTargets(content);
    assert.strictEqual(targets.length, 2);
    assert.ok(targets.some(t => t.name === 'run_debug'));
    assert.ok(targets.some(t => t.name === 'build_release'));
  });
});
