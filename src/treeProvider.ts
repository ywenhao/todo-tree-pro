import { EventEmitter, ThemeIcon, TreeItem, TreeItemCollapsibleState, Uri } from 'vscode'
import type { Disposable, Event, ProviderResult, TreeDataProvider } from 'vscode'
import { getConfig } from './config'
import type { TodoStore } from './store'
import type { FileTodos, TodoMatch, TodoTreeNode, TodoViewMode } from './types'

export class TodoTreeProvider implements TreeDataProvider<TodoTreeNode> {
  private readonly changed = new EventEmitter<TodoTreeNode | undefined | null | void>()
  private readonly storeSubscription: Disposable
  private collapsedFolders = getCollapsedFolders()
  private mode: TodoViewMode = 'tree'

  readonly onDidChangeTreeData: Event<TodoTreeNode | undefined | null | void> = this.changed.event

  constructor(private readonly store: TodoStore) {
    this.storeSubscription = this.store.onDidChange(() => this.refresh())
  }

  setMode(mode: TodoViewMode): void {
    this.mode = mode
    this.refresh()
  }

  getMode(): TodoViewMode {
    return this.mode
  }

  refresh(): void {
    this.collapsedFolders = getCollapsedFolders()
    this.changed.fire()
  }

  getTreeItem(element: TodoTreeNode): TreeItem {
    if (element.type === 'todo') return createTodoItem(element)

    const item = new TreeItem(element.label, getCollapsibleState(element))
    item.id = element.id
    item.description = element.description
    item.resourceUri = element.uri
    item.iconPath = element.type === 'folder' ? new ThemeIcon('folder') : new ThemeIcon('file-code')
    item.contextValue = element.type
    item.tooltip = element.description ? `${element.label} - ${element.description}` : element.label

    return item
  }

  getChildren(element?: TodoTreeNode): ProviderResult<TodoTreeNode[]> {
    if (element) return element.children ?? []

    return this.mode === 'tree'
      ? buildTreeNodes(this.store.allFiles, this.collapsedFolders)
      : buildListNodes(this.store.allTodos)
  }

  dispose(): void {
    this.storeSubscription.dispose()
    this.changed.dispose()
  }
}

function getCollapsibleState(element: TodoTreeNode): TreeItemCollapsibleState {
  if (!element.children?.length) return TreeItemCollapsibleState.None

  return element.collapsedByDefault ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.Expanded
}

function createTodoItem(element: TodoTreeNode): TreeItem {
  const todo = element.todo!
  const item = new TreeItem(element.label, TreeItemCollapsibleState.None)
  item.id = element.id
  item.description = element.description
  item.resourceUri = todo.uri
  item.iconPath = new ThemeIcon(todo.severity === 'colon' ? 'checklist' : 'comment')
  item.contextValue = 'todo'
  item.tooltip = `${todo.relativePath}:${todo.line + 1}:${todo.character + 1}`
  item.command = {
    command: 'reactiveTodoTree.openTodo',
    title: 'Open TODO',
    arguments: [todo],
  }

  return item
}

function buildListNodes(todos: TodoMatch[]): TodoTreeNode[] {
  return todos
    .slice()
    .sort(compareTodos)
    .map((todo) => ({
      type: 'todo',
      id: todo.id,
      label: formatTodoLabel(todo),
      description: `${todo.relativePath}:${todo.line + 1}`,
      todo,
    }))
}

function buildTreeNodes(files: FileTodos[], collapsedFolders: Set<string>): TodoTreeNode[] {
  const workspaceRoots = new Map<string, TodoTreeNode>()

  for (const file of files) {
    const rootKey = file.workspaceFolder || file.workspaceName
    const root = getOrCreateNode(workspaceRoots, rootKey, {
      type: 'folder',
      id: `workspace:${rootKey}`,
      label: file.workspaceName,
      description: `${file.todos.length}`,
      children: [],
    })
    const parts = file.relativePath.split('/').filter(Boolean)
    let parent = root

    for (const part of parts.slice(0, -1)) {
      const id = `${parent.id}/${part}`
      let child = parent.children!.find((node) => node.id === id)

      if (!child) {
        child = {
          type: 'folder',
          id,
          label: part,
          children: [],
          collapsedByDefault: isCollapsedByDefaultFolder(part, collapsedFolders),
        }
        parent.children!.push(child)
      }

      parent = child
    }

    const fileNode: TodoTreeNode = {
      type: 'file',
      id: `file:${file.uri.toString()}`,
      label: parts.at(-1) ?? file.relativePath,
      description: `${file.todos.length}`,
      uri: file.uri,
      children: file.todos
        .slice()
        .sort(compareTodos)
        .map((todo) => ({
          type: 'todo',
          id: todo.id,
          label: formatTodoLabel(todo),
          description: `Ln ${todo.line + 1}`,
          todo,
        })),
    }
    parent.children!.push(fileNode)
  }

  const roots = Array.from(workspaceRoots.values())
  for (const root of roots) {
    sortNode(root)
    root.description = String(countTodos(root))
  }

  return roots
}

function isCollapsedByDefaultFolder(name: string, collapsedFolders: Set<string>): boolean {
  return collapsedFolders.has(name)
}

function getCollapsedFolders(): Set<string> {
  return new Set(
    getConfig()
      .collapsedFolders.map((folder) => folder.trim())
      .filter(Boolean),
  )
}

function getOrCreateNode(nodes: Map<string, TodoTreeNode>, key: string, create: TodoTreeNode): TodoTreeNode {
  const existing = nodes.get(key)
  if (existing) return existing

  nodes.set(key, create)
  return create
}

function sortNode(node: TodoTreeNode): void {
  node.children?.sort((a, b) => {
    if (a.type !== b.type) return rankType(a.type) - rankType(b.type)

    return a.label.localeCompare(b.label)
  })

  for (const child of node.children ?? []) sortNode(child)

  if (node.type === 'folder') node.description = String(countTodos(node))
}

function countTodos(node: TodoTreeNode): number {
  if (node.type === 'todo') return 1

  return node.children?.reduce((total, child) => total + countTodos(child), 0) ?? 0
}

function rankType(type: TodoTreeNode['type']): number {
  if (type === 'folder') return 0

  if (type === 'file') return 1

  return 2
}

function compareTodos(a: TodoMatch, b: TodoMatch): number {
  const fileCompare = a.relativePath.localeCompare(b.relativePath)
  if (fileCompare !== 0) return fileCompare

  if (a.line !== b.line) return a.line - b.line

  return a.character - b.character
}

function formatTodoLabel(todo: TodoMatch): string {
  const keyword = todo.severity === 'colon' ? 'TODO:' : 'TODO'
  const text = todo.text.replace(/^[:\s-]+/, '').trim()

  return text ? `${keyword} ${text}` : keyword
}

export function isTodoNode(value: unknown): value is TodoTreeNode {
  return !!value && typeof value === 'object' && (value as TodoTreeNode).type === 'todo'
}

export function uriFromNode(value: TodoTreeNode): Uri | undefined {
  if (value.type === 'todo') return value.todo?.uri

  return value.uri
}
