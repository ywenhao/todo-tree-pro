import { copyFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const arch = process.env.npm_config_arch || process.arch
const binaryName = process.platform === 'win32' ? 'rg.exe' : 'rg'
const ripgrepRoot = path.resolve(path.dirname(require.resolve('@vscode/ripgrep')), '..')
const source = require.resolve(`@vscode/ripgrep-${process.platform}-${arch}/bin/${binaryName}`, {
  paths: [ripgrepRoot],
})
const destination = path.join(__dirname, '..', 'dist', 'bin', binaryName)

mkdirSync(path.dirname(destination), { recursive: true })
copyFileSync(source, destination)

console.log(`copied ${path.relative(process.cwd(), destination).replace(/\\/g, '/')}`)
