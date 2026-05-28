import { workspace } from 'vscode'

export interface ExtensionConfig {
  excludeGlobs: string[]
  maxFileSize: number
  highlightEnabled: boolean
  scanOnTextChange: boolean
}

export function getConfig(): ExtensionConfig {
  const config = workspace.getConfiguration('reactiveTodoTree')

  return {
    excludeGlobs: config.get<string[]>('excludeGlobs', []),
    maxFileSize: config.get<number>('maxFileSize', 5 * 1024 * 1024),
    highlightEnabled: config.get<boolean>('highlight.enabled', true),
    scanOnTextChange: config.get<boolean>('scanOnTextChange', true),
  }
}
