import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { pack } = require('@vscode/vsce/out/package')

const target = process.argv[2]

if (!target) {
  console.error('Usage: node scripts/package-target.mjs <target>')
  process.exit(1)
}

run('npm', ['run', 'compile'])
run('node', ['scripts/copy-ripgrep.mjs', target])
await pack({
  target,
  dependencies: false,
  packagePath: `todo-tree-pro-${target}.vsix`,
})

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    windowsHide: true,
  })

  if (result.error) {
    console.error(result.error.message)
    process.exit(1)
  }

  if (result.status !== 0) process.exit(result.status ?? 1)
}
