import { describe, expect, it } from 'vitest'
import { isExcludedRelativePath, parseGitignoreRules } from '../excludes.js'
import type { ExtensionConfig } from '../config.js'

const baseConfig: ExtensionConfig = {
  excludeFolders: [],
  collapsedFolders: [],
  useGitignore: true,
  maxFileSize: 5 * 1024 * 1024,
  highlightEnabled: true,
  scanOnTextChange: true,
}

describe('scanner excludes', () => {
  it('excludes configured folder names wherever they appear', () => {
    const config = {
      ...baseConfig,
      excludeFolders: ['node_modules', 'dist'],
    }

    expect(isExcludedRelativePath('src/todo.ts', config, [])).toBe(false)
    expect(isExcludedRelativePath('packages/app/node_modules/lib/index.js', config, [])).toBe(true)
    expect(isExcludedRelativePath('packages/app/dist/index.js', config, [])).toBe(true)
  })

  it('uses parsed .gitignore rules for single-file updates', () => {
    const rules = parseGitignoreRules(['# comment', 'coverage/', '*.log', '/root-only.txt', '!keep.log'].join('\n'))

    expect(isExcludedRelativePath('coverage/report.txt', baseConfig, rules)).toBe(true)
    expect(isExcludedRelativePath('nested/debug.log', baseConfig, rules)).toBe(true)
    expect(isExcludedRelativePath('root-only.txt', baseConfig, rules)).toBe(true)
    expect(isExcludedRelativePath('nested/root-only.txt', baseConfig, rules)).toBe(false)
    expect(isExcludedRelativePath('keep.log', baseConfig, rules)).toBe(false)
  })
})
