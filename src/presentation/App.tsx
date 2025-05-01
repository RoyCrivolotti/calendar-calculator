import React from 'react';
import { Provider } from 'react-redux';
import { store } from './store/store';
import Calendar from './components/calendar/Calendar';
import styled from '@emotion/styled';

const AppContainer = styled.div`
  min-height: 100vh;
  background-color: #f1f5f9;
  padding: 2rem;
`;

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <AppContainer>
        <Calendar />
      </AppContainer>
    </Provider>
  );
};

export default App; 