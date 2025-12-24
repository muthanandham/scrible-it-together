import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Palette } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
  color: string;
  strokeWidth: number;
  opacity: number;
  onColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onOpacityChange: (opacity: number) => void;
}

const PRESET_COLORS = [
  '#000000', '#374151', '#6b7280', '#9ca3af',
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
  '#ffffff', '#fef3c7', '#dbeafe', '#dcfce7',
];

export function ColorPicker({
  color,
  strokeWidth,
  opacity,
  onColorChange,
  onStrokeWidthChange,
  onOpacityChange,
}: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-10 h-10 w-10 bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-lg"
        >
          <div
            className="h-6 w-6 rounded-full border-2 border-border"
            style={{ backgroundColor: color }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-4" align="end">
        <div className="space-y-4">
          {/* Color Grid */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Color</Label>
            <div className="grid grid-cols-8 gap-1">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  className={cn(
                    'h-6 w-6 rounded-md border-2 transition-transform hover:scale-110',
                    color === presetColor ? 'border-primary ring-2 ring-primary/20' : 'border-transparent'
                  )}
                  style={{ backgroundColor: presetColor }}
                  onClick={() => onColorChange(presetColor)}
                />
              ))}
            </div>
          </div>

          {/* Custom Color */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Custom Color</Label>
            <input
              type="color"
              value={color}
              onChange={(e) => onColorChange(e.target.value)}
              className="w-full h-8 rounded-md cursor-pointer"
            />
          </div>

          {/* Stroke Width */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">
              Stroke Width: {strokeWidth}px
            </Label>
            <Slider
              value={[strokeWidth]}
              onValueChange={([value]) => onStrokeWidthChange(value)}
              min={1}
              max={20}
              step={1}
              className="w-full"
            />
          </div>

          {/* Opacity */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">
              Opacity: {Math.round(opacity * 100)}%
            </Label>
            <Slider
              value={[opacity]}
              onValueChange={([value]) => onOpacityChange(value)}
              min={0.1}
              max={1}
              step={0.1}
              className="w-full"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
