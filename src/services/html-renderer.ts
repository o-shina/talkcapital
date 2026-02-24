import type { StructuredContent } from '../types/structured-content.js';
import { CANVAS, LAYOUT } from '../templates/layout.js';
import { COLORS } from '../templates/colors.js';
import { resolveBlockLayouts, seededRandom } from '../templates/layout-presets.js';

export interface RenderOptions {
  illustrations?: Map<number, string>;
  scale?: number;
}

export function renderToHtml(
  content: StructuredContent,
  options?: RenderOptions,
): string {
  const illustrations = options?.illustrations;
  const resolvedBlocks = resolveBlockLayouts(content, LAYOUT.blocks);

  // Seed for speech bubble jitter
  const hashStr = content.title + content.mainMessage;
  let hashVal = 0;
  for (let i = 0; i < hashStr.length; i++) {
    hashVal = ((hashVal << 5) - hashVal + hashStr.charCodeAt(i)) | 0;
  }
  const rand = seededRandom(Math.abs(hashVal) + 42);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Klee+One:wght@400;600&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  width: ${CANVAS.width}px;
  height: ${CANVAS.height}px;
  background: ${COLORS.canvas};
  font-family: 'Klee One', cursive, sans-serif;
  color: ${COLORS.text};
  position: relative;
  overflow: hidden;
}
.title {
  position: absolute;
  left: ${LAYOUT.title.x}px;
  top: ${LAYOUT.title.y}px;
  width: ${LAYOUT.title.width}px;
  height: ${LAYOUT.title.height}px;
  background: ${COLORS.title.fill};
  border: 2.5px solid ${COLORS.title.stroke};
  border-radius: 18px 6px 18px 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 38px;
  font-weight: 600;
  padding: 0 16px;
  text-align: center;
  line-height: 1.2;
}
.main-message {
  position: absolute;
  left: ${LAYOUT.mainMessage.x}px;
  top: ${LAYOUT.mainMessage.y}px;
  width: ${LAYOUT.mainMessage.width}px;
  height: ${LAYOUT.mainMessage.height}px;
  background: ${COLORS.mainMessage.fill};
  border: 2px solid ${COLORS.mainMessage.stroke};
  border-radius: 40px 40px 40px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  padding: 0 24px;
  text-align: center;
  line-height: 1.3;
}
.block {
  position: absolute;
  border-radius: 16px 4px 16px 4px;
  padding: 16px 20px;
  border-width: 2px;
  border-style: solid;
  overflow: hidden;
}
.block-heading {
  font-size: ${LAYOUT.blockHeadingFontSize}px;
  font-weight: 600;
  margin-bottom: 4px;
  line-height: 1.2;
}
.block-underline {
  height: 3px;
  margin: 4px 0 12px 0;
  border-radius: 2px;
}
.block-illustration {
  float: left;
  margin: 0 14px 8px 0;
  border-radius: 12px;
  width: 120px;
  height: 120px;
  object-fit: cover;
}
.block-bullets {
  list-style: none;
  padding: 0;
}
.block-bullets li {
  font-size: ${LAYOUT.blockBulletFontSize}px;
  line-height: 1.5;
  padding-left: 20px;
  position: relative;
  margin-bottom: 4px;
}
.block-bullets li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 10px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.speech-area {
  position: absolute;
}
.speech-bubble {
  position: absolute;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: ${LAYOUT.speechBubbleFontSize}px;
  line-height: 1.3;
  padding: 20px 24px;
  background: ${COLORS.speechBubble.fill};
  border-width: 2px;
  border-style: solid;
}
.speech-tail {
  position: absolute;
}
.actions-area {
  position: absolute;
  left: ${LAYOUT.actions.x}px;
  top: ${LAYOUT.actions.y}px;
  width: ${LAYOUT.actions.width}px;
  height: ${LAYOUT.actions.height}px;
  background: ${COLORS.actions.fill};
  border: 2px solid ${COLORS.actions.stroke};
  border-radius: 16px 4px 16px 4px;
  padding: 20px 28px;
}
.actions-header {
  font-size: ${LAYOUT.actions.headerFontSize}px;
  font-weight: 600;
  margin-bottom: 8px;
}
.actions-underline {
  height: 2px;
  background: ${COLORS.actions.stroke};
  border-radius: 1px;
  margin-bottom: 16px;
}
.action-item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 18px;
  font-size: ${LAYOUT.actions.itemFontSize}px;
  line-height: 1.4;
}
.action-checkbox {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border: 2px solid ${COLORS.actions.stroke};
  border-radius: 6px;
  margin-top: 2px;
}
.connectors {
  position: absolute;
  left: 0;
  top: 0;
  width: ${CANVAS.width}px;
  height: ${CANVAS.height}px;
  pointer-events: none;
}
</style>
</head>
<body>

<!-- タイトル -->
<div class="title">${escapeHtml(content.title)}</div>

<!-- メインメッセージ -->
<div class="main-message">${escapeHtml(content.mainMessage)}</div>

<!-- ブロック ×${content.blocks.length} -->
${content.blocks.map((block, i) => {
  const layout = resolvedBlocks[i];
  const color = COLORS.blocks[i];
  const angleDeg = (layout.angle * 180) / Math.PI;
  const illust = illustrations?.get(i);
  return `<div class="block" style="
    left:${layout.x}px; top:${layout.y}px;
    width:${layout.width}px; height:${layout.height}px;
    background:${color.fill}; border-color:${color.stroke};
    transform: rotate(${angleDeg.toFixed(2)}deg);
  ">
    <div class="block-heading" style="color:${color.stroke}">${escapeHtml(block.heading)}</div>
    <div class="block-underline" style="background:${color.stroke}"></div>
    ${illust ? `<img class="block-illustration" src="${illust}" alt="">` : ''}
    <ul class="block-bullets">
      ${block.bullets.map(b => `<li style=""><span style="position:absolute;left:0;top:10px;width:8px;height:8px;border-radius:50%;background:${color.stroke};display:block;"></span>${escapeHtml(b.text)}</li>`).join('\n      ')}
    </ul>
  </div>`;
}).join('\n')}

<!-- 吹き出し ×${content.speechBubbles.length} -->
${content.speechBubbles.map((bubble, i) => {
  const layout = LAYOUT.speechBubbles[i];
  if (!layout) return '';
  const bubbleStroke = bubble.emphasis
    ? COLORS.emphasis[bubble.emphasis]
    : COLORS.speechBubble.stroke;
  const jitterAngle = ((rand() - 0.5) * 4).toFixed(1);
  const tailX = layout.x + layout.width * 0.3;
  const tailY = layout.y + layout.height;
  return `<div class="speech-bubble" style="
    left:${layout.x}px; top:${layout.y}px;
    width:${layout.width}px; height:${layout.height}px;
    border-color:${bubbleStroke};
    transform: rotate(${jitterAngle}deg);
  ">&ldquo;${escapeHtml(bubble.quote)}&rdquo;</div>
  <svg class="speech-tail" style="left:${tailX}px;top:${tailY - 4}px;position:absolute;" width="30" height="24" viewBox="0 0 30 24">
    <path d="M0,0 L8,22 L24,16 Z" fill="${COLORS.speechBubble.fill}" stroke="${bubbleStroke}" stroke-width="2" stroke-linejoin="round"/>
  </svg>`;
}).join('\n')}

<!-- アクションエリア -->
<div class="actions-area">
  <div class="actions-header">今日からできるアクション</div>
  <div class="actions-underline"></div>
  ${content.actions.map(action => `<div class="action-item">
    <div class="action-checkbox"></div>
    <div>${escapeHtml(action.text)}</div>
  </div>`).join('\n  ')}
</div>

<!-- SVGコネクタ・装飾 -->
<svg class="connectors" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}" xmlns="http://www.w3.org/2000/svg">
  <!-- タイトル → メインメッセージ の矢印 -->
  <path d="M${LAYOUT.title.x + LAYOUT.title.width + 8},${LAYOUT.title.y + LAYOUT.title.height / 2}
           C${LAYOUT.title.x + LAYOUT.title.width + 30},${LAYOUT.title.y + LAYOUT.title.height / 2 - 10}
            ${LAYOUT.mainMessage.x - 30},${LAYOUT.mainMessage.y + LAYOUT.mainMessage.height / 2 + 10}
            ${LAYOUT.mainMessage.x - 8},${LAYOUT.mainMessage.y + LAYOUT.mainMessage.height / 2}"
        stroke="${COLORS.connector}" stroke-width="2" fill="none" marker-end="url(#arrowhead)"/>

  <!-- メインメッセージ → アクション の点線矢印 -->
  <path d="M${LAYOUT.actions.x + LAYOUT.actions.width / 2},${LAYOUT.mainMessage.y + LAYOUT.mainMessage.height + 8}
           C${LAYOUT.actions.x + LAYOUT.actions.width / 2},${LAYOUT.mainMessage.y + LAYOUT.mainMessage.height + 50}
            ${LAYOUT.actions.x + LAYOUT.actions.width / 2},${LAYOUT.actions.y - 50}
            ${LAYOUT.actions.x + LAYOUT.actions.width / 2},${LAYOUT.actions.y - 8}"
        stroke="${COLORS.connector}" stroke-width="1.5" fill="none" stroke-dasharray="8,6" marker-end="url(#arrowhead)"/>

  <!-- ブロックエリアとサイドエリアの区切り線（波線） -->
  <path d="M920,130 ${generateWavyLine(920, 130, 920, 830, 8, 12)}"
        stroke="${COLORS.decorationLight}" stroke-width="1" fill="none"/>

  <!-- 矢印マーカー定義 -->
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="${COLORS.connector}"/>
    </marker>
  </defs>
</svg>

</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function generateWavyLine(
  _x1: number, y1: number,
  _x2: number, y2: number,
  amplitude: number,
  wavelength: number,
): string {
  const segments: string[] = [];
  const steps = Math.ceil(Math.abs(y2 - y1) / wavelength);
  for (let i = 0; i < steps; i++) {
    const cy = y1 + (i + 0.5) * wavelength;
    const ey = y1 + (i + 1) * wavelength;
    const dir = i % 2 === 0 ? 1 : -1;
    segments.push(`Q${_x1 + dir * amplitude},${cy} ${_x1},${Math.min(ey, y2)}`);
  }
  return segments.join(' ');
}
