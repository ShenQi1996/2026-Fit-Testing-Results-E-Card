import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';

const SignaturePad = forwardRef(({ onStroke, onClear, disabled }, ref) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
  }));

  // Resize canvas to match container size
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      // Set display size
      canvas.style.width = rect.width + 'px';
      canvas.style.height = '200px';
      
      // Set actual size in memory (scaled for device pixel ratio)
      canvas.width = rect.width * dpr;
      canvas.height = 200 * dpr;
      
      // Scale drawing context to account for device pixel ratio
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      
      // Set drawing properties
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };

    resizeCanvas();
    
    // Handle window resize
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
      // Handle touchEnd events
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    // Calculate coordinates relative to the canvas display size
    // Since the context is already scaled by dpr, we use display coordinates directly
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDrawing(true);
    const coords = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
    }
  };

  const draw = (e) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    e.stopPropagation();
    const coords = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
      
      if (!hasStrokes) {
        setHasStrokes(true);
        if (onStroke) onStroke(true);
      }
    }
  };

  const stopDrawing = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasStrokes(false);
      if (onClear) onClear();
    }
  };

  // Add touch event listeners with passive: false
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Touch event handlers with passive: false to allow preventDefault
    const handleTouchStart = (e) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      startDrawing(e);
    };

    const handleTouchMove = (e) => {
      if (!isDrawing || disabled) return;
      e.preventDefault();
      e.stopPropagation();
      draw(e);
    };

    const handleTouchEnd = (e) => {
      e.preventDefault();
      e.stopPropagation();
      stopDrawing(e);
    };

    const handleTouchCancel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      stopDrawing(e);
    };

    // Add touch listeners with passive: false
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchCancel, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [disabled, isDrawing]);

  return (
    <div className="signature-pad-container" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="signature-canvas"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
      />
      <button
        type="button"
        onClick={handleClear}
        className="signature-clear-button"
        disabled={disabled || !hasStrokes}
      >
        Clear
      </button>
    </div>
  );
});

SignaturePad.displayName = 'SignaturePad';

export default SignaturePad;