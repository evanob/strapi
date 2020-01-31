'use strict'

const { parseType } = require('strapi-utils')

const { Kind, GraphQLScalarType } = require('graphql')

// This is basically just a string, but we can add validation later
const Markdown = new GraphQLScalarType({
  name: 'Markdown',
  description: 'Valid markdown, ready for translation to HTML, JSX, etc.',
  serialize(value) {
    return parseType({ type: 'markdown', value })
  },
  parseValue(value) {
    return parseType({ type: 'markdown', value })
  },
  parseLiteral(ast) {
    if (ast.kind !== Kind.STRING) {
      throw new TypeError(`Markdown cannot represent non string type`)
    }

    const value = ast.value
    return parseType({ type: 'markdown', value })
  },
})

module.exports = Markdown
