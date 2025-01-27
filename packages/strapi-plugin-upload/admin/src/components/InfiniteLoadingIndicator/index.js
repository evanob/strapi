import React from 'react';
import PropTypes from 'prop-types';
import { ClearIcon, useGlobalContext } from 'strapi-helper-plugin';
import Button from './Button';
import Indicator from './Indicator';
import Wrapper from './Wrapper';

const InfiniteLoadingIndicator = ({ onClick }) => {
  const { formatMessage } = useGlobalContext();

  return (
    <Wrapper>
      <Indicator />
      <Button type="button" onClick={onClick}>
        {formatMessage({ id: 'app.components.Button.cancel' })}
        <ClearIcon />
      </Button>
    </Wrapper>
  );
};

InfiniteLoadingIndicator.defaultProps = {
  onClick: () => {},
};

InfiniteLoadingIndicator.propTypes = {
  onClick: PropTypes.func,
};

export default InfiniteLoadingIndicator;
