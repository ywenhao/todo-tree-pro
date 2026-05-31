import type { TodoMatch } from './types'
import type { Uri, WorkspaceFolder } from 'vscode'

interface CommentSpan {
  start: number
  end: number
}

interface LineCommentToken {
  token: string
  placement?: 'any' | 'line-start' | 'hash'
  caseInsensitive?: boolean
  requireTrailingBoundary?: boolean
}

interface BlockCommentPair {
  startToken: string
  endToken: string
  startPlacement?: 'any' | 'line-start'
  endPlacement?: 'any' | 'line-start'
}

interface ScannerState {
  inBlock: boolean
  blockEnd: string
  blockEndPlacement: 'any' | 'line-start'
}

const TODO_PATTERN = /\btodo\b:?/gi

const LINE_COMMENT_TOKENS: LineCommentToken[] = [
  { token: '//' },
  { token: '#' },
  { token: '--' },
  { token: ';', placement: 'line-start' },
  { token: '%', placement: 'line-start' },
  { token: '"', placement: 'line-start' },
  { token: '::', placement: 'line-start' },
  { token: 'REM', placement: 'line-start', caseInsensitive: true, requireTrailingBoundary: true },
]

const BLOCK_COMMENT_PAIRS: BlockCommentPair[] = [
  { startToken: '/*', endToken: '*/' },
  { startToken: '<!--', endToken: '-->' },
  { startToken: '{/*', endToken: '*/}' },
  { startToken: '(*', endToken: '*)' },
  { startToken: '--[[', endToken: ']]' },
  { startToken: '{-', endToken: '-}' },
  { startToken: '<#', endToken: '#>' },
  { startToken: '{#', endToken: '#}' },
  { startToken: '{{--', endToken: '--}}' },
  { startToken: '@*', endToken: '*@' },
  { startToken: '<%#', endToken: '%>' },
  { startToken: '=begin', endToken: '=end', startPlacement: 'line-start', endPlacement: 'line-start' },
]

export function parseTodosFromText(text: string, uri: Uri, workspaceFolder: WorkspaceFolder | undefined): TodoMatch[] {
  const lines = text.split(/\r?\n/)
  const todos: TodoMatch[] = []
  const state: ScannerState = {
    inBlock: false,
    blockEnd: '',
    blockEndPlacement: 'any',
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
      const endIndex = findBlockEnd(line, offset, state.blockEnd, state.blockEndPlacement)
      if (endIndex === -1) {
        spans.push({ start: offset, end: line.length })
        return spans
      }

      spans.push({ start: offset, end: endIndex })
      offset = endIndex + state.blockEnd.length
      state.inBlock = false
      state.blockEnd = ''
      state.blockEndPlacement = 'any'
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
      const endIndex = findBlockEnd(
        line,
        contentStart,
        nextBlockComment.endToken,
        nextBlockComment.endPlacement ?? 'any',
      )

      if (endIndex === -1) {
        spans.push({ start: contentStart, end: line.length })
        state.inBlock = true
        state.blockEnd = nextBlockComment.endToken
        state.blockEndPlacement = nextBlockComment.endPlacement ?? 'any'
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
    let index = findTokenIndex(line, token, offset)

    while (index !== -1) {
      if (isLikelyCommentStart(line, index, token)) {
        if (!best || index < best.index) best = { index, token: token.token }

        break
      }

      index = findTokenIndex(line, token, index + token.token.length)
    }
  }

  return best
}

function findNextBlockComment(
  line: string,
  offset: number,
): (BlockCommentPair & { index: number }) | undefined {
  let best: (BlockCommentPair & { index: number }) | undefined

  for (const pair of BLOCK_COMMENT_PAIRS) {
    const index = line.indexOf(pair.startToken, offset)
    if (index === -1 || !isLikelyBlockStart(line, index, pair)) continue
    if (!best || index < best.index) best = { ...pair, index }
  }

  return best
}

function findBlockEnd(line: string, offset: number, token: string, placement: 'any' | 'line-start'): number {
  let index = line.indexOf(token, offset)

  while (index !== -1) {
    if (placement !== 'line-start' || line.slice(0, index).trim() === '') return index

    index = line.indexOf(token, index + token.length)
  }

  return -1
}

function findTokenIndex(line: string, token: LineCommentToken, offset: number): number {
  if (!token.caseInsensitive) return line.indexOf(token.token, offset)

  return line.toLocaleLowerCase().indexOf(token.token.toLocaleLowerCase(), offset)
}

function isLikelyCommentStart(line: string, index: number, token: LineCommentToken): boolean {
  if (token.placement === 'line-start') {
    return line.slice(0, index).trim() === '' && hasTrailingBoundary(line, index, token)
  }

  if (token.token !== '#') return hasTrailingBoundary(line, index, token)

  const before = line.slice(0, index).trim()
  if (before === '') return hasTrailingBoundary(line, index, token)

  return /\s$/.test(line[index - 1] ?? '') && hasTrailingBoundary(line, index, token)
}

function isLikelyBlockStart(line: string, index: number, pair: BlockCommentPair): boolean {
  return pair.startPlacement !== 'line-start' || line.slice(0, index).trim() === ''
}

function hasTrailingBoundary(line: string, index: number, token: LineCommentToken): boolean {
  if (!token.requireTrailingBoundary) return true

  const next = line[index + token.token.length]
  return next === undefined || /\s/.test(next)
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
