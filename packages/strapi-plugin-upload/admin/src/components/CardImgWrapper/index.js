import styled from 'styled-components';
import PropTypes from 'prop-types';

const CardImgWrapper = styled.div`
  position: relative;
  height: ${({ isSmall }) => (isSmall ? '127px' : '156px')};
  min-width: ${({ isSmall }) => (isSmall ? '200px' : '245px')};
  border-radius: 2px;
  background: ${({ withOverlay }) => (withOverlay ? '#F6F6F6' : '#333740')};

  ${({ hasError }) => {
    if (hasError) {
      return `
        background: #F2F3F4;
        border: 1px solid #FF5D00;
      `;
    }

    return '';
  }}
`;

CardImgWrapper.defaultProps = {
  hasError: false,
  isSmall: false,
};

CardImgWrapper.propTypes = {
  hasError: PropTypes.bool,
  isSmall: PropTypes.bool,
};

export default CardImgWrapper;
