/**
 * Whiteboard types for custom canvas implementation
 */

export type ToolType = 
  | 'select'
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'rectangle'
  | 'circle'
  | 'line'
  | 'arrow'
  | 'text'
  | 'pan';

export interface BrushSettings {
  color: string;
  width: number;
  opacity: number;
}

export interface CanvasObject {
  id: string;
  type: string;
  data: Record<string, unknown>;
  createdBy: string;
  createdAt: number;
}

export interface WhiteboardState {
  objects: Map<string, CanvasObject>;
  background: string;
  viewportTransform: number[];
}

export interface CursorPosition {
  x: number;
  y: number;
  userId: string;
  userName: string;
  userColor: string;
}

export interface WhiteboardUser {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
}
