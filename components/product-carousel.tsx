import React, { useState, useEffect, useRef, useCallback } from 'react';

type ProductCarouselProps = {
  products: Array<{
    name: string;
    category: string;
    color?: string;
    price: number;
    imageUrl?: string;
  }>;
  highlighted: string[]; // IDs de productos destacados
};

const ProductCarousel: React.FC<ProductCarouselProps> = ({ products, highlighted }) => {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragVelocity, setDragVelocity] = useState(0);
  const [lastDragTime, setLastDragTime] = useState(0);
  const [lastDragX, setLastDragX] = useState(0);
  const [selectedProductIndex, setSelectedProductIndex] = useState<number | null>(null);
  
  // Usar useRef para momentum para evitar bucles infinitos
  const momentumRef = useRef(0);
  const animationRef = useRef<number | null>(null);

  // Detiene la rotación automática cuando hay productos destacados
  useEffect(() => {
    if (highlighted.length > 0) {
      setAutoRotate(false);
    } else {
      setAutoRotate(true);
    }
  }, [highlighted]);

  // Rotación automática con momentum - arreglado
  useEffect(() => {
    const rotate = () => {
      if (autoRotate && !isDragging && Math.abs(momentumRef.current) < 0.1) {
        setRotation(prev => (prev + 0.2) % 360);
      } else if (Math.abs(momentumRef.current) > 0.1) {
        // Aplicar momentum/inercia
        setRotation(prev => (prev + momentumRef.current) % 360);
        momentumRef.current = momentumRef.current * 0.95; // Reducir momentum gradualmente
      }
      animationRef.current = requestAnimationFrame(rotate);
    };
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    animationRef.current = requestAnimationFrame(rotate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [autoRotate, isDragging]);

  // Calcular velocidad de arrastre para inercia
  const calculateVelocity = useCallback((currentX: number) => {
    const currentTime = Date.now();
    const deltaTime = currentTime - lastDragTime;
    const deltaX = currentX - lastDragX;
    
    if (deltaTime > 0) {
      const velocity = (deltaX / deltaTime) * 16; // Normalizar para 60fps
      setDragVelocity(velocity);
    }
    
    setLastDragTime(currentTime);
    setLastDragX(currentX);
  }, [lastDragTime, lastDragX]);

  // Gestionar el arrastre con mouse - mejorado
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setAutoRotate(false);
    momentumRef.current = 0;
    setLastDragX(e.clientX);
    setLastDragTime(Date.now());
    setDragVelocity(0);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const delta = e.clientX - lastDragX;
      setRotation(prev => (prev + delta * 0.3) % 360);
      calculateVelocity(e.clientX);
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      momentumRef.current = dragVelocity * 0.5; // Aplicar inercia
      
      // Reanudar rotación automática después de un tiempo si no hay highlight
      setTimeout(() => {
        if (highlighted.length === 0) {
          setAutoRotate(true);
        }
      }, 2000);
    }
  };

  // Soporte para pantallas táctiles - mejorado
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setAutoRotate(false);
    momentumRef.current = 0;
    const touch = e.touches[0];
    setLastDragX(touch.clientX);
    setLastDragTime(Date.now());
    setDragVelocity(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging) {
      e.preventDefault();
      const touch = e.touches[0];
      const delta = touch.clientX - lastDragX;
      setRotation(prev => (prev + delta * 0.3) % 360);
      calculateVelocity(touch.clientX);
    }
  };

  const handleTouchEnd = () => {
    if (isDragging) {
      setIsDragging(false);
      momentumRef.current = dragVelocity * 0.5;
      
      setTimeout(() => {
        if (highlighted.length === 0) {
          setAutoRotate(true);
        }
      }, 2000);
    }
  };

  // Navegación por clic en producto
  const handleProductClick = (index: number) => {
    const angleIncrement = 360 / products.length;
    const targetRotation = -angleIncrement * index;
    setRotation(targetRotation);
    setSelectedProductIndex(index);
    setAutoRotate(false);
    momentumRef.current = 0;
    
    // Efecto visual de selección
    setTimeout(() => setSelectedProductIndex(null), 1000);
  };

  // Navegación con teclado
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setRotation(prev => prev - 40);
      setAutoRotate(false);
      momentumRef.current = 0;
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setRotation(prev => prev + 40);
      setAutoRotate(false);
      momentumRef.current = 0;
    } else if (e.key === ' ') {
      e.preventDefault();
      setAutoRotate(prev => !prev);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Calcular ángulo para cada producto
  const getProductStyles = (index: number) => {
    const angleIncrement = 360 / products.length;
    const angle = (rotation + index * angleIncrement) % 360;
    const radians = (angle * Math.PI) / 180;
    const radius = 250;
    
    const x = radius * Math.sin(radians);
    const z = radius * Math.cos(radians);
    
    // Calcular escala para efecto de profundidad
    const scale = 0.6 + (Math.cos(radians) + 1) / 4;
    
    // Calcular opacidad para productos no destacados
    const isHighlighted = highlighted.includes(String(index)) || highlighted.length === 0;
    const isSelected = selectedProductIndex === index;
    const opacity = isHighlighted ? 1 : 0.3;
    
    // Calcular z-index para controlar qué productos están visualmente por encima
    const zIndex = Math.floor(100 - (Math.cos(radians) * 100));
    
    return {
      transform: `translateX(${x}px) translateZ(${z}px) rotateY(${-angle}deg) scale(${scale})`,
      opacity,
      zIndex,
      filter: isHighlighted ? 'none' : 'grayscale(50%)',
      transition: isDragging ? 'none' : 'all 0.3s ease-out',
      boxShadow: isSelected 
        ? '0 0 40px rgba(34, 197, 94, 0.8)' 
        : highlighted.includes(String(index)) 
          ? '0 0 30px rgba(77, 124, 254, 0.8)' 
          : '0 4px 15px rgba(0,0,0,0.4)'
    };
  };

  // Enfocar productos destacados
  useEffect(() => {
    if (highlighted.length > 0 && products.length > 0) {
      const highlightedIndex = parseInt(highlighted[0]);
      if (!isNaN(highlightedIndex) && highlightedIndex < products.length) {
        const angleIncrement = 360 / products.length;
        const targetRotation = -angleIncrement * highlightedIndex;
        setRotation(targetRotation);
        momentumRef.current = 0;
      }
    }
  }, [highlighted, products]);

  return (
    <div className="relative w-full h-[600px] flex items-center justify-center overflow-hidden bg-gradient-to-b from-[var(--bg-secondary)] to-[var(--bg-primary)] rounded-xl shadow-inner border border-[var(--border-color)]">
      <div 
        className="carousel-container perspective-1000"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          transformStyle: 'preserve-3d',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none'
        }}
        ref={carouselRef}
        tabIndex={0}
      >
        {products.map((product, index) => (
          <div
            key={index}
            className={`absolute product-card ${highlighted.includes(String(index)) ? 'highlight-pulse' : ''} ${selectedProductIndex === index ? 'selected-glow' : ''}`}
            style={{
              ...getProductStyles(index),
              width: '220px',
              height: '300px',
              transformOrigin: 'center center',
              position: 'absolute',
              top: '50%',
              left: '50%',
              marginLeft: '-110px',
              marginTop: '-150px',
              backfaceVisibility: 'hidden'
            }}
            onClick={() => handleProductClick(index)}
          >
            <div className="w-full h-full bg-[var(--card-bg)] rounded-lg overflow-hidden flex flex-col shadow-lg border border-[var(--border-color)] hover:border-[var(--accent-primary)] transition-all duration-300">
              <div 
                className="h-[180px] bg-gray-900 flex items-center justify-center overflow-hidden relative group"
                style={{ backgroundColor: product.color || 'var(--bg-tertiary)' }}
              >
                {product.imageUrl ? (
                  <img 
                    src={product.imageUrl} 
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement!.innerHTML += `<div class="flex items-center justify-center h-full">
                        <span class="text-3xl font-bold text-[var(--text-secondary)]">${product.category.charAt(0).toUpperCase()}</span>
                      </div>`;
                    }}
                  />
                ) : (
                  <span className="text-3xl font-bold text-[var(--text-secondary)]">
                    {product.category.charAt(0).toUpperCase()}
                  </span>
                )}
                {/* Overlay de interacción */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity duration-300 flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white bg-opacity-90 rounded-full p-2">
                    <svg className="w-6 h-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="p-4 flex-grow flex flex-col justify-between">
                <h3 className="font-medium text-base truncate text-[var(--text-primary)]">{product.name}</h3>
                <div className="mt-2">
                  <p className="text-green-400 font-bold text-lg">${product.price.toFixed(2)}</p>
                  <div className="flex items-center mt-2">
                    {product.color && (
                      <span className="px-3 py-1 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-full text-sm">
                        {product.color}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Título del carrusel */}
      <div className="absolute top-4 left-0 right-0 text-center">
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Product Catalog</h2>
        <p className="text-[var(--text-secondary)] mt-1">
          {highlighted.length > 0 
            ? `${highlighted.length} highlighted products` 
            : 'Drag, click products, or use arrow keys to explore'}
        </p>
      </div>
      
      {/* Controles adicionales mejorados */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4">
        <button 
          className="p-3 bg-[var(--bg-secondary)] rounded-full shadow-md hover:bg-[var(--bg-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] text-[var(--text-primary)] border border-[var(--border-color)] transition-all duration-200 hover:scale-110"
          onClick={() => {
            setRotation(prev => prev - 40);
            setAutoRotate(false);
            momentumRef.current = 0;
          }}
          aria-label="Rotate left"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        
        <button 
          className={`p-3 rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] text-[var(--text-primary)] border border-[var(--border-color)] transition-all duration-200 hover:scale-110 ${
            autoRotate 
              ? 'bg-[var(--accent-primary)] text-white' 
              : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]'
          }`}
          onClick={() => setAutoRotate(!autoRotate)}
          aria-label="Toggle auto rotation"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
        </button>
        
        <button 
          className="p-3 bg-[var(--bg-secondary)] rounded-full shadow-md hover:bg-[var(--bg-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] text-[var(--text-primary)] border border-[var(--border-color)] transition-all duration-200 hover:scale-110"
          onClick={() => {
            setRotation(prev => prev + 40);
            setAutoRotate(false);
            momentumRef.current = 0;
          }}
          aria-label="Rotate right"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>

      {/* Indicador de interacción */}
      <div className="absolute bottom-2 left-0 right-0 text-center">
        <p className="text-xs text-[var(--text-muted)]">
          {isDragging ? '🖱️ Dragging...' : Math.abs(momentumRef.current) > 0.5 ? '💨 Momentum active' : '⌨️ Use ← → keys or drag to navigate'}
        </p>
      </div>
      
      {/* Estilos globales mejorados */}
      <style jsx global>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        
        .product-card {
          transition: transform 0.3s ease, opacity 0.3s ease, filter 0.3s ease, box-shadow 0.3s ease;
          cursor: pointer;
        }
        
        .product-card:hover {
          transform: scale(1.05) translateZ(50px) !important;
          z-index: 1000 !important;
        }
        
        .selected-glow {
          animation: selectedPulse 0.6s ease-out;
        }
        
        @keyframes selectedPulse {
          0% { 
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
            transform: scale(1);
          }
          50% { 
            box-shadow: 0 0 0 20px rgba(34, 197, 94, 0);
            transform: scale(1.1);
          }
          100% { 
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
            transform: scale(1);
          }
        }
        
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(77, 124, 254, 0.7); }
          70% { box-shadow: 0 0 0 20px rgba(77, 124, 254, 0); }
          100% { box-shadow: 0 0 0 0 rgba(77, 124, 254, 0); }
        }
        
        .highlight-pulse {
          animation: pulse 2s infinite;
        }
      `}</style>
    </div>
  );
};

export default ProductCarousel; 