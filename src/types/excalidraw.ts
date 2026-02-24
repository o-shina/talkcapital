export type ExcalidrawElementType = 'rectangle' | 'text' | 'ellipse' | 'arrow' | 'line' | 'image';

export interface ExcalidrawBoundElement {
  type: 'text';
  id: string;
}

interface ExcalidrawBaseElement {
  id: string;
  type: ExcalidrawElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  backgroundColor: string;
  strokeWidth: number;
  roughness: number;
  roundness?: {
    type: number;
  };
}

export interface ExcalidrawShapeElement extends ExcalidrawBaseElement {
  type: 'rectangle' | 'ellipse';
  boundElements?: ExcalidrawBoundElement[];
}

export interface ExcalidrawTextElement extends ExcalidrawBaseElement {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: number;
  textAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  containerId?: string;
}

export interface ExcalidrawLinearElement extends ExcalidrawBaseElement {
  type: 'arrow' | 'line';
  points: [number, number][];
  startArrowhead: 'arrow' | 'bar' | 'dot' | 'triangle' | null;
  endArrowhead: 'arrow' | 'bar' | 'dot' | 'triangle' | null;
}

export interface ExcalidrawImageElement extends ExcalidrawBaseElement {
  type: 'image';
  fileId: string;
  status: 'pending' | 'saved' | 'error';
  scale: [number, number];
}

export type ExcalidrawElement =
  | ExcalidrawShapeElement
  | ExcalidrawTextElement
  | ExcalidrawLinearElement
  | ExcalidrawImageElement;

/** Excalidraw の BinaryFileData 型 */
export interface BinaryFileData {
  mimeType: 'image/png' | 'image/jpeg' | 'image/svg+xml' | 'image/webp' | 'image/gif';
  id: string;
  dataURL: string;
  created: number;
}

/** fileId → BinaryFileData のマップ */
export type BinaryFiles = Record<string, BinaryFileData>;

export interface ExcalidrawDocument {
  type: 'excalidraw';
  version: 2;
  source: string;
  elements: ExcalidrawElement[];
  files?: BinaryFiles;
  appState: {
    viewBackgroundColor: string;
    width: number;
    height: number;
  };
}
