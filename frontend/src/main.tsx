import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import App from './App';

if (window.location.protocol === 'wails:') {
  document.documentElement.classList.add('wails-runtime');
}

const container = document.getElementById('root');

const root = createRoot(container!);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
