import { nanoid } from 'nanoid';
import type { StructuredContent } from '../types/structured-content.js';
import type {
  ExcalidrawDocument,
  ExcalidrawElement,
  ExcalidrawShapeElement,
  ExcalidrawLinearElement,
  ExcalidrawImageElement,
  BinaryFiles,
} from '../types/excalidraw.js';
import { CANVAS, LAYOUT } from '../templates/layout.js';
import { COLORS, STYLE } from '../templates/colors.js';
import { resolveBlockLayouts } from '../templates/layout-presets.js';

export function renderToExcalidraw(content: StructuredContent, files?: BinaryFiles): ExcalidrawDocument {
  const elements: ExcalidrawElement[] = [];
  const hasIcons = files && Object.keys(files).length > 0;

  // --- タイトル ---
  elements.push(...buildBoundBoxWithText(LAYOUT.title, content.title, COLORS.title.fill, COLORS.title.stroke));

  // --- メインメッセージ ---
  elements.push(
    ...buildBoundBoxWithText(
      LAYOUT.mainMessage,
      content.mainMessage,
      COLORS.mainMessage.fill,
      COLORS.mainMessage.stroke,
    ),
  );

  // --- タイトル→メインメッセージの接続矢印 ---
  elements.push(
    createArrow({
      x: LAYOUT.title.x + LAYOUT.title.width + 10,
      y: LAYOUT.title.y + LAYOUT.title.height / 2,
      points: [
        [0, 0],
        [LAYOUT.mainMessage.x - LAYOUT.title.x - LAYOUT.title.width - 20, 0],
      ],
      stroke: COLORS.connector,
      strokeWidth: 1.5,
      endArrowhead: 'arrow',
    }),
  );

  // --- ブロック（最大4個、ジッター＋重要度サイズ適用） ---
  const resolvedBlocks = resolveBlockLayouts(content, LAYOUT.blocks);

  for (let i = 0; i < LAYOUT.blocks.length; i += 1) {
    const layout = resolvedBlocks[i];
    const color = COLORS.blocks[i];
    const block = content.blocks[i];

    // ブロック背景矩形
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

    if (block) {
      // アイコン画像の配置（ファイルがある場合）
      const iconFileId = hasIcons ? findFileIdForBlock(files, i) : undefined;
      const iconOffset = iconFileId ? 120 : 0;

      if (iconFileId) {
        elements.push(
          createImage({
            x: layout.x + 20,
            y: layout.y + LAYOUT.blockBulletTopOffset + 10,
            width: 100,
            height: 100,
            fileId: iconFileId,
          }),
        );
      }

      // 見出しテキスト（ブロック上部）
      elements.push(
        createText({
          x: layout.x + LAYOUT.blockBulletLeftPadding,
          y: layout.y + LAYOUT.blockHeadingTopInset,
          width: layout.width - LAYOUT.blockBulletLeftPadding * 2,
          height: LAYOUT.blockHeadingHeight,
          text: block.heading,
          fontSize: LAYOUT.blockHeadingFontSize,
          textAlign: 'left',
        }),
      );

      // 見出し下のアンダーライン
      elements.push(
        createLine({
          x: layout.x + 20,
          y: layout.y + LAYOUT.blockBulletTopOffset - 10,
          points: [
            [0, 0],
            [layout.width - 40, 0],
          ],
          stroke: color.stroke,
          strokeWidth: 1.5,
        }),
      );

      // 箇条書き（見出しの下に配置）
      block.bullets.forEach((bullet, bulletIndex) => {
        const bulletY = layout.y + LAYOUT.blockBulletTopOffset + bulletIndex * LAYOUT.blockBulletLineHeight;

        // 塗り円のバレットマーカー
        elements.push(
          createEllipse({
            x: layout.x + LAYOUT.blockBulletLeftPadding + iconOffset,
            y: bulletY + 12,
            width: 10,
            height: 10,
            fill: color.stroke,
            stroke: color.stroke,
          }),
        );

        // バレットテキスト
        elements.push(
          createText({
            x: layout.x + LAYOUT.blockBulletLeftPadding + 20 + iconOffset,
            y: bulletY,
            width: layout.width - LAYOUT.blockBulletLeftPadding - LAYOUT.blockBulletRightPadding - 20 - iconOffset,
            height: LAYOUT.blockBulletLineHeight,
            text: bullet.text,
            fontSize: LAYOUT.blockBulletFontSize,
            textAlign: 'left',
          }),
        );
      });
    }
  }

  // --- 吹き出し（最大4個） ---
  for (let i = 0; i < content.speechBubbles.length; i += 1) {
    const bubble = content.speechBubbles[i];
    const layout = LAYOUT.speechBubbles[i];
    if (!layout) {
      break;
    }

    // emphasisに応じたストローク色
    const bubbleStroke = bubble.emphasis
      ? COLORS.emphasis[bubble.emphasis]
      : COLORS.speechBubble.stroke;

    elements.push(
      ...buildEllipseWithText(
        layout,
        `"${bubble.quote}"`,
        COLORS.speechBubble.fill,
        bubbleStroke,
        { fontSize: LAYOUT.speechBubbleFontSize },
      ),
    );

    // 吹き出しのしっぽ（小さな三角形風のライン）
    elements.push(
      createLine({
        x: layout.x + layout.width * 0.3,
        y: layout.y + layout.height,
        points: [
          [0, 0],
          [-12, 20],
          [12, 16],
        ],
        stroke: bubbleStroke,
        strokeWidth: 1.5,
      }),
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
      y: LAYOUT.actions.y + 24,
      width: LAYOUT.actions.width - 60,
      height: 50,
      text: '今日からできるアクション',
      fontSize: LAYOUT.actions.headerFontSize,
      textAlign: 'left',
    }),
  );

  // アクションヘッダー下のアンダーライン
  elements.push(
    createLine({
      x: LAYOUT.actions.x + 20,
      y: LAYOUT.actions.y + 85,
      points: [
        [0, 0],
        [LAYOUT.actions.width - 40, 0],
      ],
      stroke: COLORS.actions.stroke,
      strokeWidth: 1,
    }),
  );

  content.actions.forEach((action, actionIndex) => {
    const y = LAYOUT.actions.y + 110 + actionIndex * 110;

    // チェックボックス
    elements.push(
      createRect({
        x: LAYOUT.actions.x + 28,
        y,
        width: 28,
        height: 28,
        fill: '#ffffff',
        stroke: COLORS.actions.stroke,
      }),
    );

    // アクションテキスト
    elements.push(
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

  // --- メインメッセージ→アクションエリアへの点線矢印 ---
  elements.push(
    createArrow({
      x: LAYOUT.actions.x + LAYOUT.actions.width / 2,
      y: LAYOUT.mainMessage.y + LAYOUT.mainMessage.height + 8,
      points: [
        [0, 0],
        [0, LAYOUT.actions.y - LAYOUT.mainMessage.y - LAYOUT.mainMessage.height - 16],
      ],
      stroke: COLORS.connector,
      strokeWidth: 1,
      endArrowhead: 'arrow',
    }),
  );

  // --- ブロックエリアとサイドエリアの区切り線 ---
  elements.push(
    createLine({
      x: LAYOUT.speechBubbles[0].x - 40,
      y: LAYOUT.title.y + LAYOUT.title.height + 10,
      points: [
        [0, 0],
        [0, CANVAS.height - LAYOUT.title.y * 2 - LAYOUT.title.height - 20],
      ],
      stroke: COLORS.decorationLight,
      strokeWidth: 1,
    }),
  );

  return {
    type: 'excalidraw',
    version: 2,
    source: 'https://talkcapital.local',
    elements,
    ...(hasIcons ? { files } : {}),
    appState: {
      viewBackgroundColor: COLORS.canvas,
      width: CANVAS.width,
      height: CANVAS.height,
    },
  };
}

/** BinaryFiles辞書からブロックインデックスに対応するfileIdを検索 */
function findFileIdForBlock(files: BinaryFiles, blockIndex: number): string | undefined {
  const prefix = `icon-block-${blockIndex}-`;
  return Object.keys(files).find((key) => key.startsWith(prefix));
}

// ──────────────────────────────────────────
// ビルダー関数
// ──────────────────────────────────────────

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
  (container as ExcalidrawShapeElement).boundElements = [{ type: 'text', id: textElement.id }];
  return [container, textElement];
}

function buildEllipseWithText(
  layout: { x: number; y: number; width: number; height: number },
  text: string,
  fill: string,
  stroke: string,
  options?: { fontSize?: number },
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
    fontSize: options?.fontSize ?? 22,
    textAlign: 'center',
    containerId: ellipse.id,
  });
  (ellipse as ExcalidrawShapeElement).boundElements = [{ type: 'text', id: textElement.id }];
  return [ellipse, textElement];
}

// ──────────────────────────────────────────
// プリミティブ要素生成
// ──────────────────────────────────────────

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

function createArrow(input: {
  x: number;
  y: number;
  points: [number, number][];
  stroke: string;
  strokeWidth: number;
  endArrowhead: 'arrow' | 'bar' | 'dot' | 'triangle' | null;
}): ExcalidrawLinearElement {
  // bounding box from points
  const xs = input.points.map((p) => p[0]);
  const ys = input.points.map((p) => p[1]);
  const w = Math.max(1, Math.max(...xs) - Math.min(...xs));
  const h = Math.max(1, Math.max(...ys) - Math.min(...ys));

  return {
    id: nanoid(),
    type: 'arrow',
    x: input.x,
    y: input.y,
    width: w,
    height: h,
    points: input.points,
    startArrowhead: null,
    endArrowhead: input.endArrowhead,
    strokeColor: input.stroke,
    backgroundColor: 'transparent',
    strokeWidth: input.strokeWidth,
    roughness: STYLE.roughness,
  };
}

function createLine(input: {
  x: number;
  y: number;
  points: [number, number][];
  stroke: string;
  strokeWidth: number;
}): ExcalidrawLinearElement {
  const xs = input.points.map((p) => p[0]);
  const ys = input.points.map((p) => p[1]);
  const w = Math.max(1, Math.max(...xs) - Math.min(...xs));
  const h = Math.max(1, Math.max(...ys) - Math.min(...ys));

  return {
    id: nanoid(),
    type: 'line',
    x: input.x,
    y: input.y,
    width: w,
    height: h,
    points: input.points,
    startArrowhead: null,
    endArrowhead: null,
    strokeColor: input.stroke,
    backgroundColor: 'transparent',
    strokeWidth: input.strokeWidth,
    roughness: STYLE.roughness,
  };
}

function createImage(input: {
  x: number;
  y: number;
  width: number;
  height: number;
  fileId: string;
}): ExcalidrawImageElement {
  return {
    id: nanoid(),
    type: 'image',
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    fileId: input.fileId,
    status: 'saved',
    scale: [1, 1],
    strokeColor: 'transparent',
    backgroundColor: 'transparent',
    strokeWidth: 0,
    roughness: 0,
  };
}
