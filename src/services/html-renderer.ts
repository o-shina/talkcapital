import type { StructuredContent } from '../types/structured-content.js';
import { CANVAS, LAYOUT } from '../templates/layout.js';
import { COLORS } from '../templates/colors.js';
import { resolveBlockLayouts, seededRandom } from '../templates/layout-presets.js';

export interface RenderOptions {
  illustrations?: Map<number, string>;
  scale?: number;
}

function generateStarPoints(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  points: number,
): number[][] {
  const pts: number[][] = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return pts;
}

export function renderToHtml(
  content: StructuredContent,
  options?: RenderOptions,
): string {
  const illustrations = options?.illustrations;
  const resolvedBlocks = resolveBlockLayouts(content, LAYOUT.blocks);

  const hashStr = content.title + content.mainMessage;
  let hashVal = 0;
  for (let i = 0; i < hashStr.length; i++) {
    hashVal = ((hashVal << 5) - hashVal + hashStr.charCodeAt(i)) | 0;
  }
  const rand = seededRandom(Math.abs(hashVal) + 42);
  const seed = () => Math.floor(rand() * 100000);

  const roughCommands: string[] = [];

  // ========== Title: Banner/Ribbon shape ==========
  const tx = LAYOUT.title.x;
  const ty = LAYOUT.title.y;
  const tw = LAYOUT.title.width;
  const th = LAYOUT.title.height;
  const foldW = 40;
  const bannerPath = `M ${tx + foldW} ${ty} L ${tx + tw - foldW} ${ty} L ${tx + tw} ${ty + th / 2} L ${tx + tw - foldW} ${ty + th} L ${tx + foldW} ${ty + th} L ${tx} ${ty + th / 2} Z`;
  roughCommands.push(`rc.path('${bannerPath}', {fill:'${COLORS.title.bannerFill}', stroke:'${COLORS.title.bannerStroke}', fillStyle:'hachure', hachureGap:14, fillWeight:1.5, roughness:3, strokeWidth:6, bowing:2, seed:${seed()}})`);

  // ========== Main message: hachure + underline ==========
  roughCommands.push(`rc.rectangle(${LAYOUT.mainMessage.x}, ${LAYOUT.mainMessage.y}, ${LAYOUT.mainMessage.width}, ${LAYOUT.mainMessage.height}, {fill:'${COLORS.mainMessage.accentLight}', stroke:'${COLORS.mainMessage.stroke}', fillStyle:'hachure', hachureGap:20, fillWeight:1, roughness:3.5, strokeWidth:5, bowing:1.5, seed:${seed()}})`);
  const mmUlY = LAYOUT.mainMessage.y + LAYOUT.mainMessage.height - 15;
  roughCommands.push(`rc.line(${LAYOUT.mainMessage.x + 30}, ${mmUlY}, ${LAYOUT.mainMessage.x + LAYOUT.mainMessage.width - 30}, ${mmUlY}, {stroke:'${COLORS.mainMessage.stroke}', roughness:3, strokeWidth:5, seed:${seed()}})`);

  // ========== Blocks: multi-layer rendering ==========
  for (let i = 0; i < resolvedBlocks.length; i++) {
    const layout = resolvedBlocks[i];
    const color = COLORS.blocks[i];

    // Layer 1: Light hachure fill (the "paper" background)
    roughCommands.push(`rc.rectangle(${layout.x}, ${layout.y}, ${layout.width}, ${layout.height}, {fill:'${color.hachure}', stroke:'none', fillStyle:'hachure', hachureGap:24, fillWeight:1, roughness:2, strokeWidth:0, seed:${seed()}})`);

    // Layer 2: Thick hand-drawn border
    roughCommands.push(`rc.rectangle(${layout.x}, ${layout.y}, ${layout.width}, ${layout.height}, {fill:'transparent', stroke:'${color.stroke}', roughness:3.5, strokeWidth:6, bowing:2, seed:${seed()}})`);

    // Layer 3: Numbered circle
    const circleX = layout.x + 35;
    const circleY = layout.y + 35;
    roughCommands.push(`rc.circle(${circleX}, ${circleY}, 50, {fill:'${color.stroke}', stroke:'${color.stroke}', fillStyle:'solid', roughness:2.5, strokeWidth:3, seed:${seed()}})`);

    // Layer 4: Heading underline (thick)
    const ulY = layout.y + 85;
    roughCommands.push(`rc.line(${layout.x + 60}, ${ulY}, ${layout.x + layout.width - 30}, ${ulY}, {stroke:'${color.stroke}', roughness:3, strokeWidth:4, seed:${seed()}})`);

    // Layer 5: Tape mark at top-right corner
    const tapeX = layout.x + layout.width - 50;
    const tapeY = layout.y - 10;
    const tapeW = 60;
    const tapeH = 25;
    const tapeAngle = (rand() - 0.5) * 0.4 + 0.15;
    const cos = Math.cos(tapeAngle);
    const sin = Math.sin(tapeAngle);
    const tapePts = [
      [tapeX, tapeY],
      [tapeX + tapeW * cos, tapeY + tapeW * sin],
      [tapeX + tapeW * cos - tapeH * sin, tapeY + tapeW * sin + tapeH * cos],
      [tapeX - tapeH * sin, tapeY + tapeH * cos],
    ];
    roughCommands.push(`rc.polygon([${tapePts.map(p => `[${Math.round(p[0])},${Math.round(p[1])}]`).join(',')}], {fill:'${COLORS.tape}', stroke:'${COLORS.tape}', fillStyle:'solid', roughness:1.5, strokeWidth:1.5, fillWeight:2, seed:${seed()}})`);

    // Layer 6: Star for high-importance blocks
    const block = content.blocks[i];
    if (block?.importance === 'high') {
      const starX = layout.x + layout.width - 60;
      const starY = layout.y + 60;
      const starPts = generateStarPoints(starX, starY, 30, 14, 5);
      roughCommands.push(`rc.polygon([${starPts.map(p => `[${Math.round(p[0])},${Math.round(p[1])}]`).join(',')}], {fill:'${color.stroke}', stroke:'${color.stroke}', fillStyle:'hachure', hachureGap:6, roughness:2, strokeWidth:3, seed:${seed()}})`);
    }
  }

  // ========== Speech bubbles ==========
  for (let i = 0; i < content.speechBubbles.length; i++) {
    const layout = LAYOUT.speechBubbles[i];
    if (!layout) break;
    const bubble = content.speechBubbles[i];
    const bubbleStroke = bubble.emphasis
      ? COLORS.emphasis[bubble.emphasis]
      : COLORS.speechBubble.stroke;

    roughCommands.push(`rc.ellipse(${layout.x + layout.width / 2}, ${layout.y + layout.height / 2}, ${layout.width}, ${layout.height}, {fill:'${COLORS.speechBubble.fill}', stroke:'${bubbleStroke}', fillStyle:'hachure', hachureGap:25, fillWeight:0.8, roughness:3, strokeWidth:5, bowing:2, seed:${seed()}})`);

    // Curved speech tail
    const tailX = layout.x + layout.width * 0.35;
    const tailY = layout.y + layout.height - 10;
    roughCommands.push(`rc.curve([[${tailX}, ${tailY}], [${tailX - 10}, ${tailY + 25}], [${tailX - 30}, ${tailY + 50}]], {stroke:'${bubbleStroke}', roughness:2, strokeWidth:4, seed:${seed()}})`);
    roughCommands.push(`rc.curve([[${tailX + 35}, ${tailY}], [${tailX + 10}, ${tailY + 30}], [${tailX - 30}, ${tailY + 50}]], {stroke:'${bubbleStroke}', roughness:2, strokeWidth:4, seed:${seed()}})`);
  }

  // ========== Actions area ==========
  roughCommands.push(`rc.rectangle(${LAYOUT.actions.x}, ${LAYOUT.actions.y}, ${LAYOUT.actions.width}, ${LAYOUT.actions.height}, {fill:'${COLORS.actions.fill}', stroke:'${COLORS.actions.stroke}', fillStyle:'cross-hatch', hachureGap:30, fillWeight:0.8, roughness:3, strokeWidth:5, bowing:1.5, seed:${seed()}})`);

  // Actions heading underline
  roughCommands.push(`rc.line(${LAYOUT.actions.x + 20}, ${LAYOUT.actions.y + 60}, ${LAYOUT.actions.x + LAYOUT.actions.width - 20}, ${LAYOUT.actions.y + 60}, {stroke:'${COLORS.actions.stroke}', roughness:3, strokeWidth:4, seed:${seed()}})`);

  // ========== Connector: curved arrow ==========
  const titleEndX = LAYOUT.title.x + LAYOUT.title.width + 10;
  const titleMidY = LAYOUT.title.y + LAYOUT.title.height / 2;
  const msgStartX = LAYOUT.mainMessage.x - 10;
  const msgMidY = LAYOUT.mainMessage.y + LAYOUT.mainMessage.height / 2;
  const ctrlX = (titleEndX + msgStartX) / 2;
  const ctrlY = titleMidY - 40;
  roughCommands.push(`rc.curve([[${titleEndX}, ${titleMidY}], [${ctrlX}, ${ctrlY}], [${msgStartX}, ${msgMidY}]], {stroke:'${COLORS.connector}', roughness:2, strokeWidth:4, bowing:2, seed:${seed()}})`);
  // Arrowhead
  roughCommands.push(`rc.line(${msgStartX}, ${msgMidY}, ${msgStartX - 25}, ${msgMidY - 18}, {stroke:'${COLORS.connector}', roughness:1.5, strokeWidth:4, seed:${seed()}})`);
  roughCommands.push(`rc.line(${msgStartX}, ${msgMidY}, ${msgStartX - 25}, ${msgMidY + 18}, {stroke:'${COLORS.connector}', roughness:1.5, strokeWidth:4, seed:${seed()}})`);

  // ========== Decorative elements ==========
  // Small decorative circles in whitespace
  const decorSpots = [
    { x: LAYOUT.title.x + 80, y: LAYOUT.title.y - 10 },
    { x: CANVAS.width - 100, y: 80 },
    { x: CANVAS.width - 150, y: CANVAS.height - 100 },
  ];
  for (const spot of decorSpots) {
    const r = 10 + rand() * 15;
    roughCommands.push(`rc.circle(${spot.x}, ${spot.y}, ${Math.round(r * 2)}, {fill:'transparent', stroke:'${COLORS.decorationLight}', roughness:3, strokeWidth:2, seed:${seed()}})`);
  }

  // Flow arrows between horizontally adjacent blocks
  for (let i = 0; i < resolvedBlocks.length - 1; i++) {
    const from = resolvedBlocks[i];
    const to = resolvedBlocks[i + 1];
    if (Math.abs(from.y - to.y) < 100) {
      const ax = from.x + from.width + 5;
      const ay = from.y + from.height / 2;
      const bx = to.x - 5;
      const by = to.y + to.height / 2;
      const mx = (ax + bx) / 2;
      const my = ay - 20;
      roughCommands.push(`rc.curve([[${ax},${ay}],[${mx},${my}],[${bx},${by}]], {stroke:'${COLORS.decorationLight}', roughness:2, strokeWidth:2.5, seed:${seed()}})`);
    }
  }

  // Vertical dashed divider
  const divX = LAYOUT.blocks[0].x + LAYOUT.blocks[0].width * 2 + 120;
  roughCommands.push(`rc.line(${divX}, ${LAYOUT.title.y + LAYOUT.title.height + 20}, ${divX}, ${CANVAS.height - 50}, {stroke:'${COLORS.decorationLight}', roughness:2.5, strokeWidth:2.5, seed:${seed()}, strokeLineDash:[25,18]})`);

  // ========== HTML output ==========
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Klee+One:wght@400;600&display=swap" rel="stylesheet">
<script src="https://unpkg.com/roughjs@4.6.6/bundled/rough.js"></script>
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
#rough-canvas {
  position: absolute;
  left: 0; top: 0;
  width: ${CANVAS.width}px;
  height: ${CANVAS.height}px;
}
.title-text {
  position: absolute;
  left: ${LAYOUT.title.x}px;
  top: ${LAYOUT.title.y}px;
  width: ${LAYOUT.title.width}px;
  height: ${LAYOUT.title.height}px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 56px;
  font-weight: 600;
  text-align: center;
  line-height: 1.15;
  padding: 0 50px;
  letter-spacing: 2px;
}
.main-message-text {
  position: absolute;
  left: ${LAYOUT.mainMessage.x}px;
  top: ${LAYOUT.mainMessage.y}px;
  width: ${LAYOUT.mainMessage.width}px;
  height: ${LAYOUT.mainMessage.height}px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  text-align: center;
  line-height: 1.2;
  padding: 0 30px;
}
.block-text {
  position: absolute;
  padding: ${LAYOUT.blockHeadingTopInset}px ${LAYOUT.blockBulletRightPadding}px ${LAYOUT.blockHeadingTopInset}px ${LAYOUT.blockBulletLeftPadding}px;
  overflow: hidden;
}
.block-heading {
  font-size: ${LAYOUT.blockHeadingFontSize}px;
  font-weight: 600;
  margin-bottom: 14px;
  line-height: 1.2;
  padding-bottom: 10px;
}
.block-illustration {
  float: left;
  margin: 8px 18px 8px 0;
  border-radius: 16px;
  width: 200px;
  height: 200px;
  object-fit: cover;
}
.block-bullet-list {
  list-style: none;
  padding: 0;
  margin-top: 8px;
}
.block-bullet-list li {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  font-size: ${LAYOUT.blockBulletFontSize}px;
  line-height: 1.7;
  margin-bottom: 4px;
}
.bullet-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 3px solid;
  background: transparent;
  flex-shrink: 0;
  margin-top: 14px;
}
.block-number {
  position: absolute;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 600;
  color: #fff;
  pointer-events: none;
}
.bubble-text {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 28px;
  font-style: italic;
  line-height: 1.3;
  padding: 30px 40px;
}
.actions-text {
  position: absolute;
  left: ${LAYOUT.actions.x}px;
  top: ${LAYOUT.actions.y}px;
  width: ${LAYOUT.actions.width}px;
  height: ${LAYOUT.actions.height}px;
  padding: 16px 30px;
}
.actions-header {
  font-size: ${LAYOUT.actions.headerFontSize}px;
  font-weight: 600;
  margin-bottom: 16px;
  line-height: 1.2;
  padding-bottom: 8px;
}
.action-item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 18px;
  font-size: ${LAYOUT.actions.itemFontSize}px;
  line-height: 1.4;
  padding-left: 50px;
}
</style>
</head>
<body>

<svg id="rough-canvas" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}"></svg>

<div class="title-text">${escapeHtml(content.title)}</div>
<div class="main-message-text">${escapeHtml(content.mainMessage)}</div>

${content.blocks.map((block, i) => {
  const layout = resolvedBlocks[i];
  const color = COLORS.blocks[i];
  const illust = illustrations?.get(i);
  const circleX = layout.x + 35;
  const circleY = layout.y + 35;
  return `<div class="block-number" style="left:${circleX - 25}px;top:${circleY - 25}px;">${i + 1}</div>
<div class="block-text" style="left:${layout.x}px;top:${layout.y}px;width:${layout.width}px;height:${layout.height}px;">
  <div class="block-heading" style="color:${color.stroke}">${escapeHtml(block.heading)}</div>
  ${illust ? `<img class="block-illustration" src="${illust}" alt="">` : ''}
  <ul class="block-bullet-list">
    ${block.bullets.map(b => `<li><span class="bullet-dot" style="border-color:${color.stroke}"></span>${escapeHtml(b.text)}</li>`).join('\n    ')}
  </ul>
</div>`;
}).join('\n')}

${content.speechBubbles.map((bubble, i) => {
  const layout = LAYOUT.speechBubbles[i];
  if (!layout) return '';
  return `<div class="bubble-text" style="left:${layout.x}px;top:${layout.y}px;width:${layout.width}px;height:${layout.height}px;">
  &ldquo;${escapeHtml(bubble.quote)}&rdquo;
</div>`;
}).join('\n')}

<div class="actions-text">
  <div class="actions-header">今日からできるアクション</div>
  ${content.actions.map(action => `<div class="action-item">${escapeHtml(action.text)}</div>`).join('\n  ')}
</div>

<script>
document.fonts.ready.then(function() {
  var svg = document.getElementById('rough-canvas');
  var rc = rough.svg(svg);
  var commands = [
    ${roughCommands.map(cmd => `function(rc){return ${cmd}}`).join(',\n    ')}
  ];
  commands.forEach(function(fn) {
    svg.appendChild(fn(rc));
  });
  window.__roughDone = true;
});
</script>

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
