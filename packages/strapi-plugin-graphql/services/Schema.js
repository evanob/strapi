'use strict';

/**
 * GraphQL.js service
 *
 * @description: A set of functions similar to controller's actions to avoid code duplication.
 */

const { buildFederatedSchema } = require('@apollo/federation');
const { gql } = require('apollo-server-koa');
const _ = require('lodash');
const graphql = require('graphql');
const Query = require('./Query.js');
const Mutation = require('./Mutation.js');
const Types = require('./Types.js');
const Resolvers = require('./Resolvers.js');

const schemaBuilder = {
  /**
   * Receive an Object and return a string which is following the GraphQL specs.
   *
   * @return String
   */

  formatGQL: function(fields, description = {}, model = {}, type = 'field') {
    const typeFields = JSON.stringify(fields, null, 2).replace(/['",]+/g, '');
    const lines = typeFields.split('\n');

    // Try to add description for field.
    if (type === 'field') {
      return lines
        .map(line => {
          if (['{', '}'].includes(line)) {
            return '';
          }

          const split = line.split(':');
          const attribute = _.trim(split[0]);
          const info =
            (_.isString(description[attribute])
              ? description[attribute]
              : _.get(description[attribute], 'description')) ||
            _.get(model, `attributes.${attribute}.description`);
          const deprecated =
            _.get(description[attribute], 'deprecated') ||
            _.get(model, `attributes.${attribute}.deprecated`);

          // Snakecase an attribute when we find a dash.
          if (attribute.indexOf('-') !== -1) {
            line = `  ${_.snakeCase(attribute)}: ${_.trim(split[1])}`;
          }

          if (info) {
            line = `  """\n    ${info}\n  """\n${line}`;
          }

          if (deprecated) {
            line = `${line} @deprecated(reason: "${deprecated}")`;
          }

          return line;
        })
        .join('\n');
    } else if (type === 'query' || type === 'mutation') {
      return lines
        .map((line, index) => {
          if (['{', '}'].includes(line) || _.isEmpty(fields)) {
            return '';
          }

          const split = Object.keys(fields)[index - 1].split('(');
          const attribute = _.trim(split[0]);
          const info = _.get(description[attribute], 'description');
          const deprecated = _.get(description[attribute], 'deprecated');

          // Snakecase an attribute when we find a dash.
          if (attribute.indexOf('-') !== -1) {
            line = `  ${_.snakeCase(attribute)}(${_.trim(split[1])}`;
          }

          if (info) {
            line = `  """\n    ${info}\n  """\n${line}`;
          }

          if (deprecated) {
            line = `${line} @deprecated(reason: "${deprecated}")`;
          }

          return line;
        })
        .join('\n');
    }

    return lines
      .map((line, index) => {
        if ([0, lines.length - 1].includes(index)) {
          return '';
        }

        return line;
      })
      .join('\n');
  },

  /**
   * Retrieve description from variable and return a string which follow the GraphQL specs.
   *
   * @return String
   */

  getDescription: (description, model = {}) => {
    const format = '"""\n';

    const str =
      _.get(description, '_description') || _.isString(description)
        ? description
        : undefined || _.get(model, 'info.description');

    if (str) {
      return `${format}${str}\n${format}`;
    }

    return '';
  },

  /**
   * Generate GraphQL schema.
   *
   * @return Schema
   */

  generateSchema: function() {
    // Generate type definition and query/mutation for models.
    let shadowCRUD = { definition: '', query: '', mutation: '', resolvers: {} };

    // build defaults schemas if shadowCRUD is enabled
    if (strapi.plugins.graphql.config.shadowCRUD !== false) {
      const modelCruds = Resolvers.buildShadowCRUD(
        _.omitBy(strapi.models, model => model.internal === true)
      );

      shadowCRUD = Object.keys(strapi.plugins).reduce((acc, plugin) => {
        const {
          definition,
          query,
          mutation,
          resolvers,
        } = Resolvers.buildShadowCRUD(strapi.plugins[plugin].models, plugin);

        // We cannot put this in the merge because it's a string.
        acc.definition += definition || '';

        return _.merge(acc, {
          query,
          resolvers,
          mutation,
        });
      }, modelCruds);
    }

    const componentsSchema = {
      definition: '',
      resolvers: {},
    };

    Object.keys(strapi.components).forEach(key =>
      Resolvers.buildModel(strapi.components[key], {
        isComponent: true,
        schema: componentsSchema,
      })
    );

    // Extract custom definition, query or resolver.
    const {
      definition,
      query,
      mutation,
      resolver = {},
    } = strapi.plugins.graphql.config._schema.graphql;

    // Polymorphic.
    const {
      polymorphicDef,
      polymorphicResolver,
    } = Types.addPolymorphicUnionType(definition, shadowCRUD.definition);

    // Build resolvers.
    const resolvers =
      _.omitBy(
        _.merge(
          shadowCRUD.resolvers,
          componentsSchema.resolvers,
          resolver,
          polymorphicResolver
        ),
        _.isEmpty
      ) || {};

    // Transform object to only contain function.
    Object.keys(resolvers).reduce((acc, type) => {
      if (graphql.isScalarType(acc[type])) {
        return acc;
      }

      return Object.keys(acc[type]).reduce((acc, resolverName) => {
        const resolverObj = acc[type][resolverName];
        // Disabled this query.
        if (resolverObj === false) {
          delete acc[type][resolverName];

          return acc;
        }

        if (_.isFunction(resolverObj)) {
          return acc;
        }

        let plugin;
        if (_.has(resolverObj, ['plugin'])) {
          plugin = resolverObj.plugin;
        } else if (_.has(resolverObj, ['resolver', 'plugin'])) {
          plugin = resolverObj.resolver.plugin;
        }

        switch (type) {
          case 'Mutation': {
            let name, action;
            if (
              _.has(resolverObj, ['resolver']) &&
              _.isString(resolverObj.resolver)
            ) {
              [name, action] = resolverObj.resolver.split('.');
            } else if (
              _.has(resolverObj, ['resolver', 'handler']) &&
              _.isString(resolverObj.resolver.handler)
            ) {
              [name, action] = resolverObj.resolver.handler.split('.');
            } else {
              name = null;
              action = resolverName;
            }

            const mutationResolver = Mutation.composeMutationResolver({
              _schema: strapi.plugins.graphql.config._schema.graphql,
              plugin,
              name: _.toLower(name),
              action,
            });

            acc[type][resolverName] = mutationResolver;
            break;
          }
          case 'Query':
          default: {
            acc[type][resolverName] = Query.composeQueryResolver({
              _schema: strapi.plugins.graphql.config._schema.graphql,
              plugin,
              name: resolverName,
              isSingular: 'force', // Avoid singular/pluralize and force query name.
            });
            break;
          }
        }

        return acc;
      }, acc);
    }, resolvers);

    // Return empty schema when there is no model.
    if (_.isEmpty(shadowCRUD.definition) && _.isEmpty(definition)) {
      return {};
    }

    const fieldsToRemove = typeName =>
      Object.keys(resolvers[typeName]).filter(
        key => resolvers[typeName][key] === false
      );

    const removeFields = (document, fieldsToRemove) =>
      document
        .split('\n')
        .map(line => {
          const shouldRemove = fieldsToRemove.some(field =>
            line.match(new RegExp(`^\\s*${field}(\\(.+\\))?: `))
          );
          return shouldRemove ? '' : line;
        })
        .join('\n');

    const cleanedQuery = removeFields(query, fieldsToRemove('Query'));
    const cleanedMutation = removeFields(mutation, fieldsToRemove('Mutation'));
    const shadowCRUDQuery = removeFields(
      shadowCRUD.query &&
        this.formatGQL(shadowCRUD.query, resolver.Query, null, 'query'),
      fieldsToRemove('Query')
    );

    const anyMutationsDefined = !(
      _.isEmpty(shadowCRUD.mutation) && cleanedMutation.match(/^\s+$/)
    );

    // Concatenate.
    let typeDefs = `
      ${definition}
      ${shadowCRUD.definition}
      ${componentsSchema.definition}
      type Query {
        ${shadowCRUDQuery}
        ${cleanedQuery}
      }`;

    if (anyMutationsDefined) {
      typeDefs += `
        type Mutation {${shadowCRUD.mutation &&
          this.formatGQL(
            shadowCRUD.mutation,
            resolver.Mutation,
            null,
            'mutation'
          )}
          ${cleanedMutation}
        }
      `;
    } else {
      delete resolvers.Mutation;
    }

    const disabledTypes = Object.keys(
      strapi.plugins.graphql.config._schema.graphql.type
    ).filter(
      key => strapi.plugins.graphql.config._schema.graphql.type[key] === false
    );
    const morphIsDisabled = disabledTypes.includes('Morph');

    typeDefs += `
      ${Types.addCustomScalar(resolvers)}
      ${Types.addInput()}
      ${morphIsDisabled ? '' : polymorphicDef}
    `;

    disabledTypes.forEach(typeName => {
      const typeMatcher = new RegExp(
        `(extend )?type\\s+${typeName}\\s+{[0-9a-zA-Z_ !:,\\s()\\[\\]]+}`,
        'g'
      );
      const fieldMatcher = new RegExp(
        `^\\s*\\w+(\\(.+\\))?:\\s+\\[?${typeName}!?\\]?\\b.*$`,
        'gm'
      );
      typeDefs = typeDefs
        .replace(typeMatcher, '')
        .replace(fieldMatcher, '\n')
        .replace(/type Mutation\s{\s+}/, '');
    });

    // // Build schema.
    if (!strapi.config.currentEnvironment.server.production) {
      // Write schema.
      const schema = buildFederatedSchema({
        typeDefs: gql(typeDefs),
        resolvers,
      });

      this.writeGenerateSchema(graphql.printSchema(schema));
    }

    return {
      typeDefs: gql(typeDefs),
      resolvers,
    };
  },

  /**
   * Save into a file the readable GraphQL schema.
   *
   * @return void
   */

  writeGenerateSchema: schema => {
    return strapi.fs.writeAppFile('exports/graphql/schema.graphql', schema);
  },
};

module.exports = schemaBuilder;
