import { spawn } from 'node:child_process'
import { chmodSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Uri, workspace } from 'vscode'
import type { WorkspaceFolder } from 'vscode'
import { parseTodosFromText } from './commentParser'
import type { ExtensionConfig } from './config'
import { getExcludeGlobs, isExcludedRelativePath, parseGitignoreRules } from './excludes'
import type { GitignoreRule } from './excludes'
import type { FileTodos } from './types'

const SEARCH_PATTERN = '\\btodo\\b'
const require = createRequire(import.meta.url)
let ripgrepPath: string | undefined
const gitignoreRulesByFolder = new Map<string, GitignoreRule[]>()

export async function scanWorkspace(config: ExtensionConfig): Promise<FileTodos[]> {
  const folders = workspace.workspaceFolders ?? []
  gitignoreRulesByFolder.clear()
  const scans = folders.map((folder) => scanFolder(folder, config))
  const results = await Promise.all(scans)

  return results.flat().filter((file) => file.todos.length > 0)
}

export async function scanDocumentUri(uri: Uri, config: ExtensionConfig): Promise<FileTodos | undefined> {
  if (uri.scheme !== 'file') return undefined

  const folder = workspace.getWorkspaceFolder(uri)
  if (!folder) return undefined

  if (await isExcluded(uri, config, folder)) return undefined

  try {
    const metadata = await stat(uri.fsPath)
    if (!metadata.isFile() || metadata.size > config.maxFileSize) return undefined
  } catch {
    return undefined
  }

  const bytes = await workspace.fs.readFile(uri)
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)

  return createFileTodos(uri, text, folder)
}

export function scanOpenDocumentText(uri: Uri, text: string, config: ExtensionConfig): FileTodos | undefined {
  if (uri.scheme !== 'file') return undefined

  const folder = workspace.getWorkspaceFolder(uri)
  if (!folder) return undefined

  if (isExcludedSync(uri, config, folder)) return undefined

  return createFileTodos(uri, text, folder)
}

async function scanFolder(folder: WorkspaceFolder, config: ExtensionConfig): Promise<FileTodos[]> {
  const candidateFiles = await runRipgrep(folder, config, getRipgrepPath())
  const fileTodos = await Promise.all(
    candidateFiles.map(async (filePath) => scanDocumentUri(Uri.file(filePath), config)),
  )

  return fileTodos.filter((file): file is FileTodos => !!file)
}

async function runRipgrep(folder: WorkspaceFolder, config: ExtensionConfig, ripgrepPath: string): Promise<string[]> {
  const args = ['--files-with-matches', '--ignore-case', '--hidden', '--glob', '!**/.git/**']

  if (!config.useGitignore) args.push('--no-ignore')

  const folderExcludeGlobs = getExcludeGlobs(config)

  for (const glob of folderExcludeGlobs) {
    if (!glob) continue

    args.push('--glob', `!${glob}`)
  }

  args.push('--regexp', SEARCH_PATTERN, folder.uri.fsPath)

  return new Promise((resolve, reject) => {
    const process = spawn(ripgrepPath, args, {
      cwd: folder.uri.fsPath,
      windowsHide: true,
    })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []

    process.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)))
    process.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)))
    process.on('error', reject)
    process.on('close', (code) => {
      if (code === 0 || code === 1) {
        const output = Buffer.concat(stdout).toString('utf8')
        const files = output
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
        resolve(files)
        return
      }

      reject(new Error(Buffer.concat(stderr).toString('utf8') || `ripgrep exited with code ${code}`))
    })
  })
}

function getRipgrepPath(): string {
  ripgrepPath ??= resolveRipgrepPath()

  return ripgrepPath
}

function resolveRipgrepPath(): string {
  const bundleDirectory = path.dirname(fileURLToPath(import.meta.url))
  const arch = process.env.npm_config_arch || process.arch
  const target = process.platform === 'linux' && arch === 'arm' ? 'linux-armhf' : `${process.platform}-${arch}`
  const binaryName = process.platform === 'win32' ? 'rg.exe' : 'rg'
  const bundledBinaryPath = path.join(bundleDirectory, 'bin', target, binaryName)
  const packageName = `@vscode/ripgrep-${process.platform}-${arch}`
  const packageBinarySpec = `${packageName}/bin/${binaryName}`

  if (existsSync(bundledBinaryPath)) {
    ensureExecutable(bundledBinaryPath)
    return bundledBinaryPath
  }

  const installedBinaryPath = resolveInstalledRipgrepBinary(packageBinarySpec)
  if (installedBinaryPath) {
    ensureExecutable(installedBinaryPath)
    return installedBinaryPath
  }

  throw new Error(
    [
      `Missing ripgrep binary for ${target}.`,
      `Tried ${path.relative(process.cwd(), bundledBinaryPath).replace(/\\/g, '/')} and ${packageBinarySpec}.`,
      'Run npm install before F5 debugging, or run the matching npm run package:<target> script before packaging.',
    ].join(' '),
  )
}

function resolveInstalledRipgrepBinary(packageBinarySpec: string): string | undefined {
  const directPath = resolveOptional(packageBinarySpec)
  if (directPath) return directPath

  const ripgrepEntry = resolveOptional('@vscode/ripgrep')
  if (!ripgrepEntry) return undefined

  const ripgrepRoot = path.resolve(path.dirname(ripgrepEntry), '..')

  return resolveOptional(packageBinarySpec, [ripgrepRoot])
}

function resolveOptional(specifier: string, paths?: string[]): string | undefined {
  try {
    return paths ? require.resolve(specifier, { paths }) : require.resolve(specifier)
  } catch {
    return undefined
  }
}

function ensureExecutable(binaryPath: string): void {
  if (process.platform === 'win32') return

  try {
    chmodSync(binaryPath, 0o755)
  } catch {
    // Spawning the binary will report the real error if chmod is unavailable.
  }
}

function createFileTodos(uri: Uri, text: string, folder: WorkspaceFolder): FileTodos {
  const todos = parseTodosFromText(text, uri, folder)

  return {
    uri,
    workspaceFolder: folder.uri.fsPath,
    workspaceName: folder.name,
    relativePath: workspace.asRelativePath(uri, false).replace(/\\/g, '/'),
    todos,
  }
}

async function isExcluded(uri: Uri, config: ExtensionConfig, folder: WorkspaceFolder): Promise<boolean> {
  const relativePath = workspace.asRelativePath(uri, false).replace(/\\/g, '/')
  const gitignoreRules = config.useGitignore ? await getGitignoreRules(folder) : []

  return isExcludedRelativePath(relativePath, config, gitignoreRules)
}

function isExcludedSync(uri: Uri, config: ExtensionConfig, folder: WorkspaceFolder): boolean {
  const relativePath = workspace.asRelativePath(uri, false).replace(/\\/g, '/')
  const gitignoreRules = config.useGitignore ? (gitignoreRulesByFolder.get(folder.uri.toString()) ?? []) : []

  return isExcludedRelativePath(relativePath, config, gitignoreRules)
}

async function getGitignoreRules(folder: WorkspaceFolder): Promise<GitignoreRule[]> {
  const cacheKey = folder.uri.toString()
  const cached = gitignoreRulesByFolder.get(cacheKey)
  if (cached) return cached

  const rules = await readGitignoreRules(folder)
  gitignoreRulesByFolder.set(cacheKey, rules)

  return rules
}

async function readGitignoreRules(folder: WorkspaceFolder): Promise<GitignoreRule[]> {
  const gitignoreUri = Uri.joinPath(folder.uri, '.gitignore')

  try {
    const bytes = await workspace.fs.readFile(gitignoreUri)
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)

    return parseGitignoreRules(text)
  } catch {
    return []
  }
}
