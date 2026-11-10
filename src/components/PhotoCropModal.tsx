import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, RotateCcw, Check, Sparkles, Move, RefreshCw } from 'lucide-react';

interface PhotoCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onApplyCrop?: (croppedBase64: string) => void;
  onCropComplete?: (croppedBase64: string) => void;
  title?: string;
}

export const PhotoCropModal: React.FC<PhotoCropModalProps> = ({
  isOpen,
  imageSrc,
  onClose,
  onApplyCrop,
  onCropComplete,
  title = 'Adjust Profile Picture'
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [imgNaturalSize, setImgNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const imageRef = useRef<HTMLImageElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Reset state when new image opens
  useEffect(() => {
    if (isOpen && imageSrc) {
      setZoom(1);
      setRotation(0);
      setOffset({ x: 0, y: 0 });
      setImageLoaded(false);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setImgNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
        setImageLoaded(true);
      };
      img.src = imageSrc;
      imageRef.current = img;
    }
  }, [isOpen, imageSrc]);

  // Handle Drag / Pan start
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch support for mobile devices
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - offset.x,
        y: e.touches[0].clientY - offset.y
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setOffset({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleZoomChange = (delta: number) => {
    setZoom((prev) => Math.min(3, Math.max(1, Math.round((prev + delta) * 10) / 10)));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  };

  // Generate cropped output canvas (400x400 square with focused circular framing)
  const handleSaveCrop = () => {
    if (!imageRef.current || !imageLoaded) return;

    const canvas = document.createElement('canvas');
    const size = 400; // Crisp export size
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Viewport dimensions (260px viewing circle)
    const viewportSize = 260;
    const scaleFactor = size / viewportSize;

    ctx.fillStyle = '#001F3F';
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    // Center of canvas
    ctx.translate(size / 2, size / 2);

    // Apply rotation
    ctx.rotate((rotation * Math.PI) / 180);

    // Calculate image draw dimensions preserving aspect ratio
    const img = imageRef.current;
    const imgAspect = img.naturalWidth / img.naturalHeight;
    let drawWidth = viewportSize;
    let drawHeight = viewportSize;

    if (imgAspect > 1) {
      // Landscape
      drawWidth = viewportSize * imgAspect;
      drawHeight = viewportSize;
    } else {
      // Portrait
      drawWidth = viewportSize;
      drawHeight = viewportSize / imgAspect;
    }

    // Apply zoom and user pan offsets scaled to output resolution
    const scaledWidth = drawWidth * zoom * scaleFactor;
    const scaledHeight = drawHeight * zoom * scaleFactor;
    const scaledOffsetX = offset.x * scaleFactor;
    const scaledOffsetY = offset.y * scaleFactor;

    ctx.drawImage(
      img,
      -scaledWidth / 2 + scaledOffsetX,
      -scaledHeight / 2 + scaledOffsetY,
      scaledWidth,
      scaledHeight
    );

    ctx.restore();

    const croppedBase64 = canvas.toDataURL('image/jpeg', 0.92);
    const cb = onApplyCrop || onCropComplete;
    if (cb) {
      cb(croppedBase64);
    }
    onClose();
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <div
      id="photo-crop-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        id="photo-crop-card"
        className="w-full max-w-sm bg-[#0B192C] border border-[#0a2e5c] rounded-3xl shadow-2xl overflow-hidden flex flex-col text-white"
      >
        {/* Header */}
        <div className="bg-[#001F3F] p-4 flex items-center justify-between border-b border-[#FFA500]/30">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#FFA500]" />
            <h3 className="font-bold text-sm text-white">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-black/30 hover:bg-black/50 text-amber-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewport & Interactive Crop Frame */}
        <div className="p-4 flex flex-col items-center space-y-3">
          <p className="text-[11px] text-slate-300 text-center flex items-center gap-1.5">
            <Move className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Drag photo to reposition inside the golden circle</span>
          </p>

          <div
            ref={viewportRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="relative w-[260px] h-[260px] bg-[#001428] rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing border border-[#0a2e5c] select-none touch-none shadow-inner"
          >
            {/* Image Canvas / Element */}
            {imageLoaded && imageSrc && (
              <div
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${zoom})`,
                  transformOrigin: 'center center',
                  transition: isDragging ? 'none' : 'transform 0.08s ease-out'
                }}
                className="w-full h-full flex items-center justify-center pointer-events-none"
              >
                <img
                  src={imageSrc}
                  alt="Crop Target"
                  draggable={false}
                  className="max-w-none w-full h-full object-cover"
                />
              </div>
            )}

            {/* Circular Viewfinder Mask Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {/* Outer dimmed mask */}
              <div
                className="w-[220px] h-[220px] rounded-full border-2 border-[#FFA500] shadow-[0_0_0_9999px_rgba(0,15,35,0.65)]"
                style={{
                  boxShadow: '0 0 0 9999px rgba(0, 15, 35, 0.65), 0 0 15px rgba(255, 165, 0, 0.5)'
                }}
              />
              {/* Crosshair guide */}
              <div className="absolute w-[220px] h-[220px] rounded-full border border-white/20 pointer-events-none" />
            </div>

            {/* Live Indicator */}
            <span className="absolute bottom-2 left-2 text-[9px] font-mono px-2 py-0.5 rounded bg-black/60 text-amber-300">
              {Math.round(zoom * 100)}% • {rotation}°
            </span>
          </div>

          {/* Controls: Zoom Slider & Actions */}
          <div className="w-full space-y-2.5 pt-1">
            {/* Zoom Slider */}
            <div className="flex items-center gap-2 px-1">
              <button
                type="button"
                onClick={() => handleZoomChange(-0.1)}
                className="p-1 rounded-lg bg-[#002b54] hover:bg-[#003d7a] text-amber-300 cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1 accent-[#FFA500] cursor-pointer"
              />
              <button
                type="button"
                onClick={() => handleZoomChange(0.1)}
                className="p-1 rounded-lg bg-[#002b54] hover:bg-[#003d7a] text-amber-300 cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Rotation & Reset Buttons */}
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleRotate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#002b54] hover:bg-[#003d7a] text-amber-300 text-xs font-semibold border border-[#0a2e5c] cursor-pointer transition-all active:scale-95"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Rotate 90°</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#002b54] hover:bg-[#003d7a] text-slate-300 text-xs font-semibold border border-[#0a2e5c] cursor-pointer transition-all active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset View</span>
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-[#001428] border-t border-[#0a2e5c] flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-3 rounded-xl bg-[#002b54] hover:bg-[#003d7a] text-slate-200 text-xs font-semibold border border-[#0a2e5c] cursor-pointer transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveCrop}
            className="flex-1 py-2.5 px-3 rounded-xl bg-[#FFA500] hover:bg-[#FF8C00] active:bg-[#e07b00] text-[#001F3F] text-xs font-black shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Apply Photo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
