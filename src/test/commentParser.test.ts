import type { Uri } from 'vscode'
import { describe, expect, it } from 'vitest'
import { parseTodosFromText } from '../commentParser.js'

describe('parseTodosFromText', () => {
  it('finds TODO markers in supported comment styles', () => {
    const text = [
      '// TODO first',
      '//TODO second',
      '/** TODO third */',
      '/**TODO fourth */',
      '/// TODO fifth',
      '# todo: sixth',
      '-- Todo seventh',
      '<!-- TODO html eighth -->',
      'const value = "TODO not comment"',
      '/*',
      ' * TODO: ninth',
      ' */',
    ].join('\n')
    const uri = {
      scheme: 'file',
      fsPath: '/workspace/src/example.ts',
      toString: () => 'file:///workspace/src/example.ts',
    } as Uri
    const todos = parseTodosFromText(text, uri, undefined)

    expect(todos).toHaveLength(9)
    expect(todos.map((todo) => todo.severity)).toEqual([
      'plain',
      'plain',
      'plain',
      'plain',
      'plain',
      'colon',
      'plain',
      'plain',
      'colon',
    ])
    expect(todos.map((todo) => todo.line)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 10])
    expect(todos[2].text).toBe('third')
    expect(todos[3].text).toBe('fourth')
    expect(todos[7].text).toBe('html eighth')
  })
})
