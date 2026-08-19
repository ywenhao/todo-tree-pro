import { workspace } from 'vscode'

export interface ExtensionConfig {
  excludeFolders: string[]
  collapsedFolders: string[]
  caseSensitive: boolean
  useGitignore: boolean
  maxFileSize: number
  highlightEnabled: boolean
  scanOnTextChange: boolean
}

export function getConfig(): ExtensionConfig {
  const config = workspace.getConfiguration('todoTreePro')

  return {
    excludeFolders: config.get<string[]>('excludeFolders', [
      '.git',
      '.output',
      '.out',
      'node_modules',
      'dist',
      'build',
      '.next',
      'coverage',
    ]),
    collapsedFolders: config.get<string[]>('collapsedFolders', ['.agents', 'skills']),
    caseSensitive: config.get<boolean>('caseSensitive', false),
    useGitignore: config.get<boolean>('useGitignore', true),
    maxFileSize: config.get<number>('maxFileSize', 5 * 1024 * 1024),
    highlightEnabled: config.get<boolean>('highlight.enabled', true),
    scanOnTextChange: config.get<boolean>('scanOnTextChange', true),
  }
}
