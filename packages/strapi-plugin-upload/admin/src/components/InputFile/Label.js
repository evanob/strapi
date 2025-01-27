import styled from 'styled-components';
import PropTypes from 'prop-types';

const Label = styled.label`
  position: relative;
  height: 203px;
  width: 100%;
  margin-top: 36px;
  margin-bottom: 18px;
  padding-top: 46px;
  border: 2px dashed #e3e9f3;
  border-radius: 2px;
  text-align: center;

  .dragzone {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
  }

  ${({ isDragging }) =>
    isDragging &&
    `
      background-color: rgba(28, 93, 231, 0.01);
      border: 2px dashed rgba(28, 93, 231, 0.1);
    `}
`;

Label.defaultProps = {
  isDragging: false,
};

Label.propTypes = {
  isDragging: PropTypes.bool,
};

export default Label;
