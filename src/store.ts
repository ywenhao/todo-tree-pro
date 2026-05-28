import { EventEmitter, workspace } from 'vscode'
import type { Event, Uri } from 'vscode'
import type { ExtensionConfig } from './config'
import { getConfig } from './config'
import { scanDocumentUri, scanOpenDocumentText, scanWorkspace } from './scanner'
import type { FileTodos, TodoMatch } from './types'
import { uriKey } from './paths'

export class TodoStore {
  private readonly files = new Map<string, FileTodos>()
  private readonly changed = new EventEmitter<void>()
  private scanToken = 0
  private config: ExtensionConfig = getConfig()

  readonly onDidChange: Event<void> = this.changed.event

  get allFiles(): FileTodos[] {
    return Array.from(this.files.values())
      .filter((file) => file.todos.length > 0)
      .sort((a, b) => a.relativePath.localeCompare(b.relativePath))
  }

  get allTodos(): TodoMatch[] {
    return this.allFiles.flatMap((file) => file.todos)
  }

  get count(): number {
    return this.allTodos.length
  }

  updateConfig(): void {
    this.config = getConfig()
  }

  async refresh(): Promise<void> {
    const token = ++this.scanToken
    this.files.clear()
    this.changed.fire()

    const files = await scanWorkspace(this.config)
    if (token !== this.scanToken) return

    for (const file of files) this.files.set(uriKey(file.uri), file)

    this.changed.fire()
  }

  async updateUri(uri: Uri): Promise<void> {
    const key = uriKey(uri)
    const file = await scanDocumentUri(uri, this.config)

    if (!file || file.todos.length === 0) this.files.delete(key)
    else this.files.set(key, file)

    this.changed.fire()
  }

  updateOpenText(uri: Uri, text: string): void {
    if (!this.config.scanOnTextChange) return

    const key = uriKey(uri)
    const file = scanOpenDocumentText(uri, text, this.config)

    if (!file || file.todos.length === 0) this.files.delete(key)
    else this.files.set(key, file)

    this.changed.fire()
  }

  removeUri(uri: Uri): void {
    this.files.delete(uriKey(uri))
    this.changed.fire()
  }

  findTodosForUri(uri: Uri): TodoMatch[] {
    return this.files.get(uriKey(uri))?.todos ?? []
  }

  dispose(): void {
    this.changed.dispose()
  }
}

export function isWorkspaceFile(uri: Uri): boolean {
  return uri.scheme === 'file' && !!workspace.getWorkspaceFolder(uri)
}
