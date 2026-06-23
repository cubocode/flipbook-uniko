import React, { useState, useEffect, useRef } from 'react';
import FlipBook from './FlipBook';
import './PDFFlipBook.css';

// Default sample PDF if the user doesn't provide one
const DEFAULT_PDF = '/pdf/carta.pdf';

/**
 * Helper to dynamically load PDF.js from CDN
 */
const loadPdfjs = () => {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) {
      resolve(window.pdfjsLib);
      return;
    }

    // Add PDFJS stylesheet (optional, but good for fonts)
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf_viewer.min.css';
    document.head.appendChild(link);

    // Add main PDFJS script
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
    script.onload = () => {
      // Set worker source
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    script.onerror = (err) => reject(new Error('Failed to load PDF.js script from CDN'));
    document.head.appendChild(script);
  });
};

const PDFFlipBook = ({ pdfUrl = DEFAULT_PDF }) => {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('Iniciando...');
  const [currentPage, setCurrentPage] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [aspectRatio, setAspectRatio] = useState({ width: 600, height: 800 });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [orientation, setOrientation] = useState('landscape'); // landscape (2 pages) or portrait (1 page)

  const bookRef = useRef(null);
  const viewerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load PDF on url change
  useEffect(() => {
    if (pdfUrl) {
      loadPDF(pdfUrl);
    }
  }, [pdfUrl]);

  // Sync fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      // Trigger a resize event to make StPageFlip update its layout
      setTimeout(() => {
        if (bookRef.current?.getPageFlip()) {
          bookRef.current.getPageFlip().update();
        }
      }, 300);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const loadPDF = async (urlOrData) => {
    setLoading(true);
    setLoadingProgress(5);
    setLoadingText('Cargando motor PDF...');
    console.log('[PDFFlipBook] Iniciando loadPDF con origen:', typeof urlOrData === 'string' ? urlOrData : 'datos binarios');

    try {
      const pdfjs = await loadPdfjs();
      setLoadingProgress(20);
      setLoadingText('Conectando con el documento PDF...');

      const loadingTask = pdfjs.getDocument(urlOrData);

      // Hook download progress
      loadingTask.onProgress = (progress) => {
        if (progress.total > 0) {
          const downloadPercent = Math.round((progress.loaded / progress.total) * 40);
          setLoadingProgress(20 + downloadPercent); // spans 20% to 60%
          setLoadingText(`Descargando catálogo (${Math.round((progress.loaded / progress.total) * 100)}%)...`);
        }
      };

      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;
      setNumPages(totalPages);

      setLoadingProgress(60);
      setLoadingText(`Procesando ${totalPages} páginas...`);
      console.log('[PDFFlipBook] PDF cargado correctamente. Total páginas:', totalPages);

      const renderedPages = [];
      let width = 600;
      let height = 800;

      // Extract & Render pages to high-quality image URLs
      for (let i = 1; i <= totalPages; i++) {
        setLoadingText(`Renderizando página ${i} de ${totalPages}...`);

        const page = await pdf.getPage(i);
        // We use scale 1.5 to get a crisp rendering without consuming too much memory
        const viewport = page.getViewport({ scale: 1.5 });

        if (i === 1) {
          width = viewport.width;
          height = viewport.height;
          setAspectRatio({ width, height });
          console.log('[PDFFlipBook] Dimensiones del viewport de la primera página:', width, height);
        }

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext('2d');

        // Render PDF page to canvas
        await page.render({
          canvasContext: ctx,
          viewport: viewport
        }).promise;

        // Convert to dataUrl to keep in memory as simple images
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        renderedPages.push(dataUrl);

        // Spans 60% to 100% loading progress
        const renderPercent = 60 + Math.round((i / totalPages) * 40);
        setLoadingProgress(renderPercent);
      }

      console.log('[PDFFlipBook] Renderizado de páginas completado. Cantidad de imágenes generadas:', renderedPages.length);
      setPages(renderedPages);
      setCurrentPage(0);
      setLoading(false);
    } catch (err) {
      console.error('[PDFFlipBook] Error al procesar el PDF:', err);
      setLoadingText(`Error al cargar: ${err.message}. Intentá subir otro archivo.`);
      setLoadingProgress(0);
    }
  };

  /*
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const arrayBuffer = event.target.result;
      await loadPDF({ data: arrayBuffer });
    };
    reader.readAsArrayBuffer(file);
  };
*/
  const handlePrevPage = () => {
    if (bookRef.current) {
      bookRef.current.flipPrev();
    }
  };

  const handleNextPage = () => {
    if (bookRef.current) {
      bookRef.current.flipNext();
    }
  };

  const handleJumpToPage = (index) => {
    if (bookRef.current) {
      bookRef.current.turnToPage(index);
    }
  };

  const toggleFullscreen = () => {
    const element = viewerRef.current;
    if (!element) return;

    if (!document.fullscreenElement) {
      if (element.requestFullscreen) {
        element.requestFullscreen();
      } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
      } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // Helper to format the active page number range depending on orientation
  const renderPageIndicator = () => {
    if (numPages === 0) return '';

    // In landscape mode, pages are viewed in spreads
    if (orientation === 'landscape') {
      if (currentPage === 0) {
        return 'Tapa (Pág. 1)';
      }
      if (currentPage === numPages - 1 && numPages % 2 === 0) {
        return `Contratapa (Pág. ${numPages})`;
      }

      // Active spreads
      const leftPage = currentPage;
      const rightPage = currentPage + 1;

      if (rightPage >= numPages) {
        return `Pág. ${leftPage + 1} de ${numPages}`;
      }

      return `Págs. ${leftPage + 1} - ${rightPage + 1} de ${numPages}`;
    }

    // Portrait mode (single page view)
    return `Pág. ${currentPage + 1} de ${numPages}`;
  };

  // Calculate scaled dimensions to fit within reasonable limits
  const getScaledDimensions = () => {
    const maxSingleWidth = 450;
    const maxSingleHeight = 600;

    let bookWidth = aspectRatio.width;
    let bookHeight = aspectRatio.height;

    const widthRatio = maxSingleWidth / bookWidth;
    const heightRatio = maxSingleHeight / bookHeight;
    const scale = Math.min(widthRatio, heightRatio, 1);

    const finalWidth = Math.round(bookWidth * scale);
    const finalHeight = Math.round(bookHeight * scale);

    console.log('[PDFFlipBook] Sizing:', aspectRatio.width, 'x', aspectRatio.height, '-> Scaled:', finalWidth, 'x', finalHeight, 'scale:', scale);

    return {
      width: finalWidth,
      height: finalHeight
    };
  };

  const scaledDims = getScaledDimensions();

  return (
    <div ref={viewerRef} className={`pdf-viewer-wrapper ${isFullscreen ? 'fullscreen-mode' : ''}`}>
      {/* Loading Overlay */}
      {loading && (
        <div className="pdf-loading-overlay">
          <div className="loading-spinner-box">
            <div className="loading-spinner"></div>
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>
            <p className="loading-progress-text">{loadingProgress}%</p>
            <p className="loading-status-text">{loadingText}</p>
          </div>
        </div>
      )}

      {/* Sidebar Panel with Thumbnails */}
      <div className={`pdf-sidebar-thumbnails ${isSidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <h3>Páginas</h3>
          <button className="sidebar-close-btn" onClick={() => setIsSidebarOpen(false)}>×</button>
        </div>
        <div className="thumbnails-grid">
          {pages.map((imgUrl, index) => {
            const isPageActive = orientation === 'landscape'
              ? (index === currentPage || (currentPage > 0 && index === currentPage + 1))
              : index === currentPage;

            return (
              <div
                key={index}
                className={`thumbnail-item ${isPageActive ? 'active-thumbnail' : ''}`}
                onClick={() => handleJumpToPage(index)}
              >
                <div className="thumbnail-img-wrapper">
                  <img src={imgUrl} alt={`Pág. ${index + 1}`} loading="lazy" />
                </div>
                <span className="thumbnail-number">{index + 1}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main View Area */}
      <div className="pdf-main-content">
        {pages.length > 0 ? (
          <FlipBook
            key={`${pages.length}-${scaledDims.width}-${scaledDims.height}`}
            ref={bookRef}
            pages={pages}
            width={scaledDims.width}
            height={scaledDims.height}
            showCover={true}
            onFlip={(index) => setCurrentPage(index)}
            onChangeOrientation={(orient) => setOrientation(orient)}
            className="pdf-flipbook-instance"
          />
        ) : (
          !loading && (
            <div className="pdf-empty-state">
              <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <p>No se cargó ningún catálogo.</p>
              <button
                className="btn-primary"
                onClick={() => fileInputRef.current?.click()}
              >
                Cargar Catálogo PDF
              </button>
            </div>
          )
        )}
      </div>

      {/* Floating Control Dashboard (Glassmorphic Bottom Panel) */}
      <div className="pdf-control-dashboard">
        <div className="controls-left">
          <button
            className={`control-btn ${isSidebarOpen ? 'active' : ''}`}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title="Mostrar miniaturas"
            disabled={pages.length === 0}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>
          {/*
          <button 
            className="control-btn" 
            onClick={() => fileInputRef.current?.click()}
            title="Subir propio PDF"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".pdf" 
            style={{ display: 'none' }} 
          />
          */}

        </div>

        <div className="controls-center">
          <button
            className="control-btn nav-arrow"
            onClick={handlePrevPage}
            disabled={currentPage === 0 || pages.length === 0}
            title="Página Anterior"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <span className="page-indicator-badge">
            {renderPageIndicator()}
          </span>

          <button
            className="control-btn nav-arrow"
            onClick={handleNextPage}
            disabled={currentPage >= numPages - 1 || pages.length === 0}
            title="Página Siguiente"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <div className="controls-right">
          <button
            className={`control-btn ${isFullscreen ? 'active' : ''}`}
            onClick={toggleFullscreen}
            title="Pantalla Completa"
          >
            {isFullscreen ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3M10 21v-6H4M14 3v6h6" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PDFFlipBook;
