import assert from 'node:assert/strict'
import type { Uri } from 'vscode'
import { parseTodosFromText } from '../commentParser'

const text = [
  '// TODO first',
  '//TODO second',
  '/** TODO third */',
  '/**TODO fourth */',
  '/// TODO fifth',
  '# todo: sixth',
  '-- Todo seventh',
  'const value = "TODO not comment"',
  '/*',
  ' * TODO: eighth',
  ' */',
].join('\n')

const uri = {
  scheme: 'file',
  fsPath: '/workspace/src/example.ts',
  toString: () => 'file:///workspace/src/example.ts',
} as Uri
const todos = parseTodosFromText(text, uri, undefined)

assert.equal(todos.length, 8)
assert.deepEqual(
  todos.map((todo) => todo.severity),
  ['plain', 'plain', 'plain', 'plain', 'plain', 'colon', 'plain', 'colon'],
)
assert.deepEqual(
  todos.map((todo) => todo.line),
  [0, 1, 2, 3, 4, 5, 6, 9],
)
assert.equal(todos[2].text, 'third')
assert.equal(todos[3].text, 'fourth')

console.log('commentParser.test.ts passed')
