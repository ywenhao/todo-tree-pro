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
import type { FileTodos } from './types'

const SEARCH_PATTERN = '\\btodo\\b'
const require = createRequire(import.meta.url)
const RIPGREP_PATH = resolveRipgrepPath()

export async function scanWorkspace(config: ExtensionConfig): Promise<FileTodos[]> {
  const folders = workspace.workspaceFolders ?? []
  const scans = folders.map((folder) => scanFolder(folder, config))
  const results = await Promise.all(scans)

  return results.flat().filter((file) => file.todos.length > 0)
}

export async function scanDocumentUri(uri: Uri, config: ExtensionConfig): Promise<FileTodos | undefined> {
  if (uri.scheme !== 'file') return undefined

  const folder = workspace.getWorkspaceFolder(uri)
  if (!folder) return undefined

  if (isExcluded(uri, config)) return undefined

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

  if (isExcluded(uri, config)) return undefined

  return createFileTodos(uri, text, folder)
}

async function scanFolder(folder: WorkspaceFolder, config: ExtensionConfig): Promise<FileTodos[]> {
  const candidateFiles = await runRipgrep(folder, config, RIPGREP_PATH)
  const fileTodos = await Promise.all(
    candidateFiles.map(async (filePath) => scanDocumentUri(Uri.file(filePath), config)),
  )

  return fileTodos.filter((file): file is FileTodos => !!file)
}

function runRipgrep(folder: WorkspaceFolder, config: ExtensionConfig, ripgrepPath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const args = ['--files-with-matches', '--ignore-case', '--hidden', '--glob', '!**/.git/**']

    for (const glob of config.excludeGlobs) {
      if (!glob) continue

      args.push('--glob', `!${glob}`)
    }

    args.push('--regexp', SEARCH_PATTERN, folder.uri.fsPath)

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

function resolveRipgrepPath(): string {
  const bundleDirectory = path.dirname(fileURLToPath(import.meta.url))
  const arch = process.env.npm_config_arch || process.arch
  const target = process.platform === 'linux' && arch === 'arm' ? 'linux-armhf' : `${process.platform}-${arch}`
  const binaryName = process.platform === 'win32' ? 'rg.exe' : 'rg'
  const bundledBinaryPath = path.join(bundleDirectory, 'bin', target, binaryName)

  if (existsSync(bundledBinaryPath)) {
    ensureExecutable(bundledBinaryPath)
    return bundledBinaryPath
  }

  return require.resolve(`@vscode/ripgrep-${process.platform}-${arch}/bin/${binaryName}`)
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

function isExcluded(uri: Uri, config: ExtensionConfig): boolean {
  const relativePath = workspace.asRelativePath(uri, false).replace(/\\/g, '/')

  return config.excludeGlobs.some((glob) => globMatches(glob, relativePath))
}

function globMatches(glob: string, relativePath: string): boolean {
  const normalized = glob.replace(/\\/g, '/').replace(/^!/, '')
  let regex = '^'

  for (let index = 0; index < normalized.length; index++) {
    const character = normalized[index]
    const next = normalized[index + 1]

    if (character === '*' && next === '*') {
      if (normalized[index + 2] === '/') {
        regex += '(?:.*/)?'
        index += 2
      } else {
        regex += '.*'
        index += 1
      }
      continue
    }

    if (character === '*') {
      regex += '[^/]*'
      continue
    }

    if (character === '?') {
      regex += '[^/]'
      continue
    }

    regex += escapeRegex(character)
  }

  regex += '$'
  return new RegExp(regex).test(relativePath)
}

function escapeRegex(value: string): string {
  return /[\\^$+?.()|[\]{}]/.test(value) ? `\\${value}` : value
}
