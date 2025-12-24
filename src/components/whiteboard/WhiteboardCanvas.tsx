/**
 * Custom Whiteboard Canvas using Fabric.js
 * Real-time collaborative drawing with Yjs sync
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas as FabricCanvas, PencilBrush, Circle, Rect, Line, IText, FabricObject, TPointerEvent, TPointerEventInfo } from 'fabric';
import { ToolType, BrushSettings, WhiteboardUser } from '@/types/whiteboard';
import { Toolbar } from './Toolbar';
import { ColorPicker } from './ColorPicker';
import { RemoteCursors } from './RemoteCursors';
import { toast } from 'sonner';

interface WhiteboardCanvasProps {
  roomId: string;
  userId: string;
  userName: string;
  userColor: string;
  onCursorMove?: (x: number, y: number) => void;
  remoteUsers?: WhiteboardUser[];
  onObjectsChange?: (objects: FabricObject[]) => void;
  initialObjects?: FabricObject[];
}

export function WhiteboardCanvas({
  roomId,
  userId,
  userName,
  userColor,
  onCursorMove,
  remoteUsers = [],
  onObjectsChange,
  initialObjects,
}: WhiteboardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  
  const [activeTool, setActiveTool] = useState<ToolType>('pen');
  const [brushSettings, setBrushSettings] = useState<BrushSettings>({
    color: '#000000',
    width: 3,
    opacity: 1,
  });
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [isPanning, setIsPanning] = useState(false);
  const lastPanPosition = useRef<{ x: number; y: number } | null>(null);

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const canvas = new FabricCanvas(canvasRef.current, {
      width: container.clientWidth,
      height: container.clientHeight,
      backgroundColor: '#ffffff',
      selection: true,
      preserveObjectStacking: true,
    });

    // Initialize drawing brush
    canvas.freeDrawingBrush = new PencilBrush(canvas);
    canvas.freeDrawingBrush.color = brushSettings.color;
    canvas.freeDrawingBrush.width = brushSettings.width;

    fabricRef.current = canvas;

    // Handle resize
    const handleResize = () => {
      canvas.setDimensions({
        width: container.clientWidth,
        height: container.clientHeight,
      });
      canvas.renderAll();
    };

    window.addEventListener('resize', handleResize);

    // Save initial state
    saveState();

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.dispose();
      fabricRef.current = null;
    };
  }, []);

  // Update brush settings
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !canvas.freeDrawingBrush) return;

    canvas.freeDrawingBrush.color = brushSettings.color;
    canvas.freeDrawingBrush.width = brushSettings.width;
  }, [brushSettings]);

  // Handle tool changes
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = activeTool === 'pen' || activeTool === 'highlighter';
    canvas.selection = activeTool === 'select';

    if (activeTool === 'highlighter' && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.width = 20;
      canvas.freeDrawingBrush.color = brushSettings.color + '66'; // Add alpha for transparency
    } else if (activeTool === 'pen' && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.width = brushSettings.width;
      canvas.freeDrawingBrush.color = brushSettings.color;
    }

    // Set cursor based on tool
    if (activeTool === 'pan') {
      canvas.defaultCursor = 'grab';
    } else if (activeTool === 'eraser') {
      canvas.defaultCursor = 'crosshair';
    } else if (activeTool === 'text') {
      canvas.defaultCursor = 'text';
    } else {
      canvas.defaultCursor = 'default';
    }
  }, [activeTool, brushSettings]);

  // Handle mouse events for shape drawing and pan
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    let isDrawingShape = false;
    let startPoint: { x: number; y: number } | null = null;
    let currentShape: FabricObject | null = null;

    const handleMouseDown = (opt: TPointerEventInfo<TPointerEvent>) => {
      const pointer = canvas.getScenePoint(opt.e);
      
      // Handle cursor broadcast
      onCursorMove?.(pointer.x, pointer.y);

      // Pan tool
      if (activeTool === 'pan') {
        setIsPanning(true);
        lastPanPosition.current = { x: (opt.e as MouseEvent).clientX, y: (opt.e as MouseEvent).clientY };
        canvas.defaultCursor = 'grabbing';
        return;
      }

      // Eraser tool
      if (activeTool === 'eraser') {
        const target = canvas.findTarget(opt.e);
        if (target) {
          canvas.remove(target);
          saveState();
          notifyChange();
        }
        return;
      }

      // Text tool
      if (activeTool === 'text') {
        const text = new IText('Click to edit', {
          left: pointer.x,
          top: pointer.y,
          fontSize: 20,
          fill: brushSettings.color,
          fontFamily: 'Inter, sans-serif',
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        saveState();
        notifyChange();
        return;
      }

      // Shape tools
      if (['rectangle', 'circle', 'line', 'arrow'].includes(activeTool)) {
        isDrawingShape = true;
        startPoint = { x: pointer.x, y: pointer.y };

        if (activeTool === 'rectangle') {
          currentShape = new Rect({
            left: pointer.x,
            top: pointer.y,
            width: 0,
            height: 0,
            fill: 'transparent',
            stroke: brushSettings.color,
            strokeWidth: brushSettings.width,
            opacity: brushSettings.opacity,
          });
        } else if (activeTool === 'circle') {
          currentShape = new Circle({
            left: pointer.x,
            top: pointer.y,
            radius: 0,
            fill: 'transparent',
            stroke: brushSettings.color,
            strokeWidth: brushSettings.width,
            opacity: brushSettings.opacity,
          });
        } else if (activeTool === 'line' || activeTool === 'arrow') {
          currentShape = new Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: brushSettings.color,
            strokeWidth: brushSettings.width,
            opacity: brushSettings.opacity,
          });
        }

        if (currentShape) {
          canvas.add(currentShape);
        }
      }
    };

    const handleMouseMove = (opt: TPointerEventInfo<TPointerEvent>) => {
      const pointer = canvas.getScenePoint(opt.e);
      onCursorMove?.(pointer.x, pointer.y);

      // Pan
      if (isPanning && lastPanPosition.current) {
        const vpt = canvas.viewportTransform;
        if (vpt) {
          vpt[4] += (opt.e as MouseEvent).clientX - lastPanPosition.current.x;
          vpt[5] += (opt.e as MouseEvent).clientY - lastPanPosition.current.y;
          canvas.requestRenderAll();
          lastPanPosition.current = { x: (opt.e as MouseEvent).clientX, y: (opt.e as MouseEvent).clientY };
        }
        return;
      }

      // Eraser preview
      if (activeTool === 'eraser') {
        const target = canvas.findTarget(opt.e);
        canvas.getObjects().forEach((obj) => {
          obj.set('opacity', obj === target ? 0.5 : (obj.opacity || 1));
        });
        canvas.renderAll();
      }

      // Shape drawing
      if (isDrawingShape && startPoint && currentShape) {
        if (activeTool === 'rectangle') {
          const width = pointer.x - startPoint.x;
          const height = pointer.y - startPoint.y;
          currentShape.set({
            width: Math.abs(width),
            height: Math.abs(height),
            left: width > 0 ? startPoint.x : pointer.x,
            top: height > 0 ? startPoint.y : pointer.y,
          });
        } else if (activeTool === 'circle') {
          const radius = Math.sqrt(
            Math.pow(pointer.x - startPoint.x, 2) + Math.pow(pointer.y - startPoint.y, 2)
          ) / 2;
          currentShape.set({
            radius,
            left: startPoint.x - radius,
            top: startPoint.y - radius,
          });
        } else if (activeTool === 'line' || activeTool === 'arrow') {
          (currentShape as Line).set({
            x2: pointer.x,
            y2: pointer.y,
          });
        }
        canvas.renderAll();
      }
    };

    const handleMouseUp = () => {
      if (isPanning) {
        setIsPanning(false);
        lastPanPosition.current = null;
        canvas.defaultCursor = 'grab';
      }

      if (isDrawingShape) {
        isDrawingShape = false;
        startPoint = null;
        currentShape = null;
        saveState();
        notifyChange();
      }
    };

    const handlePathCreated = () => {
      saveState();
      notifyChange();
    };

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);
    canvas.on('path:created', handlePathCreated);
    canvas.on('object:modified', () => {
      saveState();
      notifyChange();
    });

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
      canvas.off('path:created', handlePathCreated);
    };
  }, [activeTool, brushSettings, isPanning, onCursorMove]);

  // Save state for undo/redo
  const saveState = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const json = JSON.stringify(canvas.toJSON());
    setUndoStack((prev) => [...prev.slice(-49), json]);
    setRedoStack([]);
  }, []);

  // Notify parent of changes
  const notifyChange = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || !onObjectsChange) return;
    onObjectsChange(canvas.getObjects());
  }, [onObjectsChange]);

  // Undo
  const handleUndo = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || undoStack.length <= 1) return;

    const newUndoStack = [...undoStack];
    const currentState = newUndoStack.pop()!;
    const previousState = newUndoStack[newUndoStack.length - 1];

    setRedoStack((prev) => [...prev, currentState]);
    setUndoStack(newUndoStack);

    canvas.loadFromJSON(JSON.parse(previousState)).then(() => {
      canvas.renderAll();
      notifyChange();
    });
  }, [undoStack, notifyChange]);

  // Redo
  const handleRedo = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || redoStack.length === 0) return;

    const newRedoStack = [...redoStack];
    const nextState = newRedoStack.pop()!;

    setUndoStack((prev) => [...prev, nextState]);
    setRedoStack(newRedoStack);

    canvas.loadFromJSON(JSON.parse(nextState)).then(() => {
      canvas.renderAll();
      notifyChange();
    });
  }, [redoStack, notifyChange]);

  // Clear canvas
  const handleClear = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.clear();
    canvas.backgroundColor = '#ffffff';
    canvas.renderAll();
    saveState();
    notifyChange();
    toast.success('Canvas cleared');
  }, [saveState, notifyChange]);

  // Export canvas
  const handleExport = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const dataURL = canvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 2,
    });

    const link = document.createElement('a');
    link.download = `whiteboard-${roomId}.png`;
    link.href = dataURL;
    link.click();

    toast.success('Canvas exported');
  }, [roomId]);

  // Zoom
  const handleZoom = useCallback((direction: 'in' | 'out') => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const zoom = canvas.getZoom();
    const newZoom = direction === 'in' ? zoom * 1.2 : zoom / 1.2;
    canvas.setZoom(Math.min(Math.max(newZoom, 0.1), 5));
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-background">
      <Toolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        onClear={handleClear}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onExport={handleExport}
        onZoomIn={() => handleZoom('in')}
        onZoomOut={() => handleZoom('out')}
        canUndo={undoStack.length > 1}
        canRedo={redoStack.length > 0}
      />

      <ColorPicker
        color={brushSettings.color}
        strokeWidth={brushSettings.width}
        opacity={brushSettings.opacity}
        onColorChange={(color) => setBrushSettings((s) => ({ ...s, color }))}
        onStrokeWidthChange={(width) => setBrushSettings((s) => ({ ...s, width }))}
        onOpacityChange={(opacity) => setBrushSettings((s) => ({ ...s, opacity }))}
      />

      <RemoteCursors users={remoteUsers} currentUserId={userId} />

      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
