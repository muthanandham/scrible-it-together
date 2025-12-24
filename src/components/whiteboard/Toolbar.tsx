import { ToolType } from '@/types/whiteboard';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  MousePointer2,
  Pencil,
  Highlighter,
  Eraser,
  Square,
  Circle,
  Minus,
  ArrowRight,
  Type,
  Hand,
  Trash2,
  Undo2,
  Redo2,
  Download,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolbarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const tools: { id: ToolType; icon: React.ReactNode; label: string }[] = [
  { id: 'select', icon: <MousePointer2 className="h-4 w-4" />, label: 'Select' },
  { id: 'pen', icon: <Pencil className="h-4 w-4" />, label: 'Pen' },
  { id: 'highlighter', icon: <Highlighter className="h-4 w-4" />, label: 'Highlighter' },
  { id: 'eraser', icon: <Eraser className="h-4 w-4" />, label: 'Eraser' },
  { id: 'rectangle', icon: <Square className="h-4 w-4" />, label: 'Rectangle' },
  { id: 'circle', icon: <Circle className="h-4 w-4" />, label: 'Circle' },
  { id: 'line', icon: <Minus className="h-4 w-4" />, label: 'Line' },
  { id: 'arrow', icon: <ArrowRight className="h-4 w-4" />, label: 'Arrow' },
  { id: 'text', icon: <Type className="h-4 w-4" />, label: 'Text' },
  { id: 'pan', icon: <Hand className="h-4 w-4" />, label: 'Pan' },
];

export function Toolbar({
  activeTool,
  onToolChange,
  onClear,
  onUndo,
  onRedo,
  onExport,
  onZoomIn,
  onZoomOut,
  canUndo,
  canRedo,
}: ToolbarProps) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 p-2 bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-lg">
      {/* Drawing Tools */}
      <div className="flex items-center gap-1 pr-2 border-r border-border">
        {tools.map((tool) => (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <Button
                variant={activeTool === tool.id ? 'default' : 'ghost'}
                size="icon"
                className={cn(
                  'h-9 w-9',
                  activeTool === tool.id && 'bg-primary text-primary-foreground'
                )}
                onClick={() => onToolChange(tool.id)}
              >
                {tool.icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {tool.label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 px-2 border-r border-border">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={onUndo}
              disabled={!canUndo}
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Undo
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={onRedo}
              disabled={!canRedo}
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Redo
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Zoom */}
      <div className="flex items-center gap-1 px-2 border-r border-border">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Zoom Out
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Zoom In
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Export & Clear */}
      <div className="flex items-center gap-1 pl-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onExport}>
              <Download className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Export
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-destructive hover:text-destructive"
              onClick={onClear}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Clear Canvas
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
