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
  const mainContentRef = useRef(null);

  const [containerDims, setContainerDims] = useState(() => {
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth < 768;
      const estWidth = isMobile ? window.innerWidth - 40 : Math.min(1100, window.innerWidth) - 80;
      const estHeight = isMobile ? 420 : 580;
      return { width: estWidth, height: estHeight };
    }
    return { width: 600, height: 500 };
  });

  // Track container dimensions using ResizeObserver
  useEffect(() => {
    const element = mainContentRef.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      setContainerDims({ width, height });
    });

    resizeObserver.observe(element);
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Load PDF on url change
  useEffect(() => {
    if (pdfUrl) {
      loadPDF(pdfUrl);
    }
  }, [pdfUrl]);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Reset zoom and pan when page changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [currentPage]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(3, prev + 0.5));
  };

  const handleZoomOut = () => {
    setZoom(prev => {
      const nextZoom = Math.max(1, prev - 0.5);
      if (nextZoom === 1) {
        setPan({ x: 0, y: 0 });
      }
      return nextZoom;
    });
  };

  const handleZoomReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Mouse Drag handlers for panning
  const handleMouseDown = (e) => {
    if (zoom === 1) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x * zoom, y: e.clientY - pan.y * zoom };
  };

  const handleMouseMove = (e) => {
    if (!isDragging || zoom === 1) return;
    const newX = (e.clientX - dragStart.current.x) / zoom;
    const newY = (e.clientY - dragStart.current.y) / zoom;

    const maxPanX = (scaledDims.width * zoom) / 2;
    const maxPanY = (scaledDims.height * zoom) / 2;

    setPan({
      x: Math.max(-maxPanX, Math.min(maxPanX, newX)),
      y: Math.max(-maxPanY, Math.min(maxPanY, newY))
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile (Pinch to zoom & Drag to pan)
  const lastTouchTime = useRef(0);
  const pinchStartDist = useRef(0);
  const pinchStartZoom = useRef(1);

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      // Pinch zoom start
      setIsDragging(false);
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      pinchStartDist.current = Math.sqrt(dx * dx + dy * dy);
      pinchStartZoom.current = zoom;
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTouchTime.current < 300) {
        if (zoom > 1) {
          handleZoomReset();
        } else {
          setZoom(2);
          const touch = e.touches[0];
          const rect = mainContentRef.current.getBoundingClientRect();
          const offsetX = touch.clientX - (rect.left + rect.width / 2);
          const offsetY = touch.clientY - (rect.top + rect.height / 2);
          setPan({ x: -offsetX / 2, y: -offsetY / 2 });
        }
        e.preventDefault();
        return;
      }
      lastTouchTime.current = now;

      if (zoom === 1) return;
      setIsDragging(true);
      const touch = e.touches[0];
      dragStart.current = { x: touch.clientX - pan.x * zoom, y: touch.clientY - pan.y * zoom };
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && pinchStartDist.current > 0) {
      // Pinch zoom in action
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      const currentDist = Math.sqrt(dx * dx + dy * dy);
      
      const scaleFactor = currentDist / pinchStartDist.current;
      const targetZoom = Math.max(1, Math.min(3, pinchStartZoom.current * scaleFactor));
      
      setZoom(targetZoom);
      if (targetZoom === 1) {
        setPan({ x: 0, y: 0 });
      }

      if (e.cancelable) e.preventDefault();
    } else if (isDragging && zoom > 1 && e.touches.length === 1) {
      // Drag pan in action
      const touch = e.touches[0];
      const newX = (touch.clientX - dragStart.current.x) / zoom;
      const newY = (touch.clientY - dragStart.current.y) / zoom;

      const maxPanX = (scaledDims.width * zoom) / 2;
      const maxPanY = (scaledDims.height * zoom) / 2;

      setPan({
        x: Math.max(-maxPanX, Math.min(maxPanX, newX)),
        y: Math.max(-maxPanY, Math.min(maxPanY, newY))
      });

      if (e.cancelable) e.preventDefault();
    }
  };

  const handleTouchEnd = (e) => {
    if (e.touches.length < 2) {
      pinchStartDist.current = 0;
    }
    setIsDragging(false);
  };

  // Sync fullscreen change events (native and fallback)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFS = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      setIsFullscreen(isFS);
      
      setTimeout(() => {
        if (bookRef.current?.getPageFlip()) {
          bookRef.current.getPageFlip().update();
        }
      }, 300);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
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

    // Helper to toggle state when falling back to fake fullscreen
    const toggleState = () => {
      setIsFullscreen(prev => !prev);
      setTimeout(() => {
        if (bookRef.current?.getPageFlip()) {
          bookRef.current.getPageFlip().update();
        }
      }, 300);
    };

    // Check support for native fullscreen (with vendor prefixes)
    const hasNativeSupport = !!(
      element.requestFullscreen ||
      element.webkitRequestFullscreen ||
      element.mozRequestFullScreen ||
      element.msRequestFullscreen
    );

    if (hasNativeSupport) {
      try {
        if (!document.fullscreenElement && 
            !document.webkitFullscreenElement && 
            !document.mozFullScreenElement && 
            !document.msFullscreenElement) {
          if (element.requestFullscreen) {
            element.requestFullscreen();
          } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
          } else if (element.mozRequestFullScreen) {
            element.mozRequestFullScreen();
          } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
          }
        } else {
          if (document.exitFullscreen) {
            document.exitFullscreen();
          } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
          } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
          } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
          }
        }
      } catch (err) {
        console.warn('Native fullscreen request failed, falling back to fake fullscreen:', err);
        toggleState();
      }
    } else {
      // Fallback: Toggle fake fullscreen manually
      toggleState();
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

  // Calculate scaled dimensions to fit within the container
  const getScaledDimensions = () => {
    const targetWidth = containerDims.width;
    const targetHeight = containerDims.height;

    let bookWidth = aspectRatio.width;
    let bookHeight = aspectRatio.height;

    const pageRatio = bookWidth / bookHeight;

    // Decide orientation (landscape/portrait) based on container size
    const isPortrait = targetWidth < 768 || targetWidth < targetHeight;

    let allowedWidth, allowedHeight;

    if (isPortrait) {
      // In portrait, 1 page width must fit in container
      const maxWidth = targetWidth - 20; // 10px padding on each side
      const maxHeight = targetHeight - 20;

      const widthScale = maxWidth / bookWidth;
      const heightScale = maxHeight / bookHeight;
      const scale = Math.min(widthScale, heightScale, 1);

      allowedWidth = Math.round(bookWidth * scale);
      allowedHeight = Math.round(bookHeight * scale);

      // Force portrait mode in StPageFlip by ensuring page width is more than half of the container width
      if (allowedWidth * 2 <= targetWidth) {
        allowedWidth = Math.round(targetWidth / 2) + 40;
        allowedHeight = Math.round(allowedWidth / pageRatio);
      }
    } else {
      // In landscape, 2 pages width must fit in container
      const maxWidthForTwoPages = targetWidth - 40; // 20px padding on each side
      const maxHeight = targetHeight - 20;

      const maxWidthForOnePage = maxWidthForTwoPages / 2;

      const widthScale = maxWidthForOnePage / bookWidth;
      const heightScale = maxHeight / bookHeight;
      const scale = Math.min(widthScale, heightScale, 1);

      allowedWidth = Math.round(bookWidth * scale);
      allowedHeight = Math.round(bookHeight * scale);
    }

    // Limit to reasonable max dimensions
    const maxSingleWidth = 450;
    const maxSingleHeight = 600;

    const widthScaleLimit = maxSingleWidth / allowedWidth;
    const heightScaleLimit = maxSingleHeight / allowedHeight;
    const limitScale = Math.min(widthScaleLimit, heightScaleLimit, 1);

    let finalWidth = Math.round(allowedWidth * limitScale);
    let finalHeight = Math.round(allowedHeight * limitScale);

    // Again, ensure StPageFlip is forced to portrait if we are in portrait mode
    if (isPortrait && finalWidth * 2 <= targetWidth) {
      finalWidth = Math.round(targetWidth / 2) + 40;
      finalHeight = Math.round(finalWidth / pageRatio);
    }

    finalWidth = Math.max(180, finalWidth);
    finalHeight = Math.max(240, finalHeight);

    console.log('[PDFFlipBook] Sizing:', bookWidth, 'x', bookHeight,
                '-> Container:', targetWidth, 'x', targetHeight,
                '-> Mode:', isPortrait ? 'portrait' : 'landscape',
                '-> Final Page Dims:', finalWidth, 'x', finalHeight);

    return {
      width: finalWidth,
      height: finalHeight
    };
  };

  const scaledDims = getScaledDimensions();

  return (
    <div ref={viewerRef} className={`pdf-viewer-wrapper ${isFullscreen ? 'fullscreen-mode' : ''}`}>
      {/* Floating exit fullscreen close button (for iOS/Safari) */}
      {isFullscreen && (
        <button
          className="fullscreen-close-btn"
          onClick={toggleFullscreen}
          title="Salir de pantalla completa"
        >
          ×
        </button>
      )}
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
      <div ref={mainContentRef} className="pdf-main-content">
        {pages.length > 0 ? (
          <div
            className="pdf-zoom-wrapper"
            style={{
              transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)',
              cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
              width: '100%',
              height: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              touchAction: zoom > 1 ? 'none' : 'pan-y'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div style={{ pointerEvents: zoom > 1 ? 'none' : 'auto' }}>
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
            </div>
          </div>
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
          {/* Zoom controls */}
          <button
            className="control-btn"
            onClick={handleZoomOut}
            disabled={zoom <= 1 || pages.length === 0}
            title="Alejar"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
          </button>

          <button
            className="control-btn"
            onClick={handleZoomIn}
            disabled={zoom >= 3 || pages.length === 0}
            title="Acercar"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
              <line x1="11" y1="8" x2="11" y2="14"></line>
            </svg>
          </button>

          {/* Fullscreen control */}
          <button
            className={`control-btn ${isFullscreen ? 'active' : ''}`}
            onClick={toggleFullscreen}
            title="Pantalla Completa"
            disabled={pages.length === 0}
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
