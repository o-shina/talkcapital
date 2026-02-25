import type { StructuredContent } from '../types/structured-content.js';
import { CANVAS, computeLayout } from '../templates/layout.js';
import { COLORS } from '../templates/colors.js';
import { resolveBlockLayouts, seededRandom } from '../templates/layout-presets.js';

export interface RenderOptions {
  illustrations?: Map<number, string>;
  zoneImages?: Map<number, string>;
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
  const zoneImages = options?.zoneImages;

  // 動的レイアウト計算
  const layout = computeLayout(content.blocks.length, content.speechBubbles.length);
  const resolvedBlocks = resolveBlockLayouts(content, layout.blocks);

  const hashStr = content.title + content.mainMessage;
  let hashVal = 0;
  for (let i = 0; i < hashStr.length; i++) {
    hashVal = ((hashVal << 5) - hashVal + hashStr.charCodeAt(i)) | 0;
  }
  const rand = seededRandom(Math.abs(hashVal) + 42);
  const seed = () => Math.floor(rand() * 100000);

  const roughCommands: string[] = [];

  // ========== Title: Banner/Ribbon shape ==========
  const tx = layout.title.x;
  const ty = layout.title.y;
  const tw = layout.title.width;
  const th = layout.title.height;
  const foldW = 40;
  const bannerPath = `M ${tx + foldW} ${ty} L ${tx + tw - foldW} ${ty} L ${tx + tw} ${ty + th / 2} L ${tx + tw - foldW} ${ty + th} L ${tx + foldW} ${ty + th} L ${tx} ${ty + th / 2} Z`;
  roughCommands.push(`rc.path('${bannerPath}', {fill:'${COLORS.title.bannerFill}', stroke:'${COLORS.title.bannerStroke}', fillStyle:'hachure', hachureGap:14, fillWeight:1.5, roughness:3, strokeWidth:6, bowing:2, seed:${seed()}})`);

  // ========== Main message: hachure + underline ==========
  roughCommands.push(`rc.rectangle(${layout.mainMessage.x}, ${layout.mainMessage.y}, ${layout.mainMessage.width}, ${layout.mainMessage.height}, {fill:'${COLORS.mainMessage.accentLight}', stroke:'${COLORS.mainMessage.stroke}', fillStyle:'hachure', hachureGap:20, fillWeight:1, roughness:3.5, strokeWidth:5, bowing:1.5, seed:${seed()}})`);
  const mmUlY = layout.mainMessage.y + layout.mainMessage.height - 15;
  roughCommands.push(`rc.line(${layout.mainMessage.x + 30}, ${mmUlY}, ${layout.mainMessage.x + layout.mainMessage.width - 30}, ${mmUlY}, {stroke:'${COLORS.mainMessage.stroke}', roughness:3, strokeWidth:5, seed:${seed()}})`);

  // ========== Blocks: multi-layer rendering ==========
  for (let i = 0; i < resolvedBlocks.length; i++) {
    const blk = resolvedBlocks[i];
    const color = COLORS.blocks[i];

    // Layer 1: Light hachure fill (skip when zone image is provided)
    if (!zoneImages?.has(i)) {
      roughCommands.push(`rc.rectangle(${blk.x}, ${blk.y}, ${blk.width}, ${blk.height}, {fill:'${color.hachure}', stroke:'none', fillStyle:'hachure', hachureGap:24, fillWeight:1, roughness:2, strokeWidth:0, seed:${seed()}})`);
    }

    // Layer 2: Thick hand-drawn border
    roughCommands.push(`rc.rectangle(${blk.x}, ${blk.y}, ${blk.width}, ${blk.height}, {fill:'transparent', stroke:'${color.stroke}', roughness:3.5, strokeWidth:6, bowing:2, seed:${seed()}})`);

    // Layer 3: Numbered circle
    const circleX = blk.x + 35;
    const circleY = blk.y + 35;
    roughCommands.push(`rc.circle(${circleX}, ${circleY}, 60, {fill:'${color.stroke}', stroke:'${color.stroke}', fillStyle:'solid', roughness:2.5, strokeWidth:3, seed:${seed()}})`);

    // Layer 4: Heading underline (thick)
    const ulY = blk.y + 100;
    roughCommands.push(`rc.line(${blk.x + 70}, ${ulY}, ${blk.x + blk.width - 30}, ${ulY}, {stroke:'${color.stroke}', roughness:3, strokeWidth:4, seed:${seed()}})`);

    // Layer 5: Tape mark at top-right corner
    const tapeX = blk.x + blk.width - 50;
    const tapeY = blk.y - 10;
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
      const starX = blk.x + blk.width - 60;
      const starY = blk.y + 60;
      const starPts = generateStarPoints(starX, starY, 30, 14, 5);
      roughCommands.push(`rc.polygon([${starPts.map(p => `[${Math.round(p[0])},${Math.round(p[1])}]`).join(',')}], {fill:'${color.stroke}', stroke:'${color.stroke}', fillStyle:'hachure', hachureGap:6, roughness:2, strokeWidth:3, seed:${seed()}})`);
    }
  }

  // ========== Speech bubbles (横並び、下部) ==========
  for (let i = 0; i < content.speechBubbles.length; i++) {
    const bubbleLayout = layout.speechBubbles[i];
    if (!bubbleLayout) break;
    const bubble = content.speechBubbles[i];
    const bubbleStroke = bubble.emphasis
      ? COLORS.emphasis[bubble.emphasis]
      : COLORS.speechBubble.stroke;

    roughCommands.push(`rc.ellipse(${bubbleLayout.x + bubbleLayout.width / 2}, ${bubbleLayout.y + bubbleLayout.height / 2}, ${bubbleLayout.width}, ${bubbleLayout.height}, {fill:'${COLORS.speechBubble.fill}', stroke:'${bubbleStroke}', fillStyle:'hachure', hachureGap:25, fillWeight:0.8, roughness:3, strokeWidth:5, bowing:2, seed:${seed()}})`);

    // Curved speech tail (上向き — ブロックの方を指す)
    const tailX = bubbleLayout.x + bubbleLayout.width * 0.45;
    const tailY = bubbleLayout.y + 10;
    roughCommands.push(`rc.curve([[${tailX}, ${tailY}], [${tailX - 10}, ${tailY - 25}], [${tailX - 30}, ${tailY - 50}]], {stroke:'${bubbleStroke}', roughness:2, strokeWidth:4, seed:${seed()}})`);
    roughCommands.push(`rc.curve([[${tailX + 35}, ${tailY}], [${tailX + 10}, ${tailY - 30}], [${tailX - 30}, ${tailY - 50}]], {stroke:'${bubbleStroke}', roughness:2, strokeWidth:4, seed:${seed()}})`);
  }

  // ========== Actions area ==========
  roughCommands.push(`rc.rectangle(${layout.actions.x}, ${layout.actions.y}, ${layout.actions.width}, ${layout.actions.height}, {fill:'${COLORS.actions.fill}', stroke:'${COLORS.actions.stroke}', fillStyle:'cross-hatch', hachureGap:30, fillWeight:0.8, roughness:3, strokeWidth:5, bowing:1.5, seed:${seed()}})`);

  // Actions heading underline
  roughCommands.push(`rc.line(${layout.actions.x + 20}, ${layout.actions.y + 70}, ${layout.actions.x + layout.actions.width - 20}, ${layout.actions.y + 70}, {stroke:'${COLORS.actions.stroke}', roughness:3, strokeWidth:4, seed:${seed()}})`);

  // ========== Connector: title → main message ==========
  const titleEndX = layout.title.x + layout.title.width + 10;
  const titleMidY = layout.title.y + layout.title.height / 2;
  const msgStartX = layout.mainMessage.x - 10;
  const msgMidY = layout.mainMessage.y + layout.mainMessage.height / 2;
  const ctrlX = (titleEndX + msgStartX) / 2;
  const ctrlY = titleMidY - 40;
  roughCommands.push(`rc.curve([[${titleEndX}, ${titleMidY}], [${ctrlX}, ${ctrlY}], [${msgStartX}, ${msgMidY}]], {stroke:'${COLORS.connector}', roughness:2, strokeWidth:4, bowing:2, seed:${seed()}})`);
  // Arrowhead
  roughCommands.push(`rc.line(${msgStartX}, ${msgMidY}, ${msgStartX - 25}, ${msgMidY - 18}, {stroke:'${COLORS.connector}', roughness:1.5, strokeWidth:4, seed:${seed()}})`);
  roughCommands.push(`rc.line(${msgStartX}, ${msgMidY}, ${msgStartX - 25}, ${msgMidY + 18}, {stroke:'${COLORS.connector}', roughness:1.5, strokeWidth:4, seed:${seed()}})`);

  // ========== Decorative elements ==========
  const decorSpots = [
    { x: layout.title.x + 80, y: layout.title.y - 10 },
    { x: CANVAS.width - 100, y: 80 },
    { x: CANVAS.width - 150, y: CANVAS.height - 100 },
  ];
  for (const spot of decorSpots) {
    const r = 10 + rand() * 15;
    roughCommands.push(`rc.circle(${spot.x}, ${spot.y}, ${Math.round(r * 2)}, {fill:'transparent', stroke:'${COLORS.decorationLight}', roughness:3, strokeWidth:2, seed:${seed()}})`);
  }

  // Flow arrows between blocks (relationship-aware)
  for (let i = 0; i < resolvedBlocks.length - 1; i++) {
    const relation = content.blocks[i]?.relationToNext ?? 'independent';
    if (relation === 'independent') continue;

    const from = resolvedBlocks[i];
    const to = resolvedBlocks[i + 1];
    const sameRow = Math.abs(from.y - to.y) < 100;

    const ax = sameRow ? from.x + from.width + 5 : from.x + from.width / 2;
    const ay = sameRow ? from.y + from.height / 2 : from.y + from.height + 5;
    const bx = sameRow ? to.x - 5 : to.x + to.width / 2;
    const by = sameRow ? to.y + to.height / 2 : to.y - 5;
    const mx = (ax + bx) / 2;
    const my = sameRow ? ay - 25 : (ay + by) / 2;

    if (relation === 'causes' || relation === 'builds-on') {
      // 太い曲線矢印
      roughCommands.push(`rc.curve([[${ax},${ay}],[${mx},${my}],[${bx},${by}]], {stroke:'${COLORS.connector}', roughness:2.5, strokeWidth:12, bowing:3, seed:${seed()}})`);
      const dx = bx - mx;
      const dy = by - my;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / len;
      const ny = dy / len;
      // 大きな矢じり
      roughCommands.push(`rc.line(${bx},${by},${bx - 45 * nx + 28 * ny},${by - 45 * ny - 28 * nx}, {stroke:'${COLORS.connector}', roughness:1.5, strokeWidth:12, seed:${seed()}})`);
      roughCommands.push(`rc.line(${bx},${by},${bx - 45 * nx - 28 * ny},${by - 45 * ny + 28 * nx}, {stroke:'${COLORS.connector}', roughness:1.5, strokeWidth:12, seed:${seed()}})`);
    } else if (relation === 'contrasts') {
      roughCommands.push(`rc.line(${ax},${ay},${bx},${by}, {stroke:'${COLORS.connector}', roughness:2.5, strokeWidth:10, strokeLineDash:[24,18], seed:${seed()}})`);
    } else if (relation === 'supports') {
      roughCommands.push(`rc.line(${ax},${ay},${bx},${by}, {stroke:'${COLORS.connector}', roughness:2.5, strokeWidth:8, strokeLineDash:[10,16], seed:${seed()}})`);
      roughCommands.push(`rc.circle(${mx},${my},24, {fill:'${COLORS.connector}', stroke:'${COLORS.connector}', fillStyle:'solid', roughness:1.5, strokeWidth:2, seed:${seed()}})`);
    }
  }

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
  left: ${layout.title.x}px;
  top: ${layout.title.y}px;
  width: ${layout.title.width}px;
  height: ${layout.title.height}px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${layout.title.fontSize}px;
  font-weight: 600;
  text-align: center;
  line-height: 1.15;
  padding: 0 50px;
  letter-spacing: 2px;
}
.main-message-text {
  position: absolute;
  left: ${layout.mainMessage.x}px;
  top: ${layout.mainMessage.y}px;
  width: ${layout.mainMessage.width}px;
  height: ${layout.mainMessage.height}px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${layout.mainMessage.fontSize}px;
  text-align: center;
  line-height: 1.2;
  padding: 0 30px;
}
.block-text {
  position: absolute;
  padding: ${layout.blockHeadingTopInset}px ${layout.blockBulletRightPadding}px ${layout.blockHeadingTopInset}px ${layout.blockBulletLeftPadding}px;
  overflow: hidden;
}
.block-zone-bg {
  position: absolute;
  background-size: cover;
  background-position: center;
  border-radius: 8px;
  overflow: hidden;
}
.block-zone-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 251, 235, 0.7);
}
.block-zone-bg .block-text {
  position: relative;
  width: 100%;
  height: 100%;
}
.block-heading {
  font-size: ${layout.blockHeadingFontSize}px;
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
  gap: 14px;
  font-size: ${layout.blockBulletFontSize}px;
  line-height: 1.7;
  margin-bottom: 6px;
}
.bullet-dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 3px solid;
  background: transparent;
  flex-shrink: 0;
  margin-top: 18px;
}
.block-number {
  position: absolute;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 38px;
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
  font-size: ${layout.speechBubbleFontSize}px;
  font-style: italic;
  line-height: 1.3;
  padding: 40px 50px;
}
.actions-text {
  position: absolute;
  left: ${layout.actions.x}px;
  top: ${layout.actions.y}px;
  width: ${layout.actions.width}px;
  height: ${layout.actions.height}px;
  padding: 20px 30px;
}
.actions-header {
  font-size: ${layout.actions.headerFontSize}px;
  font-weight: 600;
  margin-bottom: 20px;
  line-height: 1.2;
  padding-bottom: 10px;
}
.action-item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 20px;
  font-size: ${layout.actions.itemFontSize}px;
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
  const blk = resolvedBlocks[i];
  const color = COLORS.blocks[i];
  const illust = illustrations?.get(i);
  const zoneImg = zoneImages?.get(i);
  const circleX = blk.x + 35;
  const circleY = blk.y + 35;
  const blockContent = `<div class="block-heading" style="color:${color.stroke}">${escapeHtml(block.heading)}</div>
  ${illust ? `<img class="block-illustration" src="${illust}" alt="">` : ''}
  <ul class="block-bullet-list">
    ${block.bullets.map(b => `<li><span class="bullet-dot" style="border-color:${color.stroke}"></span>${escapeHtml(b.text)}</li>`).join('\n    ')}
  </ul>`;

  if (zoneImg) {
    return `<div class="block-number" style="left:${circleX - 30}px;top:${circleY - 30}px;">${i + 1}</div>
<div class="block-zone-bg" style="left:${blk.x}px;top:${blk.y}px;width:${blk.width}px;height:${blk.height}px;background-image:url(${zoneImg});">
  <div class="block-zone-overlay"></div>
  <div class="block-text">
    ${blockContent}
  </div>
</div>`;
  }

  return `<div class="block-number" style="left:${circleX - 30}px;top:${circleY - 30}px;">${i + 1}</div>
<div class="block-text" style="left:${blk.x}px;top:${blk.y}px;width:${blk.width}px;height:${blk.height}px;">
  ${blockContent}
</div>`;
}).join('\n')}

${content.speechBubbles.map((bubble, i) => {
  const bubbleLayout = layout.speechBubbles[i];
  if (!bubbleLayout) return '';
  return `<div class="bubble-text" style="left:${bubbleLayout.x}px;top:${bubbleLayout.y}px;width:${bubbleLayout.width}px;height:${bubbleLayout.height}px;">
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
