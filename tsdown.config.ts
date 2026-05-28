import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    extension: 'src/extension.ts',
  },
  outDir: 'dist',
  format: 'esm',
  platform: 'node',
  target: 'node22',
  clean: true,
  sourcemap: false,
  dts: false,
  deps: {
    neverBundle: ['vscode', '@vscode/ripgrep'],
    alwaysBundle: ['reactive-vscode', '@reactive-vscode/reactivity'],
    onlyBundle: ['reactive-vscode', '@reactive-vscode/reactivity'],
  },
})
