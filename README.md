<p align="center">
  <img src="resources/icon.png" width="128" height="128" alt="TODO Tree Pro icon">
</p>

<h1 align="center">TODO Tree Pro</h1>

<p align="center">
  Fast TODO discovery for VS Code, with tree/list views, editor highlights, and ripgrep-powered workspace scans.
</p>

## Features

- Browse TODO comments from a dedicated Activity Bar view.
- Switch between compact list mode and grouped tree mode.
- Scan workspaces quickly with `@vscode/ripgrep`.
- Refresh automatically when files change or when open text buffers are edited.
- Highlight `TODO` and `TODO:` markers directly in the editor.
- Recognize common comment styles, including `// TODO`, `//TODO`, `/** TODO */`, `/**TODO */`, `/// TODO`, `# TODO`, `-- TODO`, `<!-- TODO -->`, and multi-line block comments.

## Commands

Open the Command Palette and search for `TODO Tree`:

| Command | Description |
| --- | --- |
| `TODO Tree: Refresh` | Rescan the workspace and update the TODO view. |
| `TODO Tree: Tree` | Show TODOs grouped by workspace structure. |
| `TODO Tree: List` | Show TODOs in a flat list. |
| `TODO Tree: Open TODO` | Open the selected TODO in the editor. |

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `reactiveTodoTree.excludeGlobs` | Common build and dependency folders | Glob patterns excluded from TODO scans. |
| `reactiveTodoTree.maxFileSize` | `5242880` | Maximum file size, in bytes, parsed after ripgrep finds a candidate file. |
| `reactiveTodoTree.highlight.enabled` | `true` | Highlight TODO markers in visible editors. |
| `reactiveTodoTree.scanOnTextChange` | `true` | Update the TODO view from unsaved text buffer changes. |

## Development

Install dependencies, then launch the extension host from VS Code:

```powershell
pnpm install
pnpm run compile
```

Press `F5` in VS Code to start an Extension Development Host.

Useful scripts:

```powershell
pnpm test
pnpm run check
pnpm run lint
pnpm run format:check
```

## Repository

Source code and issue tracking live at [github.com/ywenhao/todo-tree-pro](https://github.com/ywenhao/todo-tree-pro).
