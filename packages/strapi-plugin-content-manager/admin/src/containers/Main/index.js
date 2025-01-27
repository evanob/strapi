import React, { Suspense, lazy, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { bindActionCreators, compose } from 'redux';
import { Switch, Route } from 'react-router-dom';
import {
  LoadingIndicatorPage,
  useGlobalContext,
  request,
} from 'strapi-helper-plugin';
import { DndProvider } from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';
import pluginId from '../../pluginId';
import DragLayer from '../../components/DragLayer';
import getRequestUrl from '../../utils/getRequestUrl';
import createPossibleMainFieldsForModelsAndComponents from './utils/createPossibleMainFieldsForModelsAndComponents';
import {
  deleteLayout,
  deleteLayouts,
  getDataSucceeded,
  getLayoutSucceeded,
  resetProps,
} from './actions';
import reducer from './reducer';
import makeSelectMain from './selectors';

const EditSettingsView = lazy(() => import('../EditSettingsView'));
const RecursivePath = lazy(() => import('../RecursivePath'));

function Main({
  deleteLayout,
  deleteLayouts,
  getDataSucceeded,
  getLayoutSucceeded,
  components,
  componentsAndModelsMainPossibleMainFields,
  isLoading,
  layouts,
  location: { pathname },
  global: { currentEnvironment, plugins },
  models,
  resetProps,
}) {
  // FIXME: when new store injector available
  strapi.useInjectReducer({ key: 'main', reducer, pluginId });

  const { emitEvent } = useGlobalContext();
  const slug = pathname.split('/')[3];
  const getDataRef = useRef();
  const getLayoutRef = useRef();
  const resetPropsRef = useRef();

  getDataRef.current = async () => {
    try {
      const [{ data: components }, { data: models }] = await Promise.all(
        ['components', 'content-types'].map(endPoint =>
          request(getRequestUrl(endPoint), { method: 'GET' })
        )
      );

      getDataSucceeded(components, models, {
        ...createPossibleMainFieldsForModelsAndComponents(components),
        ...createPossibleMainFieldsForModelsAndComponents(models),
      });
    } catch (err) {
      strapi.notification.error('notification.error');
    }
  };

  getLayoutRef.current = async uid => {
    try {
      const { data: layout } = await request(
        getRequestUrl(`content-types/${uid}`),
        { method: 'GET' }
      );

      getLayoutSucceeded(layout, uid);
    } catch (err) {
      strapi.notification.error('notification.error');
    }
  };
  resetPropsRef.current = resetProps;

  const shouldShowLoader =
    !pathname.includes('ctm-configurations/') && layouts[slug] === undefined;

  useEffect(() => {
    getDataRef.current();

    return () => {
      resetPropsRef.current();
    };
  }, [getDataRef]);

  useEffect(() => {
    if (shouldShowLoader) {
      getLayoutRef.current(slug);
    }
  }, [getLayoutRef, shouldShowLoader, slug]);

  if (isLoading || shouldShowLoader) {
    return <LoadingIndicatorPage />;
  }

  const renderRoute = (props, Component) => (
    <Component
      currentEnvironment={currentEnvironment}
      deleteLayout={deleteLayout}
      deleteLayouts={deleteLayouts}
      emitEvent={emitEvent}
      components={components}
      componentsAndModelsMainPossibleMainFields={
        componentsAndModelsMainPossibleMainFields
      }
      layouts={layouts}
      models={models}
      plugins={plugins}
      {...props}
    />
  );
  const routes = [
    {
      path: 'ctm-configurations/edit-settings/:type/:componentSlug',
      comp: EditSettingsView,
    },
    { path: ':slug', comp: RecursivePath },
  ].map(({ path, comp }) => (
    <Route
      key={path}
      path={`/plugins/${pluginId}/${path}`}
      render={props => renderRoute(props, comp)}
    />
  ));

  return (
    <DndProvider backend={HTML5Backend}>
      <DragLayer />
      <Suspense fallback={<LoadingIndicatorPage />}>
        <Switch>{routes}</Switch>
      </Suspense>
    </DndProvider>
  );
}

Main.propTypes = {
  deleteLayout: PropTypes.func.isRequired,
  deleteLayouts: PropTypes.func.isRequired,
  getDataSucceeded: PropTypes.func.isRequired,
  getLayoutSucceeded: PropTypes.func.isRequired,
  global: PropTypes.shape({
    currentEnvironment: PropTypes.string.isRequired,
    plugins: PropTypes.object,
  }).isRequired,
  components: PropTypes.array.isRequired,
  componentsAndModelsMainPossibleMainFields: PropTypes.object.isRequired,
  isLoading: PropTypes.bool.isRequired,
  layouts: PropTypes.object.isRequired,
  location: PropTypes.shape({
    pathname: PropTypes.string.isRequired,
    search: PropTypes.string,
  }).isRequired,
  models: PropTypes.array.isRequired,
  resetProps: PropTypes.func.isRequired,
};

const mapStateToProps = makeSelectMain();

export function mapDispatchToProps(dispatch) {
  return bindActionCreators(
    {
      deleteLayout,
      deleteLayouts,
      getDataSucceeded,
      getLayoutSucceeded,
      resetProps,
    },
    dispatch
  );
}
const withConnect = connect(mapStateToProps, mapDispatchToProps);

export default compose(withConnect)(Main);
