import type { Uri } from 'vscode'

export type TodoSeverity = 'colon' | 'plain'

export interface TodoMatch {
  id: string
  uri: Uri
  workspaceFolder: string
  workspaceName: string
  relativePath: string
  line: number
  character: number
  endCharacter: number
  text: string
  keyword: string
  severity: TodoSeverity
}

export interface FileTodos {
  uri: Uri
  workspaceFolder: string
  workspaceName: string
  relativePath: string
  todos: TodoMatch[]
}

export type TodoViewMode = 'tree' | 'list'

export interface TodoTreeNode {
  type: 'folder' | 'file' | 'todo'
  id: string
  label: string
  description?: string
  uri?: Uri
  todo?: TodoMatch
  children?: TodoTreeNode[]
}
