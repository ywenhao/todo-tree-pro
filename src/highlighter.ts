import { Range, window, workspace } from 'vscode'
import type { TextEditor, TextEditorDecorationType } from 'vscode'
import { getConfig } from './config'
import { parseTodosFromText } from './commentParser'

export class TodoHighlighter {
  private readonly colonDecoration: TextEditorDecorationType
  private readonly plainDecoration: TextEditorDecorationType

  constructor() {
    this.colonDecoration = window.createTextEditorDecorationType({
      backgroundColor: 'rgba(255, 185, 0, 0.28)',
      border: '1px solid rgba(255, 185, 0, 0.65)',
      borderRadius: '3px',
      fontWeight: '700',
      overviewRulerColor: 'rgba(255, 185, 0, 0.95)',
      overviewRulerLane: 4,
    })
    this.plainDecoration = window.createTextEditorDecorationType({
      backgroundColor: 'rgba(75, 156, 211, 0.22)',
      border: '1px solid rgba(75, 156, 211, 0.5)',
      borderRadius: '3px',
      fontWeight: '700',
      overviewRulerColor: 'rgba(75, 156, 211, 0.9)',
      overviewRulerLane: 4,
    })
  }

  updateVisibleEditors(): void {
    for (const editor of window.visibleTextEditors) this.updateEditor(editor)
  }

  updateEditor(editor: TextEditor): void {
    const config = getConfig()
    if (
      !config.highlightEnabled ||
      editor.document.uri.scheme !== 'file' ||
      !workspace.getWorkspaceFolder(editor.document.uri)
    ) {
      editor.setDecorations(this.colonDecoration, [])
      editor.setDecorations(this.plainDecoration, [])
      return
    }

    const todos = parseTodosFromText(
      editor.document.getText(),
      editor.document.uri,
      workspace.getWorkspaceFolder(editor.document.uri),
    )
    const colonRanges: Range[] = []
    const plainRanges: Range[] = []

    for (const todo of todos) {
      const range = new Range(todo.line, todo.character, todo.line, todo.endCharacter)
      if (todo.severity === 'colon') colonRanges.push(range)
      else plainRanges.push(range)
    }

    editor.setDecorations(this.colonDecoration, colonRanges)
    editor.setDecorations(this.plainDecoration, plainRanges)
  }

  dispose(): void {
    this.colonDecoration.dispose()
    this.plainDecoration.dispose()
  }
}
