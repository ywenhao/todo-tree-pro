import { sep } from 'node:path'
import { workspace } from 'vscode'
import type { Uri, WorkspaceFolder } from 'vscode'

export function normalizePath(value: string): string {
  return value.replace(/\\/g, '/')
}

export function getWorkspaceFolder(uri: Uri): WorkspaceFolder | undefined {
  return workspace.getWorkspaceFolder(uri)
}

export function getRelativePath(uri: Uri): string {
  const folder = getWorkspaceFolder(uri)

  if (!folder) return normalizePath(uri.fsPath)

  return normalizePath(uri.fsPath.slice(folder.uri.fsPath.length).replace(new RegExp(`^\\${sep}`), ''))
}

export function uriKey(uri: Uri): string {
  return uri.toString()
}
