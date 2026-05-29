import { spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'

const require = createRequire(import.meta.url)
const TARGETS = new Map([
  ['win32-x64', ['win32', 'x64', 'rg.exe']],
  ['win32-arm64', ['win32', 'arm64', 'rg.exe']],
  ['linux-x64', ['linux', 'x64', 'rg']],
  ['linux-arm64', ['linux', 'arm64', 'rg']],
  ['linux-armhf', ['linux', 'arm', 'rg']],
  ['darwin-x64', ['darwin', 'x64', 'rg']],
  ['darwin-arm64', ['darwin', 'arm64', 'rg']],
])

const target = process.argv[2] || currentTarget()
const targetInfo = TARGETS.get(target)

if (!targetInfo) {
  console.error(`Unsupported ripgrep target "${target}". Supported targets: ${[...TARGETS.keys()].join(', ')}`)
  process.exit(1)
}

const [platform, arch, binaryName] = targetInfo
const ripgrepRoot = path.resolve(path.dirname(require.resolve('@vscode/ripgrep')), '..')
const ripgrepVersion = JSON.parse(readFileSync(path.join(ripgrepRoot, 'package.json'), 'utf8')).version
const packageName = `@vscode/ripgrep-${platform}-${arch}`
const source = resolveInstalledBinary(packageName, binaryName) ?? downloadBinary(packageName, ripgrepVersion, binaryName)
const destinationRoot = path.join(process.cwd(), 'dist', 'bin')
const destination = path.join(destinationRoot, target, binaryName)

try {
  rmSync(destinationRoot, { recursive: true, force: true })
  mkdirSync(path.dirname(destination), { recursive: true })
  copyFileSync(source.path, destination)
  if (platform !== 'win32') chmodSync(destination, 0o755)
} finally {
  source.cleanup?.()
}

console.log(`copied ${target} ripgrep to ${path.relative(process.cwd(), destination).replace(/\\/g, '/')}`)

function currentTarget() {
  const arch = process.env.npm_config_arch || process.arch

  if (process.platform === 'linux' && arch === 'arm') return 'linux-armhf'

  return `${process.platform}-${arch}`
}

function resolveInstalledBinary(packageName, binaryName) {
  try {
    return { path: require.resolve(`${packageName}/bin/${binaryName}`, { paths: [ripgrepRoot] }) }
  } catch {
    return undefined
  }
}

function downloadBinary(packageName, version, binaryName) {
  const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'todo-tree-pro-ripgrep-'))
  const extractDirectory = path.join(temporaryDirectory, 'extract')

  mkdirSync(extractDirectory, { recursive: true })

  try {
    const packed = run('npm', [
      'pack',
      `${packageName}@${version}`,
      '--json',
      '--pack-destination',
      temporaryDirectory,
    ])
    const [{ filename }] = JSON.parse(packed)
    const tarball = path.isAbsolute(filename) ? filename : path.join(temporaryDirectory, filename)

    run(getTarCommand(), ['-xzf', tarball, '-C', extractDirectory, `package/bin/${binaryName}`])

    return {
      path: path.join(extractDirectory, 'package', 'bin', binaryName),
      cleanup: () => rmSync(temporaryDirectory, { recursive: true, force: true }),
    }
  } catch (error) {
    rmSync(temporaryDirectory, { recursive: true, force: true })
    throw error
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    windowsHide: true,
  })

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${command} ${args.join(' ')} failed`)
  }

  return result.stdout.trim()
}

function getTarCommand() {
  return process.platform === 'win32' ? 'tar.exe' : 'tar'
}
