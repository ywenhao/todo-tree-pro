# Reactive TODO Tree

A small TODO explorer for VS Code built with `reactive-vscode` and TypeScript.

Features:

- Activity Bar TODO view.
- Tree and list modes.
- Fast workspace scanning via `@vscode/ripgrep`.
- Incremental refresh on file changes and text edits.
- Editor highlights for `TODO` and `TODO:`, case-insensitive.
- Common line and block comments are recognized, including `// TODO`, `//TODO`, `/** TODO */`, `/**TODO */`, `/// TODO`, `# TODO`, `-- TODO`, and multi-line block comments.

Run with `pnpm install`, then press `F5` in VS Code.

Useful commands:

- `pnpm test`
- `pnpm lint`
- `pnpm lint:fix`
- `pnpm format:check`
- `pnpm format`
