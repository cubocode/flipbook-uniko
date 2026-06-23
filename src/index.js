import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Temporary global error tracker for debugging
window.__lastError = null;
window.addEventListener('error', (e) => {
  window.__lastError = {
    message: e.message,
    filename: e.filename,
    lineno: e.lineno,
    colno: e.colno,
    stack: e.error ? e.error.stack : 'No stack'
  };
});
window.addEventListener('unhandledrejection', (e) => {
  window.__lastError = {
    message: e.reason ? e.reason.message : 'Promise rejection',
    stack: e.reason ? e.reason.stack : 'No stack'
  };
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
