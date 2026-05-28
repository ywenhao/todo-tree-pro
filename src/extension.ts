import { Disposable, Position, Selection, Uri, ViewColumn, window, workspace } from 'vscode'
import { defineExtension, ref, useCommand, useDisposable, useVscodeContext } from 'reactive-vscode'
import type { TodoMatch, TodoViewMode } from './types'
import { TodoStore, isWorkspaceFile } from './store'
import { TodoTreeProvider, isTodoNode } from './treeProvider'
import { TodoHighlighter } from './highlighter'
import { debounce } from './debounce'

export = defineExtension(() => {
  const store = new TodoStore()
  const provider = new TodoTreeProvider(store)
  const highlighter = new TodoHighlighter()
  const viewMode = ref<TodoViewMode>('tree')

  useDisposable(store)
  useDisposable(provider)
  useDisposable(highlighter)
  useVscodeContext('reactiveTodoTree.viewMode', viewMode)

  const treeView = window.createTreeView('reactiveTodoTree.explorer', {
    treeDataProvider: provider,
    showCollapseAll: true,
  })
  useDisposable(treeView)

  const refreshNow = async () => {
    treeView.message = 'Scanning TODOs...'
    try {
      await store.refresh()
      treeView.message = store.count ? undefined : 'No TODOs found'
      treeView.badge = store.count ? { value: store.count, tooltip: `${store.count} TODOs` } : undefined
      highlighter.updateVisibleEditors()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      treeView.message = 'TODO scan failed'
      void window.showErrorMessage(`TODO scan failed: ${message}`)
    }
  }
  const refreshDebounced = debounce(() => void refreshNow(), 180)

  useCommand('reactiveTodoTree.refresh', refreshNow)
  useCommand('reactiveTodoTree.viewAsTree', () => setMode('tree'))
  useCommand('reactiveTodoTree.viewAsList', () => setMode('list'))
  useCommand('reactiveTodoTree.openTodo', async (value: TodoMatch | unknown) => {
    const todo = isTodoNode(value) ? value.todo : (value as TodoMatch | undefined)
    if (!todo) return

    await openTodo(todo)
  })

  registerWorkspaceListeners(store, highlighter, refreshDebounced)
  registerEditorListeners(store, highlighter)

  useDisposable(
    store.onDidChange(() => {
      treeView.badge = store.count ? { value: store.count, tooltip: `${store.count} TODOs` } : undefined
    }),
  )

  void refreshNow()

  function setMode(mode: TodoViewMode): void {
    viewMode.value = mode
    provider.setMode(mode)
  }
})

function registerWorkspaceListeners(
  store: TodoStore,
  highlighter: TodoHighlighter,
  refreshDebounced: ReturnType<typeof debounce>,
): void {
  const watcher = workspace.createFileSystemWatcher('**/*')

  const updateUri = async (uri: Uri) => {
    if (!isWorkspaceFile(uri)) return

    await store.updateUri(uri)
    highlighter.updateVisibleEditors()
  }

  useDisposable(new Disposable(() => refreshDebounced.cancel()))
  useDisposable(watcher)
  useDisposable(watcher.onDidCreate(updateUri))
  useDisposable(watcher.onDidChange(updateUri))
  useDisposable(
    watcher.onDidDelete((uri) => {
      store.removeUri(uri)
      highlighter.updateVisibleEditors()
    }),
  )
  useDisposable(workspace.onDidChangeWorkspaceFolders(() => refreshDebounced()))
  useDisposable(
    workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration('reactiveTodoTree')) return

      store.updateConfig()
      highlighter.updateVisibleEditors()
      refreshDebounced()
    }),
  )
}

function registerEditorListeners(store: TodoStore, highlighter: TodoHighlighter): void {
  const updateTextDocument = debounce((uri: Uri, text: string) => {
    store.updateOpenText(uri, text)
    highlighter.updateVisibleEditors()
  }, 120)

  useDisposable(new Disposable(() => updateTextDocument.cancel()))
  useDisposable(
    workspace.onDidChangeTextDocument((event) => {
      if (!isWorkspaceFile(event.document.uri)) return

      updateTextDocument(event.document.uri, event.document.getText())
    }),
  )
  useDisposable(
    workspace.onDidSaveTextDocument((document) => {
      if (!isWorkspaceFile(document.uri)) return

      void store.updateUri(document.uri).then(() => highlighter.updateVisibleEditors())
    }),
  )
  useDisposable(
    window.onDidChangeActiveTextEditor((editor) => {
      if (editor) highlighter.updateEditor(editor)
    }),
  )
  useDisposable(window.onDidChangeVisibleTextEditors(() => highlighter.updateVisibleEditors()))
}

async function openTodo(todo: TodoMatch): Promise<void> {
  const document = await workspace.openTextDocument(todo.uri)
  const editor = await window.showTextDocument(document, {
    viewColumn: ViewColumn.Active,
    preserveFocus: false,
  })
  const position = new Position(todo.line, todo.character)
  const end = new Position(todo.line, todo.endCharacter)

  editor.selection = new Selection(position, end)
  editor.revealRange(editor.selection)
}
