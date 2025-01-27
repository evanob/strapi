'use strict';

/**
 * Module dependencies
 */

// Public node modules.
const _ = require('lodash');
const { buildFederatedSchema } = require('@apollo/federation');
const { ApolloServer } = require('apollo-server-koa');
const { transformSchema, FilterRootFields } = require('graphql-tools');
const depthLimit = require('graphql-depth-limit');
const loadConfigs = require('./load-config');

const removeExplicitlyDisabledResolvers = schema => {
  const resolvers = strapi.plugins.graphql.config._schema.graphql.resolver;

  return transformSchema(schema, [
    new FilterRootFields((operation, fieldName) => {
      const resolverIsAbsent =
        !resolvers[operation] || resolvers[operation][fieldName] === undefined;
      const resolverIsTruthy = !!resolvers[operation][fieldName];

      return resolverIsAbsent || resolverIsTruthy;
    }),
  ]);
};

module.exports = strapi => {
  const { appPath, installedPlugins } = strapi.config;

  return {
    async beforeInitialize() {
      // Try to inject this hook just after the others hooks to skip the router processing.
      if (!_.get(strapi.config.hook.load, 'after')) {
        _.set(strapi.config.hook.load, 'after', []);
      }

      strapi.config.hook.load.after.push('graphql');
      // Load core utils.

      const { api, plugins, extensions } = await loadConfigs({
        appPath,
        installedPlugins,
      });
      _.merge(strapi, { api, plugins });

      /*
       * Create a merge of all the GraphQL configuration.
       */
      const apisSchemas = Object.keys(strapi.api || {}).map(key =>
        _.get(strapi.api[key], 'config.schema.graphql', {})
      );

      const pluginsSchemas = Object.keys(strapi.plugins || {}).map(key =>
        _.get(strapi.plugins[key], 'config.schema.graphql', {})
      );

      const extensionsSchemas = Object.keys(extensions || {}).map(key =>
        _.get(extensions[key], 'config.schema.graphql', {})
      );

      // save the final schema in the plugin's config
      _.set(
        strapi,
        ['plugins', 'graphql', 'config', '_schema', 'graphql'],
        mergeSchemas([...apisSchemas, ...pluginsSchemas, ...extensionsSchemas])
      );
    },

    initialize() {
      const {
        typeDefs,
        resolvers,
      } = strapi.plugins.graphql.services.schema.generateSchema();

      if (_.isEmpty(typeDefs)) {
        strapi.log.warn(
          'The GraphQL schema has not been generated because it is empty'
        );

        return;
      }

      const serverParams = {
        typeDefs,
        resolvers,
        context: ({ ctx }) => {
          // Initiliase loaders for this request.
          // TODO: set loaders in the context not globally
          strapi.plugins.graphql.services.loaders.initializeLoader();

          return {
            context: ctx,
          };
        },
        validationRules: [depthLimit(strapi.plugins.graphql.config.depthLimit)],
        tracing: _.get(strapi.plugins.graphql, 'config.tracing', false),
        playground: false,
        cors: false,
        bodyParserConfig: true,
        introspection: _.get(
          strapi.plugins.graphql,
          'config.introspection',
          true
        ),
      };

      // Disable GraphQL Playground in production environment.
      if (
        strapi.config.environment !== 'production' ||
        strapi.plugins.graphql.config.playgroundAlways
      ) {
        serverParams.playground = {
          endpoint: strapi.plugins.graphql.config.endpoint,
          shareEnabled: strapi.plugins.graphql.config.shareEnabled,
        };
      }

      const otherServerParams = _.omit(serverParams, ['typeDefs', 'resolvers']);
      const schema = removeExplicitlyDisabledResolvers(
        buildFederatedSchema({ typeDefs, resolvers })
      );
      const server = new ApolloServer({ schema, ...otherServerParams });

      server.applyMiddleware({
        app: strapi.app,
        path: strapi.plugins.graphql.config.endpoint,
      });
    },
  };
};

/**
 * Merges a  list of schemas
 * @param {Array<Object>} schemas - The list of schemas to merge
 */
const mergeSchemas = schemas => {
  return schemas.reduce((acc, el) => {
    const { definition, query, mutation, type, resolver } = el;

    return _.merge(acc, {
      definition: `${acc.definition || ''} ${definition || ''}`,
      query: `${acc.query || ''} ${query || ''}`,
      mutation: `${acc.mutation || ''} ${mutation || ''}`,
      type,
      resolver,
    });
  }, {});
};
