import type { ExtensionConfig } from './config'

export interface GitignoreRule {
  globs: string[]
  negated: boolean
}

export function isExcludedRelativePath(
  relativePath: string,
  config: ExtensionConfig,
  gitignoreRules: GitignoreRule[],
): boolean {
  const pathParts = relativePath.split('/').filter(Boolean)
  const excludedFolders = new Set(config.excludeFolders.map((folder) => folder.trim()).filter(Boolean))

  if (pathParts.some((part) => excludedFolders.has(part))) return true

  return matchesGitignoreRules(gitignoreRules, relativePath)
}

export function getExcludeGlobs(config: ExtensionConfig): string[] {
  const folderGlobs = config.excludeFolders
    .map((folderName) => folderName.trim())
    .filter(Boolean)
    .map((folderName) => `**/${folderName}/**`)

  return folderGlobs
}

export function parseGitignoreRules(text: string): GitignoreRule[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() && !line.trimStart().startsWith('#'))
    .map((line) => {
      const pattern = line.trimStart()
      const negated = pattern.startsWith('!')
      const normalizedPattern = negated ? pattern.slice(1) : pattern

      return {
        globs: gitignorePatternToGlobs(normalizedPattern),
        negated,
      }
    })
    .filter((rule) => rule.globs.length > 0)
}

function gitignorePatternToGlobs(pattern: string): string[] {
  const anchored = pattern.startsWith('/')
  const normalized = pattern.replace(/\\/g, '/').replace(/^\//, '')
  if (!normalized) return []

  if (normalized.endsWith('/')) {
    const directory = normalized.replace(/\/+$/, '')

    return [anchored ? `${directory}/**` : `**/${directory}/**`]
  }

  if (normalized.includes('/')) return [normalized, `${normalized}/**`]
  if (anchored) return [normalized, `${normalized}/**`]

  return [`**/${normalized}`, `**/${normalized}/**`]
}

function matchesGitignoreRules(rules: GitignoreRule[], relativePath: string): boolean {
  let ignored = false

  for (const rule of rules) {
    if (!rule.globs.some((glob) => globMatches(glob, relativePath))) continue

    ignored = !rule.negated
  }

  return ignored
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
