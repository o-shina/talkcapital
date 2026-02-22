export type ExcalidrawElementType = 'rectangle' | 'text' | 'ellipse';

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

export type ExcalidrawElement = ExcalidrawShapeElement | ExcalidrawTextElement;

export interface ExcalidrawDocument {
  type: 'excalidraw';
  version: 2;
  source: string;
  elements: ExcalidrawElement[];
  appState: {
    viewBackgroundColor: string;
    width: number;
    height: number;
  };
}
