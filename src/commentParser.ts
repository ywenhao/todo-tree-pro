import type { TodoMatch } from './types'
import type { Uri, WorkspaceFolder } from 'vscode'

interface CommentSpan {
  start: number
  end: number
}

interface ScannerState {
  inBlock: boolean
  blockEnd: string
}

const TODO_PATTERN = /\btodo\b\s*:?/gi

const LINE_COMMENT_TOKENS = ['//', '#', '--', ';', '%', '"']

const BLOCK_COMMENT_PAIRS = [
  ['/*', '*/'],
  ['<!--', '-->'],
  ['{/*', '*/}'],
  ['(*', '*)'],
] as const

export function parseTodosFromText(text: string, uri: Uri, workspaceFolder: WorkspaceFolder | undefined): TodoMatch[] {
  const lines = text.split(/\r?\n/)
  const todos: TodoMatch[] = []
  const state: ScannerState = {
    inBlock: false,
    blockEnd: '',
  }

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const commentSpans = collectCommentSpans(line, state)

    for (const span of commentSpans) todos.push(...findTodosInComment(line, span, index, uri, workspaceFolder))
  }

  return todos
}

function collectCommentSpans(line: string, state: ScannerState): CommentSpan[] {
  const spans: CommentSpan[] = []
  let offset = 0

  while (offset < line.length) {
    if (state.inBlock) {
      const endIndex = line.indexOf(state.blockEnd, offset)
      if (endIndex === -1) {
        spans.push({ start: offset, end: line.length })
        return spans
      }

      spans.push({ start: offset, end: endIndex })
      offset = endIndex + state.blockEnd.length
      state.inBlock = false
      state.blockEnd = ''
      continue
    }

    const nextLineComment = findNextLineComment(line, offset)
    const nextBlockComment = findNextBlockComment(line, offset)

    if (!nextLineComment && !nextBlockComment) break

    if (nextLineComment && (!nextBlockComment || nextLineComment.index < nextBlockComment.index)) {
      spans.push({
        start: nextLineComment.index + nextLineComment.token.length,
        end: line.length,
      })
      break
    }

    if (nextBlockComment) {
      const contentStart = nextBlockComment.index + nextBlockComment.startToken.length
      const endIndex = line.indexOf(nextBlockComment.endToken, contentStart)

      if (endIndex === -1) {
        spans.push({ start: contentStart, end: line.length })
        state.inBlock = true
        state.blockEnd = nextBlockComment.endToken
        break
      }

      spans.push({ start: contentStart, end: endIndex })
      offset = endIndex + nextBlockComment.endToken.length
    }
  }

  return spans
}

function findNextLineComment(line: string, offset: number): { index: number; token: string } | undefined {
  let best: { index: number; token: string } | undefined

  for (const token of LINE_COMMENT_TOKENS) {
    let index = line.indexOf(token, offset)

    while (index !== -1) {
      if (isLikelyCommentStart(line, index, token)) {
        if (!best || index < best.index) best = { index, token }

        break
      }

      index = line.indexOf(token, index + token.length)
    }
  }

  return best
}

function findNextBlockComment(
  line: string,
  offset: number,
): { index: number; startToken: string; endToken: string } | undefined {
  let best: { index: number; startToken: string; endToken: string } | undefined

  for (const [startToken, endToken] of BLOCK_COMMENT_PAIRS) {
    const index = line.indexOf(startToken, offset)
    if (index !== -1 && (!best || index < best.index)) best = { index, startToken, endToken }
  }

  return best
}

function isLikelyCommentStart(line: string, index: number, token: string): boolean {
  if (token === '"' || token === ';' || token === '%') return line.slice(0, index).trim() === ''

  if (token !== '#') return true

  const before = line.slice(0, index).trim()
  if (before === '') return true

  return /\s$/.test(line[index - 1] ?? '')
}

function findTodosInComment(
  line: string,
  span: CommentSpan,
  lineIndex: number,
  uri: Uri,
  workspaceFolder: WorkspaceFolder | undefined,
): TodoMatch[] {
  const matches: TodoMatch[] = []
  const commentText = line.slice(span.start, span.end)
  TODO_PATTERN.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = TODO_PATTERN.exec(commentText))) {
    const rawKeyword = match[0]
    const start = span.start + match.index
    const end = start + rawKeyword.length
    const afterKeyword = line.slice(end, span.end).trim()
    const workspaceFolderPath = workspaceFolder?.uri.fsPath ?? ''
    const workspaceName = workspaceFolder?.name ?? 'Workspace'
    const relativePath = workspaceFolder
      ? normalizeFsPath(uri.fsPath.slice(workspaceFolder.uri.fsPath.length).replace(/^[/\\]/, ''))
      : normalizeFsPath(uri.fsPath)

    matches.push({
      id: `${uri.toString()}:${lineIndex}:${start}`,
      uri,
      workspaceFolder: workspaceFolderPath,
      workspaceName,
      relativePath,
      line: lineIndex,
      character: start,
      endCharacter: end,
      text: afterKeyword || line.trim(),
      keyword: rawKeyword,
      severity: rawKeyword.endsWith(':') ? 'colon' : 'plain',
    })
  }

  return matches
}

function normalizeFsPath(value: string): string {
  return value.replace(/\\/g, '/')
}
