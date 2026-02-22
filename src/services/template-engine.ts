import { nanoid } from 'nanoid';
import type { StructuredContent } from '../types/structured-content.js';
import type { ExcalidrawDocument, ExcalidrawElement } from '../types/excalidraw.js';
import { CANVAS, LAYOUT } from '../templates/layout.js';
import { COLORS, STYLE } from '../templates/colors.js';

export function renderToExcalidraw(content: StructuredContent): ExcalidrawDocument {
  const elements: ExcalidrawElement[] = [];

  elements.push(...buildBoundBoxWithText(LAYOUT.title, content.title, COLORS.title.fill, COLORS.title.stroke));
  elements.push(
    ...buildBoundBoxWithText(
      LAYOUT.mainMessage,
      content.mainMessage,
      COLORS.mainMessage.fill,
      COLORS.mainMessage.stroke,
    ),
  );

  for (let i = 0; i < LAYOUT.blocks.length; i += 1) {
    const layout = LAYOUT.blocks[i];
    const color = COLORS.blocks[i];
    const block = content.blocks[i];
    elements.push(
      ...buildBoundBoxWithText(layout, block?.heading ?? '', color.fill, color.stroke, {
        fontSize: 28,
        textAlign: 'left',
      }),
    );

    if (block) {
      block.bullets.forEach((bullet, bulletIndex) => {
        elements.push(
          createText({
            x: layout.x + 24,
            y: layout.y + 80 + bulletIndex * 64,
            width: layout.width - 48,
            height: 56,
            text: `・${bullet.text}`,
            fontSize: 24,
            textAlign: 'left',
          }),
        );
      });
    }
  }

  for (let i = 0; i < content.speechBubbles.length; i += 1) {
    const bubble = content.speechBubbles[i];
    const layout = LAYOUT.speechBubbles[i];
    if (!layout) {
      break;
    }
    elements.push(
      ...buildEllipseWithText(layout, `\"${bubble.quote}\"`, COLORS.speechBubble.fill, COLORS.speechBubble.stroke),
    );
  }

  elements.push(
    ...buildBoundBoxWithText(
      {
        x: LAYOUT.actions.x,
        y: LAYOUT.actions.y,
        width: LAYOUT.actions.width,
        height: LAYOUT.actions.height,
      },
      '今日からできるアクション',
      COLORS.actions.fill,
      COLORS.actions.stroke,
      { fontSize: LAYOUT.actions.headerFontSize, textAlign: 'left', topInset: 24 },
    ),
  );

  content.actions.forEach((action, actionIndex) => {
    const y = LAYOUT.actions.y + 96 + actionIndex * 82;
    elements.push(
      createRect({
        x: LAYOUT.actions.x + 28,
        y,
        width: 28,
        height: 28,
        fill: '#ffffff',
        stroke: COLORS.actions.stroke,
      }),
      createText({
        x: LAYOUT.actions.x + 72,
        y: y - 8,
        width: LAYOUT.actions.width - 110,
        height: 46,
        text: action.text,
        fontSize: LAYOUT.actions.itemFontSize,
        textAlign: 'left',
      }),
    );
  });

  return {
    type: 'excalidraw',
    version: 2,
    source: 'https://talkcapital.local',
    elements,
    appState: {
      viewBackgroundColor: COLORS.canvas,
      width: CANVAS.width,
      height: CANVAS.height,
    },
  };
}

function buildBoundBoxWithText(
  layout: { x: number; y: number; width: number; height: number; fontSize?: number; textAlign?: 'left' | 'center' | 'right' },
  text: string,
  fill: string,
  stroke: string,
  options?: { fontSize?: number; textAlign?: 'left' | 'center' | 'right'; topInset?: number },
): ExcalidrawElement[] {
  const container = createRect({
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    fill,
    stroke,
  });
  const textElement = createText({
    x: layout.x + 16,
    y: layout.y + (options?.topInset ?? 20),
    width: layout.width - 32,
    height: layout.height - 30,
    text,
    fontSize: options?.fontSize ?? layout.fontSize ?? 24,
    textAlign: options?.textAlign ?? layout.textAlign ?? 'center',
    containerId: container.id,
  });
  container.boundElements = [{ type: 'text', id: textElement.id }];
  return [container, textElement];
}

function buildEllipseWithText(
  layout: { x: number; y: number; width: number; height: number },
  text: string,
  fill: string,
  stroke: string,
): ExcalidrawElement[] {
  const ellipse = createEllipse({
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    fill,
    stroke,
  });
  const textElement = createText({
    x: layout.x + 24,
    y: layout.y + 28,
    width: layout.width - 48,
    height: layout.height - 40,
    text,
    fontSize: 22,
    textAlign: 'center',
    containerId: ellipse.id,
  });
  ellipse.boundElements = [{ type: 'text', id: textElement.id }];
  return [ellipse, textElement];
}

function createRect(input: {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
}): ExcalidrawElement {
  return {
    id: nanoid(),
    type: 'rectangle',
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    strokeColor: input.stroke,
    backgroundColor: input.fill,
    strokeWidth: STYLE.strokeWidth,
    roughness: STYLE.roughness,
    roundness: { type: 3 },
  };
}

function createEllipse(input: {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
}): ExcalidrawElement {
  return {
    id: nanoid(),
    type: 'ellipse',
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    strokeColor: input.stroke,
    backgroundColor: input.fill,
    strokeWidth: STYLE.strokeWidth,
    roughness: STYLE.roughness,
    roundness: { type: 2 },
  };
}

function createText(input: {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  textAlign: 'left' | 'center' | 'right';
  containerId?: string;
}): ExcalidrawElement {
  return {
    id: nanoid(),
    type: 'text',
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    text: input.text,
    fontSize: input.fontSize,
    fontFamily: STYLE.fontFamily,
    textAlign: input.textAlign,
    verticalAlign: 'middle',
    containerId: input.containerId,
    strokeColor: COLORS.text,
    backgroundColor: 'transparent',
    strokeWidth: 1,
    roughness: 0,
  };
}
