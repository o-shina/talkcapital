import { nanoid } from 'nanoid';
import type { StructuredContent } from '../types/structured-content.js';
import type { ExcalidrawDocument, ExcalidrawElement, ExcalidrawShapeElement } from '../types/excalidraw.js';
import { CANVAS, LAYOUT } from '../templates/layout.js';
import { COLORS, STYLE } from '../templates/colors.js';

export function renderToExcalidraw(content: StructuredContent): ExcalidrawDocument {
  const elements: ExcalidrawElement[] = [];

  // --- タイトル ---
  elements.push(
    ...buildBoundBoxWithText(
      LAYOUT.title,
      content.title,
      COLORS.title.fill,
      COLORS.title.stroke,
      { fontSize: LAYOUT.title.fontSize, textAlign: LAYOUT.title.textAlign },
    ),
  );

  // --- メインメッセージ ---
  elements.push(
    ...buildBoundBoxWithText(
      LAYOUT.mainMessage,
      content.mainMessage,
      COLORS.mainMessage.fill,
      COLORS.mainMessage.stroke,
      { fontSize: LAYOUT.mainMessage.fontSize, textAlign: LAYOUT.mainMessage.textAlign },
    ),
  );

  // --- ブロック (4個) ---
  for (let i = 0; i < LAYOUT.blocks.length; i += 1) {
    const layout = LAYOUT.blocks[i];
    const color = COLORS.blocks[i];
    const block = content.blocks[i];

    // 背景矩形
    elements.push(
      createRect({
        x: layout.x,
        y: layout.y,
        width: layout.width,
        height: layout.height,
        fill: color.fill,
        stroke: color.stroke,
      }),
    );

    // 見出しテキスト (ブロック上部に配置)
    if (block) {
      elements.push(
        createText({
          x: layout.x + LAYOUT.blockBullet.leftPadding,
          y: layout.y + LAYOUT.blockHeading.topInset,
          width: layout.width - LAYOUT.blockBullet.leftPadding * 2,
          height: LAYOUT.blockHeading.height,
          text: block.heading,
          fontSize: LAYOUT.blockHeading.fontSize,
          textAlign: 'left',
        }),
      );

      // 箇条書き (見出しの下に配置)
      block.bullets.forEach((bullet, bulletIndex) => {
        elements.push(
          createText({
            x: layout.x + LAYOUT.blockBullet.leftPadding,
            y: layout.y + LAYOUT.blockBullet.topOffset + bulletIndex * LAYOUT.blockBullet.lineHeight,
            width: layout.width - LAYOUT.blockBullet.leftPadding - LAYOUT.blockBullet.rightPadding,
            height: LAYOUT.blockBullet.lineHeight,
            text: `・${bullet.text}`,
            fontSize: LAYOUT.blockBullet.fontSize,
            textAlign: 'left',
          }),
        );
      });
    }
  }

  // --- 吹き出し ---
  for (let i = 0; i < content.speechBubbles.length; i += 1) {
    const bubble = content.speechBubbles[i];
    const layout = LAYOUT.speechBubbles[i];
    if (!layout) break;
    elements.push(
      ...buildEllipseWithText(
        layout,
        `\u201C${bubble.quote}\u201D`,
        COLORS.speechBubble.fill,
        COLORS.speechBubble.stroke,
      ),
    );
  }

  // --- アクションエリア ---
  elements.push(
    createRect({
      x: LAYOUT.actions.x,
      y: LAYOUT.actions.y,
      width: LAYOUT.actions.width,
      height: LAYOUT.actions.height,
      fill: COLORS.actions.fill,
      stroke: COLORS.actions.stroke,
    }),
  );

  elements.push(
    createText({
      x: LAYOUT.actions.x + 30,
      y: LAYOUT.actions.y + 20,
      width: LAYOUT.actions.width - 60,
      height: 50,
      text: '今日からできるアクション',
      fontSize: LAYOUT.actions.headerFontSize,
      textAlign: 'left',
    }),
  );

  content.actions.forEach((action, actionIndex) => {
    const y = LAYOUT.actions.y + 90 + actionIndex * 100;
    elements.push(
      createRect({
        x: LAYOUT.actions.x + 30,
        y: y + 6,
        width: 32,
        height: 32,
        fill: '#ffffff',
        stroke: COLORS.actions.stroke,
      }),
      createText({
        x: LAYOUT.actions.x + 80,
        y,
        width: LAYOUT.actions.width - 120,
        height: 44,
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

// --- ヘルパー ---

function buildBoundBoxWithText(
  layout: { x: number; y: number; width: number; height: number },
  text: string,
  fill: string,
  stroke: string,
  options: { fontSize: number; textAlign: 'left' | 'center' | 'right' },
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
    y: layout.y + 16,
    width: layout.width - 32,
    height: layout.height - 32,
    text,
    fontSize: options.fontSize,
    textAlign: options.textAlign,
    containerId: container.id,
  });
  (container as ExcalidrawShapeElement).boundElements = [{ type: 'text', id: textElement.id }];
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
    x: layout.x + 40,
    y: layout.y + 30,
    width: layout.width - 80,
    height: layout.height - 60,
    text,
    fontSize: 24,
    textAlign: 'center',
    containerId: ellipse.id,
  });
  (ellipse as ExcalidrawShapeElement).boundElements = [{ type: 'text', id: textElement.id }];
  return [ellipse, textElement];
}

function createRect(input: {
  x: number; y: number; width: number; height: number;
  fill: string; stroke: string;
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
  x: number; y: number; width: number; height: number;
  fill: string; stroke: string;
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
  x: number; y: number; width: number; height: number;
  text: string; fontSize: number;
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
