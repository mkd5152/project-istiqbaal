import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import GlobalLoader from './components/GlobalLoader';
import { ScanConfigProvider } from './contexts/ScanConfigContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ScanConfigProvider>
    <App />
    <GlobalLoader />
  </ScanConfigProvider>
);