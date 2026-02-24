export const CANVAS = {
  width: 3840,
  height: 2160,
} as const;

// 全体レイアウト:
// 上部: タイトル + メインメッセージ (横並び)
// 中央: 4ブロック (2x2グリッド)
// 右側: 吹き出し (縦並び) + アクション

const PADDING = 50;
const GAP = 40;

// タイトル行
const TITLE_H = 120;

// ブロックエリア (左側 ~63%)
const BLOCKS_AREA_W = 2400;
const BLOCK_W = (BLOCKS_AREA_W - GAP) / 2; // ~1180
const BLOCK_H = 600;

// 吹き出しエリア (右側)
const BUBBLE_AREA_X = PADDING + BLOCKS_AREA_W + 80;
const BUBBLE_W = 3840 - BUBBLE_AREA_X - PADDING;
const BUBBLE_H = 200;
const BUBBLE_GAP = 40;

export const LAYOUT = {
  title: {
    x: PADDING,
    y: PADDING,
    width: 1200,
    height: TITLE_H,
    fontSize: 52,
    textAlign: 'center' as const,
  },
  mainMessage: {
    x: PADDING + 1200 + GAP,
    y: PADDING,
    width: 3840 - PADDING * 2 - 1200 - GAP,
    height: TITLE_H,
    fontSize: 36,
    textAlign: 'center' as const,
  },
  blocks: [
    {
      x: PADDING,
      y: PADDING + TITLE_H + GAP,
      width: BLOCK_W,
      height: BLOCK_H,
    },
    {
      x: PADDING + BLOCK_W + GAP,
      y: PADDING + TITLE_H + GAP,
      width: BLOCK_W,
      height: BLOCK_H,
    },
    {
      x: PADDING,
      y: PADDING + TITLE_H + GAP + BLOCK_H + GAP,
      width: BLOCK_W,
      height: BLOCK_H,
    },
    {
      x: PADDING + BLOCK_W + GAP,
      y: PADDING + TITLE_H + GAP + BLOCK_H + GAP,
      width: BLOCK_W,
      height: BLOCK_H,
    },
  ],
  /** ブロック内のフォントサイズ */
  blockHeadingFontSize: 36,
  blockBulletFontSize: 26,
  /** ブロック内部のレイアウト定数 */
  blockHeadingHeight: 70,
  blockHeadingTopInset: 20,
  blockBulletTopOffset: 100,
  blockBulletLineHeight: 80,
  blockBulletLeftPadding: 36,
  blockBulletRightPadding: 36,
  speechBubbles: [
    { x: BUBBLE_AREA_X, y: PADDING + TITLE_H + GAP, width: BUBBLE_W, height: BUBBLE_H },
    { x: BUBBLE_AREA_X, y: PADDING + TITLE_H + GAP + (BUBBLE_H + BUBBLE_GAP), width: BUBBLE_W, height: BUBBLE_H },
    { x: BUBBLE_AREA_X, y: PADDING + TITLE_H + GAP + (BUBBLE_H + BUBBLE_GAP) * 2, width: BUBBLE_W, height: BUBBLE_H },
    { x: BUBBLE_AREA_X, y: PADDING + TITLE_H + GAP + (BUBBLE_H + BUBBLE_GAP) * 3, width: BUBBLE_W, height: BUBBLE_H },
  ],
  speechBubbleFontSize: 26,
  actions: {
    x: BUBBLE_AREA_X,
    y: PADDING + TITLE_H + GAP + (BUBBLE_H + BUBBLE_GAP) * 4 + 30,
    width: BUBBLE_W,
    height: 500,
    headerFontSize: 36,
    itemFontSize: 28,
  },
} as const;
