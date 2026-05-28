const { spawnSync } = require('node:child_process')
const path = require('node:path')

const arch = process.env.npm_config_arch || process.arch
const binaryName = process.platform === 'win32' ? 'rg.exe' : 'rg'
const ripgrepRoot = path.resolve(path.dirname(require.resolve('@vscode/ripgrep')), '..')
const rgPath = require.resolve(`@vscode/ripgrep-${process.platform}-${arch}/bin/${binaryName}`, {
  paths: [ripgrepRoot],
})
const result = spawnSync(
  rgPath,
  ['--files-with-matches', '--ignore-case', '--regexp', '\\btodo\\b', 'fixtures/todos'],
  {
    encoding: 'utf8',
    windowsHide: true,
  },
)

if (result.status !== 0) {
  console.error(result.stderr || result.stdout)
  process.exit(result.status ?? 1)
}

const stdout = result.stdout.replace(/\\/g, '/')

if (!stdout.includes('fixtures/todos/sample.ts')) {
  console.error(`Expected ripgrep to find fixtures/todos/sample.ts, got:\n${result.stdout}`)
  process.exit(1)
}

console.log('ripgrep fixture check passed')
