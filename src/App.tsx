import React from 'react';
import { Provider } from 'react-redux';
import { store } from './presentation/store/store';
import Calendar from './presentation/components/calendar/Calendar';
import { Global, css } from '@emotion/react';

const globalStyles = css`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html, body {
    height: 100%;
    overflow: auto;
    width: 100%;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
      Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    background-color: #f0f2f5;
    width: 100%;
  }

  #root {
    height: 100%;
    overflow: auto;
    width: 100%;
  }
`;

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <Global styles={globalStyles} />
      <Calendar />
    </Provider>
  );
};

export default App;
