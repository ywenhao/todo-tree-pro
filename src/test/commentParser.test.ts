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
      '; TODO tenth',
      '% TODO eleventh',
      '" TODO twelfth',
      'REM TODO thirteenth',
      ':: TODO fourteenth',
      '<# TODO fifteenth #>',
      '--[[ TODO sixteenth ]]',
      '{- TODO seventeenth -}',
      '{# TODO eighteenth #}',
      '{{-- TODO nineteenth --}}',
      '@* TODO twentieth *@',
      '<%# TODO twenty-first %>',
      '=begin',
      'TODO twenty-second',
      '=end',
    ].join('\n')
    const uri = {
      scheme: 'file',
      fsPath: '/workspace/src/example.ts',
      toString: () => 'file:///workspace/src/example.ts',
    } as Uri
    const todos = parseTodosFromText(text, uri, undefined)

    expect(todos).toHaveLength(22)
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
      'plain',
      'plain',
      'plain',
      'plain',
      'plain',
      'plain',
      'plain',
      'plain',
      'plain',
      'plain',
      'plain',
      'plain',
      'plain',
    ])
    expect(todos.map((todo) => todo.line)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 25,
    ])
    expect(todos[2].text).toBe('third')
    expect(todos[3].text).toBe('fourth')
    expect(todos[7].text).toBe('html eighth')
    expect(todos[14].text).toBe('fifteenth')
    expect(todos[21].text).toBe('twenty-second')
  })
})
