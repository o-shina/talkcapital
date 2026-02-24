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

  const hashStr = content.title + content.mainMessage;
  let hashVal = 0;
  for (let i = 0; i < hashStr.length; i++) {
    hashVal = ((hashVal << 5) - hashVal + hashStr.charCodeAt(i)) | 0;
  }
  const rand = seededRandom(Math.abs(hashVal) + 42);

  // Build rough.js draw commands as JSON for client-side execution
  const roughCommands: string[] = [];

  // Title box
  roughCommands.push(`rc.rectangle(${LAYOUT.title.x}, ${LAYOUT.title.y}, ${LAYOUT.title.width}, ${LAYOUT.title.height}, {fill:'${COLORS.title.fill}', stroke:'${COLORS.title.stroke}', fillStyle:'solid', roughness:2.5, strokeWidth:3, seed:${Math.floor(rand() * 100000)}})`);

  // Main message box
  roughCommands.push(`rc.rectangle(${LAYOUT.mainMessage.x}, ${LAYOUT.mainMessage.y}, ${LAYOUT.mainMessage.width}, ${LAYOUT.mainMessage.height}, {fill:'${COLORS.mainMessage.fill}', stroke:'${COLORS.mainMessage.stroke}', fillStyle:'solid', roughness:2, strokeWidth:2.5, seed:${Math.floor(rand() * 100000)}})`);

  // Blocks
  for (let i = 0; i < resolvedBlocks.length; i++) {
    const layout = resolvedBlocks[i];
    const color = COLORS.blocks[i];
    roughCommands.push(`rc.rectangle(${layout.x}, ${layout.y}, ${layout.width}, ${layout.height}, {fill:'${color.fill}', stroke:'${color.stroke}', fillStyle:'solid', roughness:2.5, strokeWidth:2.5, seed:${Math.floor(rand() * 100000)}})`);

    // Block heading underline (hand-drawn)
    const ulY = layout.y + 80;
    roughCommands.push(`rc.line(${layout.x + 20}, ${ulY}, ${layout.x + layout.width - 20}, ${ulY}, {stroke:'${color.stroke}', roughness:3, strokeWidth:3, seed:${Math.floor(rand() * 100000)}})`);

    // Bullet markers are rendered inline in HTML (not SVG) to align with text flow
  }

  // Speech bubbles
  for (let i = 0; i < content.speechBubbles.length; i++) {
    const layout = LAYOUT.speechBubbles[i];
    if (!layout) break;
    const bubble = content.speechBubbles[i];
    const bubbleStroke = bubble.emphasis
      ? COLORS.emphasis[bubble.emphasis]
      : COLORS.speechBubble.stroke;
    roughCommands.push(`rc.ellipse(${layout.x + layout.width / 2}, ${layout.y + layout.height / 2}, ${layout.width}, ${layout.height}, {fill:'${COLORS.speechBubble.fill}', stroke:'${bubbleStroke}', fillStyle:'solid', roughness:2, strokeWidth:2.5, seed:${Math.floor(rand() * 100000)}})`);

    // Speech tail
    const tx = layout.x + layout.width * 0.35;
    const ty = layout.y + layout.height - 10;
    roughCommands.push(`rc.line(${tx}, ${ty}, ${tx - 20}, ${ty + 40}, {stroke:'${bubbleStroke}', roughness:2, strokeWidth:2, seed:${Math.floor(rand() * 100000)}})`);
    roughCommands.push(`rc.line(${tx + 30}, ${ty}, ${tx - 20}, ${ty + 40}, {stroke:'${bubbleStroke}', roughness:2, strokeWidth:2, seed:${Math.floor(rand() * 100000)}})`);
  }

  // Actions area
  roughCommands.push(`rc.rectangle(${LAYOUT.actions.x}, ${LAYOUT.actions.y}, ${LAYOUT.actions.width}, ${LAYOUT.actions.height}, {fill:'${COLORS.actions.fill}', stroke:'${COLORS.actions.stroke}', fillStyle:'solid', roughness:2, strokeWidth:2, seed:${Math.floor(rand() * 100000)}})`);

  // Actions underline
  roughCommands.push(`rc.line(${LAYOUT.actions.x + 20}, ${LAYOUT.actions.y + 60}, ${LAYOUT.actions.x + LAYOUT.actions.width - 20}, ${LAYOUT.actions.y + 60}, {stroke:'${COLORS.actions.stroke}', roughness:2, strokeWidth:2, seed:${Math.floor(rand() * 100000)}})`);

  // Action checkboxes are rendered inline in HTML (not SVG) to align with text flow

  // Connector arrows (hand-drawn)
  const titleEndX = LAYOUT.title.x + LAYOUT.title.width + 10;
  const titleMidY = LAYOUT.title.y + LAYOUT.title.height / 2;
  const msgStartX = LAYOUT.mainMessage.x - 10;
  const msgMidY = LAYOUT.mainMessage.y + LAYOUT.mainMessage.height / 2;
  roughCommands.push(`rc.line(${titleEndX}, ${titleMidY}, ${msgStartX}, ${msgMidY}, {stroke:'${COLORS.connector}', roughness:1.5, strokeWidth:2.5, seed:${Math.floor(rand() * 100000)}})`);
  // Arrowhead
  roughCommands.push(`rc.line(${msgStartX}, ${msgMidY}, ${msgStartX - 20}, ${msgMidY - 15}, {stroke:'${COLORS.connector}', roughness:1, strokeWidth:2.5, seed:${Math.floor(rand() * 100000)}})`);
  roughCommands.push(`rc.line(${msgStartX}, ${msgMidY}, ${msgStartX - 20}, ${msgMidY + 15}, {stroke:'${COLORS.connector}', roughness:1, strokeWidth:2.5, seed:${Math.floor(rand() * 100000)}})`);

  // Vertical divider line
  const divX = LAYOUT.blocks[0].x + LAYOUT.blocks[0].width * 2 + 120;
  roughCommands.push(`rc.line(${divX}, ${LAYOUT.title.y + LAYOUT.title.height + 20}, ${divX}, ${CANVAS.height - 50}, {stroke:'${COLORS.decorationLight}', roughness:2, strokeWidth:1.5, seed:${Math.floor(rand() * 100000)}, strokeLineDash:[20,15]})`);

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
.text-overlay {
  position: absolute;
  pointer-events: none;
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
  font-size: 48px;
  font-weight: 600;
  text-align: center;
  line-height: 1.15;
  padding: 0 20px;
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
  margin-bottom: 12px;
  line-height: 1.2;
  padding-bottom: 8px;
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
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 14px;
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
}
.action-checkbox {
  display: inline-block;
  width: 32px;
  height: 32px;
  border: 2.5px solid ${COLORS.actions.stroke};
  border-radius: 3px;
  flex-shrink: 0;
  margin-top: 4px;
  transform: rotate(-1deg);
}
</style>
</head>
<body>

<!-- rough.js draws all shapes here -->
<svg id="rough-canvas" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}"></svg>

<!-- Text overlays (crisp text on top of sketchy shapes) -->
<div class="title-text">${escapeHtml(content.title)}</div>
<div class="main-message-text">${escapeHtml(content.mainMessage)}</div>

${content.blocks.map((block, i) => {
  const layout = resolvedBlocks[i];
  const color = COLORS.blocks[i];
  const illust = illustrations?.get(i);
  return `<div class="block-text" style="left:${layout.x}px;top:${layout.y}px;width:${layout.width}px;height:${layout.height}px;">
  <div class="block-heading" style="color:${color.stroke}">${escapeHtml(block.heading)}</div>
  ${illust ? `<img class="block-illustration" src="${illust}" alt="">` : ''}
  <ul class="block-bullet-list">
    ${block.bullets.map(b => `<li><span class="bullet-dot" style="background:${color.stroke}"></span>${escapeHtml(b.text)}</li>`).join('\n    ')}
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
  ${content.actions.map(action => `<div class="action-item"><span class="action-checkbox"></span>${escapeHtml(action.text)}</div>`).join('\n  ')}
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
