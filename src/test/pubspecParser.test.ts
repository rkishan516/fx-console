import * as assert from 'assert';
import { parsePubspec, extractFxTargets } from '../utils/pubspecParser';

suite('pubspecParser', () => {
  test('parsePubspec extracts name from pubspec.yaml content', () => {
    const content = `name: my_package
version: 1.0.0
description: A sample package
`;
    const result = parsePubspec(content);
    assert.strictEqual(result.name, 'my_package');
  });

  test('extractFxTargets returns empty array when no fx section', () => {
    const content = `name: my_package
dependencies:
  flutter:
    sdk: flutter
`;
    const targets = extractFxTargets(content);
    assert.deepStrictEqual(targets, []);
  });

  test('extractFxTargets extracts target names from fx: targets: section', () => {
    const content = `name: my_app
fx:
  targets:
    build:
      executor: flutter build
    test:
      executor: flutter test
    analyze:
      executor: dart analyze
`;
    const targets = extractFxTargets(content);
    assert.strictEqual(targets.length, 3);
    assert.ok(targets.some(t => t.name === 'build'));
    assert.ok(targets.some(t => t.name === 'test'));
    assert.ok(targets.some(t => t.name === 'analyze'));
  });

  test('extractFxTargets includes line number for each target', () => {
    const content = `name: my_app
fx:
  targets:
    build:
      executor: flutter build
`;
    const targets = extractFxTargets(content);
    assert.strictEqual(targets.length, 1);
    assert.ok(typeof targets[0].line === 'number');
    assert.ok(targets[0].line >= 0);
  });

  test('extractFxTargets handles pubspec with no targets key', () => {
    const content = `name: my_app
fx:
  tags:
    - app
`;
    const targets = extractFxTargets(content);
    assert.deepStrictEqual(targets, []);
  });
});
