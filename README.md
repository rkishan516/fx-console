# Fx Console — VS Code Extension

VS Code extension for [fx](../../README.md) — the Dart/Flutter monorepo manager. Brings the [Nx Console](https://nx.dev/getting-started/editor-setup) experience to fx workspaces.

## Requirements

- VS Code 1.85+
- `fx` CLI installed and available on PATH (`dart pub global activate fx`)
- A workspace containing `fx.yaml` or a `pubspec.yaml` with an `fx:` section

## Features

### Workspace Explorer

Sidebar tree view showing all projects in the fx workspace. Supports three layout modes:

- **Automatic** — groups by folder when multiple source directories exist
- **Flat list** — all projects alphabetically
- **Tree** — always grouped by folder

Each project shows its type icon, available targets, and dependencies. The tree auto-refreshes when `pubspec.yaml` or `fx.yaml` files change.

### Run Targets

Run any target from the sidebar, command palette, context menu, or code lens buttons. Output appears in a dedicated VS Code terminal (one per project:target pair, reused across runs).

| Action | Description |
|--------|-------------|
| **Run** | `fx run <project> <target>` |
| **Run Verbose** | `fx run <project> <target> --verbose` |
| **Run (skip cache)** | `fx run <project> <target> --skip-cache` |
| **Run With Options** | Prompts for configuration, extra args, skip-cache, exclude-task-deps |
| **Run Many** | `fx run-many` across all or selected projects |
| **Run Affected** | `fx affected` on git-changed projects |

### Code Lens

Inline "Run | Run Verbose" buttons appear above target definitions in `pubspec.yaml` files. Controlled by the `fx-console.showCodeLens` setting.

```yaml
fx:
  targets:
    build:          # Run | Run Verbose
      executor: flutter build
```

### Dependency Graph

Interactive force-directed graph rendered with Cytoscape.js in a webview panel.

- Search and filter projects by name
- Click a node to highlight its dependency connections
- **Focus in Graph** — zoom to a specific project from the explorer
- **Show Affected** — highlight projects affected by current git changes
- Adapts to VS Code dark/light themes

### Code Generation

Form-based UI for `fx generate` with:

- Generator dropdown (filterable via allowlist/blocklist settings)
- Project name input with Dart identifier validation
- Output directory picker
- **Dry Run** preview before generating
- Works from the sidebar or file explorer context menu

### Project Details

Webview panel showing full project information:

- Type, path, tags
- All targets with executor and dependency info
- Direct dependencies and dependents

### Migration Step-Through

Webview panel for reviewing and applying migrations one at a time:

- Lists all available migrations from `fx migrate --list`
- **Preview** — dry-run showing proposed file changes
- **Apply** — executes one migration step with visual confirmation
- Tracks applied/pending state per migration

### Task History

Sidebar panel showing recent target runs with:

- Status indicator (success/failure)
- Duration
- Re-run button for quick retries

### Common Commands

Configurable quick-access panel for frequently used fx commands. Edit the list via the gear icon or the `fx-console.commonCommands` setting.

### Explorer Context Menu

Right-click a `pubspec.yaml` or project folder in the VS Code file explorer to:

- **Run Target** — pick and run a target for that project
- **Generate** — open the generator panel
- **Focus in Graph** — highlight the project in the dependency graph

## Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| `Fx: Run Target` | `Ctrl+Shift+R` / `Cmd+Shift+R` | Pick a project and target to run |
| `Fx: Show Graph` | `Ctrl+Shift+G` / `Cmd+Shift+G` | Open dependency graph |
| `Fx: Generate` | `Ctrl+Shift+N` / `Cmd+Shift+N` | Open generator form |
| `Fx: Run Many` | — | Run a target across all projects |
| `Fx: Run Affected` | — | Run on git-affected projects |
| `Fx: Show Affected Projects` | — | Highlight affected projects in graph |
| `Fx: Run (skip cache)` | — | Run target bypassing cache |
| `Fx: Run With Options...` | — | Run with advanced options prompt |
| `Fx: Copy Run Command` | — | Copy the `fx run` command to clipboard |
| `Fx: Refresh` | — | Reload the project tree |
| `Fx: Project Details` | — | Show full project info |
| `Fx: Focus in Graph` | — | Zoom to a project in the graph |
| `Fx: Reveal in Explorer` | — | Open project folder in file explorer |
| `Fx: Move Project` | — | Move a project to a new location |
| `Fx: Remove Project` | — | Delete a project directory |
| `Fx: Show Migrations` | — | Open migration step-through panel |
| `Fx: Clear History` | — | Clear the task history panel |
| `Fx: Re-run` | — | Re-run a task from history |
| `Fx: Edit Common Commands` | — | Open settings for the commands panel |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `fx-console.fxBinaryPath` | `fx` | Path to the fx CLI binary |
| `fx-console.defaultConcurrency` | `4` | Default parallel job count |
| `fx-console.autoRefresh` | `true` | Auto-refresh tree on file changes |
| `fx-console.showCodeLens` | `true` | Show inline Run buttons in pubspec.yaml |
| `fx-console.commonCommands` | `["run", "run-many", ...]` | Commands shown in the quick-access panel |
| `fx-console.generatorAllowlist` | `[]` | Glob patterns to include in generator dropdown |
| `fx-console.generatorBlocklist` | `[]` | Glob patterns to exclude from generator dropdown |
| `fx-console.projectViewingStyle` | `automatic` | Layout: `automatic`, `list`, or `tree` |

## Architecture

```
src/
  extension.ts              # Activation, command registration, file watchers
  fxCli.ts                  # TypeScript wrapper around the fx CLI binary
  types.ts                  # Shared interfaces (FxProject, FxGraphData, etc.)
  views/
    workspaceExplorer.ts    # TreeDataProvider — project/target/dependency tree
    graphPanel.ts           # Webview — Cytoscape.js dependency graph
    generatorPanel.ts       # Webview — generator form UI
    migrationPanel.ts       # Webview — migration step-through
    projectDetailsPanel.ts  # Webview — project info panel
    taskStatusPanel.ts      # TreeDataProvider — task history
    commonCommands.ts       # TreeDataProvider — quick-access commands
    webview/                # Static CSS/JS for webview panels
  runner/
    targetRunner.ts         # Terminal management, command execution
    taskHistory.ts          # Persistent task history (workspace state)
  providers/
    pubspecCodeLens.ts      # CodeLens for pubspec.yaml targets
  utils/
    workspaceRoot.ts        # Workspace root detection (fx.yaml walk-up)
    graphDataBuilder.ts     # Cytoscape.js data builder
    generatorFilter.ts      # Allowlist/blocklist filtering
    projectFromUri.ts       # Map file URI to project
    pubspecParser.ts        # Lightweight pubspec.yaml parser
    moveRemove.ts           # Path helpers for move/remove
    runOptionsBuilder.ts    # CLI flag builder from RunOptions
    nonce.ts                # CSP nonce generation
```

## Development

```bash
npm install
npm run compile   # Type-check + esbuild bundle
npm run watch     # Watch mode
npm test          # Run unit tests (mocha)
npm run package   # Produce .vsix for distribution
npm run lint      # ESLint
```

To test in VS Code, press `F5` to launch the Extension Development Host with the extension loaded.

## Known Limitations

- Generator-specific parameters beyond `name` and `directory` are not discoverable via the CLI. The form supports common parameters; run `fx generate <generator> --help` for all options.
- Multi-root workspaces with multiple fx workspaces are not supported (first workspace folder is used).

## License

MIT
