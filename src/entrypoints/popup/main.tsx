import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createPopupApi } from './api';
import { App } from './App';
import './style.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App api={createPopupApi()} />
  </StrictMode>,
);
