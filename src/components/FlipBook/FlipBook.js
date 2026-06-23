import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { PageFlip } from 'page-flip';
import './FlipBook.css';

/**
 * Reusable FlipBook Component
 * Wraps Nodlik's page-flip (StPageFlip) library and provides standard React interfaces.
 * Uses callback refs to prevent rendering loops and a DOM override hack to prevent
 * StPageFlip's destroy() from deleting the container element.
 */
const FlipBook = forwardRef(({
  pages = [],
  width = 600,
  height = 800,
  showCover = true,
  onFlip,
  onChangeOrientation,
  onChangeState,
  className = ''
}, ref) => {
  const parentRef = useRef(null);
  const pageFlipRef = useRef(null);

  // Store callbacks in a ref to decouple them from the main initialization effect
  const callbacksRef = useRef({ onFlip, onChangeOrientation, onChangeState });

  // Update the callbacks ref on every render
  useEffect(() => {
    callbacksRef.current = { onFlip, onChangeOrientation, onChangeState };
  });

  // Expose PageFlip API to the parent component safely with try-catch checks
  useImperativeHandle(ref, () => ({
    flipNext: () => {
      if (pageFlipRef.current) {
        try {
          pageFlipRef.current.flipNext();
        } catch (err) {
          console.warn('Unable to flipNext:', err);
        }
      }
    },
    flipPrev: () => {
      if (pageFlipRef.current) {
        try {
          pageFlipRef.current.flipPrev();
        } catch (err) {
          console.warn('Unable to flipPrev:', err);
        }
      }
    },
    turnToPage: (pageIndex) => {
      if (pageFlipRef.current) {
        try {
          pageFlipRef.current.turnToPage(pageIndex);
        } catch (err) {
          console.warn('Unable to turnToPage:', err);
        }
      }
    },
    getPageFlip: () => pageFlipRef.current
  }));

  // Handle PageFlip instance creation (runs only when pages or dimensions change)
  useEffect(() => {
    console.log('[FlipBook] useEffect de inicialización invocado. Cantidad de páginas:', pages?.length, 'Dimensiones del visor:', width, 'x', height);

    // Guardamos la referencia actual del contenedor padre en una variable local para el cleanup
    const currentParent = parentRef.current;

    if (!currentParent || !pages || pages.length === 0) {
      console.log('[FlipBook] Cancelando inicialización: contenedor padre no disponible o sin páginas');
      return;
    }

    // 1. Create a fresh container div
    const bookContainer = document.createElement('div');
    bookContainer.className = 'flipbook-container';
    currentParent.appendChild(bookContainer);
    console.log('[FlipBook] Nuevo contenedor de flipbook creado y agregado al DOM');

    // 2. Create and append page elements programmatically so React does not manage them
    console.log('[FlipBook] Creando y agregando elementos de página al DOM');
    const pageElements = pages.map((pageContent, index) => {
      const pageEl = document.createElement('div');
      pageEl.className = 'page-sheet';
      const isCover = showCover && (index === 0 || index === pages.length - 1);
      pageEl.setAttribute('data-density', isCover ? 'hard' : 'soft');

      const contentEl = document.createElement('div');
      contentEl.className = 'page-sheet-content';

      if (typeof pageContent === 'string') {
        const imgEl = document.createElement('img');
        imgEl.src = pageContent;
        imgEl.alt = `Página ${index + 1}`;
        imgEl.className = 'pdf-page-image';
        imgEl.draggable = false;
        contentEl.appendChild(imgEl);
      } else {
        contentEl.textContent = 'Invalid content';
      }

      pageEl.appendChild(contentEl);
      bookContainer.appendChild(pageEl);
      return pageEl;
    });

    console.log('[FlipBook] Inicializando nueva instancia de PageFlip');
    // 3. Initialize PageFlip
    const flipBook = new PageFlip(bookContainer, {
      width: width,
      height: height,
      size: 'fixed',
      minWidth: 280,
      maxWidth: 1200,
      minHeight: 380,
      maxHeight: 1600,
      drawShadow: true,
      showCover: showCover,
      usePortrait: true,
      maxShadowOpacity: 0.2,
      flippingTime: 700,
      swipeDistance: 25,
      clickEventForward: true, // forward click events to children
      useMouseEvents: true
    });

    pageFlipRef.current = flipBook;

    try {
      console.log('[FlipBook] Cargando páginas desde el DOM (loadFromHTML)');
      flipBook.loadFromHTML(pageElements);
      console.log('[FlipBook] Páginas cargadas correctamente en PageFlip');
    } catch (err) {
      console.error('[FlipBook] Error al cargar páginas en page-flip:', err);
    }

    // Event Bindings - Delegate calls to latest reference in callbacksRef
    flipBook.on('flip', (e) => {
      if (callbacksRef.current.onFlip) {
        callbacksRef.current.onFlip(e.data);
      }
    });
    flipBook.on('changeOrientation', (e) => {
      if (callbacksRef.current.onChangeOrientation) {
        callbacksRef.current.onChangeOrientation(e.data);
      }
    });
    flipBook.on('changeState', (e) => {
      if (callbacksRef.current.onChangeState) {
        callbacksRef.current.onChangeState(e.data);
      }
    });

    // Size calculation trigger
    const timer = setTimeout(() => {
      if (pageFlipRef.current) {
        try {
          pageFlipRef.current.update();
        } catch (e) {
          // Ignore layout warnings
        }
      }
    }, 150);

    // Cleanup: destroy the instance and remove the child container
    return () => {
      clearTimeout(timer);
      console.log('[FlipBook] Limpiando e invalidando instancia de PageFlip');
      if (flipBook) {
        try {
          flipBook.destroy();
        } catch (err) {
          console.warn('[FlipBook] Error al destruir PageFlip en el cleanup:', err);
        }
      }
      if (currentParent && currentParent.contains(bookContainer)) {
        currentParent.removeChild(bookContainer);
        console.log('[FlipBook] Contenedor de flipbook eliminado del DOM');
      }
      pageFlipRef.current = null;
    };
  }, [pages, width, height, showCover]); // Re-run only when content or sizing changes

  return (
    <div ref={parentRef} className={`flipbook-outer-wrapper ${className}`} />
  );
});

FlipBook.displayName = 'FlipBook';

export default FlipBook;