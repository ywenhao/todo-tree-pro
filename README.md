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
- Recognize common comment styles for JavaScript/TypeScript, Python, Go, Rust,
  Java, C/C++, C#, HTML, Markdown, CSS, SQL, Shell, PowerShell, Ruby, Lua,
  Haskell, Elixir, Svelte, Blade, Razor, Vimscript, Batch, LaTeX, Lisp, and
  INI-style files.

## Commands

Open the Command Palette and search for `TODO Tree`:

| Command                | Description                                    |
| ---------------------- | ---------------------------------------------- |
| `TODO Tree: Refresh`   | Rescan the workspace and update the TODO view. |
| `TODO Tree: Tree`      | Show TODOs grouped by workspace structure.     |
| `TODO Tree: List`      | Show TODOs in a flat list.                     |
| `TODO Tree: Open TODO` | Open the selected TODO in the editor.          |

## Settings

| Setting                              | Default                             | Description                                                               |
| ------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------- |
| `reactiveTodoTree.excludeFolders`    | Common build and dependency folders | Folder names excluded wherever they appear in the workspace.              |
| `reactiveTodoTree.collapsedFolders`  | `.agents`, `skills`                 | Folder names collapsed by default in the tree view.                       |
| `reactiveTodoTree.useGitignore`      | `true`                              | Respect workspace `.gitignore` patterns when scanning TODOs.              |
| `reactiveTodoTree.maxFileSize`       | `5242880`                           | Maximum file size, in bytes, parsed after ripgrep finds a candidate file. |
| `reactiveTodoTree.highlight.enabled` | `true`                              | Highlight TODO markers in visible editors.                                |
| `reactiveTodoTree.scanOnTextChange`  | `true`                              | Update the TODO view from unsaved text buffer changes.                    |

## Development

Install dependencies, then launch the extension host from VS Code:

```powershell
npm install
npm run compile
```

Press `F5` in VS Code to start an Extension Development Host.

```powershell
npm test
npm run check
npm run lint
npm run format:check
```

Package and publish:

```powershell
npm run package
npm run package:darwin-x64
npm run package:all
npm run publish:all
```

GitHub Actions publishes automatically when a `v*` tag is pushed. Add a
`VSCE_PAT` repository secret before releasing. The workflow packages each target
separately so the native `@vscode/ripgrep` binary matches the VSIX platform.
For platform builds, use `npm run package:<target>` instead of calling
`npx @vscode/vsce package --target <target>` directly; the npm script copies the
matching native `ripgrep` binary before packaging.

## Repository

Source code and issue tracking live at [github.com/ywenhao/todo-tree-pro](https://github.com/ywenhao/todo-tree-pro).
