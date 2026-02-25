export const CANVAS = {
  width: 3840,
  height: 2160,
} as const;

// ========== 動的レイアウト ==========
// ブロック数・吹き出し数に応じてレイアウトを動的に計算する

const PADDING = 50;
const GAP = 110;

export interface DynamicLayout {
  title: { x: number; y: number; width: number; height: number; fontSize: number };
  mainMessage: { x: number; y: number; width: number; height: number; fontSize: number };
  blocks: Array<{ x: number; y: number; width: number; height: number }>;
  blockHeadingFontSize: number;
  blockBulletFontSize: number;
  blockHeadingHeight: number;
  blockHeadingTopInset: number;
  blockBulletTopOffset: number;
  blockBulletLineHeight: number;
  blockBulletLeftPadding: number;
  blockBulletRightPadding: number;
  speechBubbles: Array<{ x: number; y: number; width: number; height: number }>;
  speechBubbleFontSize: number;
  actions: { x: number; y: number; width: number; height: number; headerFontSize: number; itemFontSize: number };
}

export function computeLayout(blockCount: number, bubbleCount: number): DynamicLayout {
  const contentW = CANVAS.width - PADDING * 2; // 3740

  // タイトル行
  const TITLE_H = 140;
  const TITLE_W = 1400;

  // ブロックグリッド計算
  const blockRows = blockCount <= 2 ? 1 : 2;
  const blockH = blockRows === 1 ? 780 : 580;
  const blocksH = blockH * blockRows + GAP * (blockRows - 1);

  // 下部エリア（吹き出し + アクション）
  const BOTTOM_H = 350;

  // 全体を垂直方向にセンタリング
  const totalContentH = TITLE_H + GAP + blocksH + GAP + BOTTOM_H;
  const topOffset = Math.max(PADDING, Math.floor((CANVAS.height - totalContentH) / 2));

  const titleY = topOffset;
  const blockStartY = topOffset + TITLE_H + GAP;
  const bottomY = blockStartY + blocksH + GAP;

  // ブロック座標
  const blocks = computeBlockPositions(blockCount, PADDING, blockStartY, contentW, blockH, GAP);

  // 吹き出し: 下部左側に横並び（~63%幅）
  const bubbleAreaW = Math.floor(contentW * 0.63);
  const effectiveBubbleCount = Math.min(bubbleCount, 4);
  const bubbleW = effectiveBubbleCount > 0
    ? Math.floor((bubbleAreaW - GAP * (effectiveBubbleCount - 1)) / effectiveBubbleCount)
    : 0;

  const speechBubbles: Array<{ x: number; y: number; width: number; height: number }> = [];
  for (let i = 0; i < effectiveBubbleCount; i++) {
    speechBubbles.push({
      x: PADDING + i * (bubbleW + GAP),
      y: bottomY,
      width: bubbleW,
      height: BOTTOM_H,
    });
  }

  // アクション: 下部右側（~35%幅）
  const actionsX = PADDING + bubbleAreaW + GAP;
  const actionsW = contentW - bubbleAreaW - GAP;

  return {
    title: { x: PADDING, y: titleY, width: TITLE_W, height: TITLE_H, fontSize: 76 },
    mainMessage: {
      x: PADDING + TITLE_W + GAP,
      y: titleY,
      width: CANVAS.width - PADDING * 2 - TITLE_W - GAP,
      height: TITLE_H,
      fontSize: 48,
    },
    blocks,
    blockHeadingFontSize: 54,
    blockBulletFontSize: 36,
    blockHeadingHeight: 90,
    blockHeadingTopInset: 30,
    blockBulletTopOffset: 120,
    blockBulletLineHeight: 100,
    blockBulletLeftPadding: 80,
    blockBulletRightPadding: 40,
    speechBubbles,
    speechBubbleFontSize: 36,
    actions: {
      x: actionsX,
      y: bottomY,
      width: actionsW,
      height: BOTTOM_H,
      headerFontSize: 48,
      itemFontSize: 36,
    },
  };
}

function computeBlockPositions(
  blockCount: number,
  padding: number,
  startY: number,
  contentW: number,
  blockH: number,
  gap: number,
): Array<{ x: number; y: number; width: number; height: number }> {
  const blocks: Array<{ x: number; y: number; width: number; height: number }> = [];

  if (blockCount === 1) {
    // 1 ブロック: 全幅
    blocks.push({ x: padding, y: startY, width: contentW, height: blockH });
  } else if (blockCount === 2) {
    // 2 ブロック: 横並び
    const w = Math.floor((contentW - gap) / 2);
    blocks.push({ x: padding, y: startY, width: w, height: blockH });
    blocks.push({ x: padding + w + gap, y: startY, width: w, height: blockH });
  } else if (blockCount === 3) {
    // 3 ブロック: 上段2 + 下段1（中央寄せ）
    const w2 = Math.floor((contentW - gap) / 2);
    blocks.push({ x: padding, y: startY, width: w2, height: blockH });
    blocks.push({ x: padding + w2 + gap, y: startY, width: w2, height: blockH });
    const row2Y = startY + blockH + gap;
    const centerX = padding + Math.floor((contentW - w2) / 2);
    blocks.push({ x: centerX, y: row2Y, width: w2, height: blockH });
  } else if (blockCount === 4) {
    // 4 ブロック: 2×2
    const w2 = Math.floor((contentW - gap) / 2);
    blocks.push({ x: padding, y: startY, width: w2, height: blockH });
    blocks.push({ x: padding + w2 + gap, y: startY, width: w2, height: blockH });
    const row2Y = startY + blockH + gap;
    blocks.push({ x: padding, y: row2Y, width: w2, height: blockH });
    blocks.push({ x: padding + w2 + gap, y: row2Y, width: w2, height: blockH });
  } else {
    // 5+ ブロック: 上段3 + 下段2（残り）
    const w3 = Math.floor((contentW - gap * 2) / 3);
    const topCount = Math.min(3, blockCount);
    for (let i = 0; i < topCount; i++) {
      blocks.push({ x: padding + i * (w3 + gap), y: startY, width: w3, height: blockH });
    }
    const bottomCount = blockCount - topCount;
    if (bottomCount > 0) {
      const row2Y = startY + blockH + gap;
      const w2 = Math.floor((contentW - gap) / 2);
      if (bottomCount === 1) {
        const centerX = padding + Math.floor((contentW - w2) / 2);
        blocks.push({ x: centerX, y: row2Y, width: w2, height: blockH });
      } else {
        for (let i = 0; i < Math.min(bottomCount, 3); i++) {
          blocks.push({ x: padding + i * (w2 + gap), y: row2Y, width: w2, height: blockH });
        }
      }
    }
  }

  return blocks;
}

// ========== 後方互換 ==========
// 既存コード（テスト等）が LAYOUT を直接参照している場合の互換エクスポート
export const LAYOUT = computeLayout(4, 4);
