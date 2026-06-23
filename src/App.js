import React from 'react';
import PDFFlipBook from './components/FlipBook/PDFFlipBook';
import './App.css';

function App() {
  return (
    <div className="App-container">
      {/* Premium Header */}
      <header className="app-header">
        <div className="header-logo-section">
          <div className="logo-glow"></div>
          <span className="brand-title">Carta<span className="accent-color">Úniko</span></span>

        </div>
        {/*
        <p className="header-subtitle">
          Catálogos digitales interactivos con simulación realista de papel 3D
        </p> 
        */}
      </header>

      {/* Main Container */}
      <main className="app-main-content">
        <div className="viewer-container-outer">
          <PDFFlipBook pdfUrl="/pdf/carta.pdf" />
        </div>
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>© 2026 CartaÚniko. Desarrollado por Groovit</p>
      </footer>
    </div>
  );
}

export default App;
