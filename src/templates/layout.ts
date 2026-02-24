export const CANVAS = {
  width: 3840,
  height: 2160,
} as const;

// 全体レイアウト:
// 上部: タイトル + メインメッセージ (横並び)
// 中央: 4ブロック (2x2グリッド)
// 右側: 吹き出し (縦並び)
// 下部: アクションエリア

const PADDING = 40;
const BLOCK_GAP = 30;

// タイトル行
const TITLE_H = 100;

// ブロックエリア (左側 2/3)
const BLOCKS_AREA_W = 2400;
const BLOCK_W = (BLOCKS_AREA_W - BLOCK_GAP) / 2; // ~1185
const BLOCK_H = 560;

// 吹き出しエリア (右側 1/3)
const BUBBLE_AREA_X = PADDING + BLOCKS_AREA_W + 60;
const BUBBLE_W = 3840 - BUBBLE_AREA_X - PADDING; // ~1300
const BUBBLE_H = 180;
const BUBBLE_GAP = 30;

// アクションエリア
const ACTIONS_Y = PADDING + TITLE_H + BLOCK_GAP + BLOCK_H * 2 + BLOCK_GAP * 2 + 20;

export const LAYOUT = {
  title: {
    x: PADDING,
    y: PADDING,
    width: 1200,
    height: TITLE_H,
    fontSize: 48,
    textAlign: 'center' as const,
  },
  mainMessage: {
    x: PADDING + 1200 + BLOCK_GAP,
    y: PADDING,
    width: 3840 - PADDING * 2 - 1200 - BLOCK_GAP,
    height: TITLE_H,
    fontSize: 36,
    textAlign: 'center' as const,
  },
  blocks: [
    {
      x: PADDING,
      y: PADDING + TITLE_H + BLOCK_GAP,
      width: BLOCK_W,
      height: BLOCK_H,
    },
    {
      x: PADDING + BLOCK_W + BLOCK_GAP,
      y: PADDING + TITLE_H + BLOCK_GAP,
      width: BLOCK_W,
      height: BLOCK_H,
    },
    {
      x: PADDING,
      y: PADDING + TITLE_H + BLOCK_GAP + BLOCK_H + BLOCK_GAP,
      width: BLOCK_W,
      height: BLOCK_H,
    },
    {
      x: PADDING + BLOCK_W + BLOCK_GAP,
      y: PADDING + TITLE_H + BLOCK_GAP + BLOCK_H + BLOCK_GAP,
      width: BLOCK_W,
      height: BLOCK_H,
    },
  ],
  // 見出しはブロック上部に配置、箇条書きはその下
  blockHeading: {
    height: 60,
    fontSize: 32,
    topInset: 16,
  },
  blockBullet: {
    fontSize: 26,
    lineHeight: 70,
    topOffset: 80,   // 見出しの下からのオフセット
    leftPadding: 30,
    rightPadding: 30,
  },
  speechBubbles: [
    { x: BUBBLE_AREA_X, y: PADDING + TITLE_H + BLOCK_GAP, width: BUBBLE_W, height: BUBBLE_H },
    { x: BUBBLE_AREA_X, y: PADDING + TITLE_H + BLOCK_GAP + (BUBBLE_H + BUBBLE_GAP), width: BUBBLE_W, height: BUBBLE_H },
    { x: BUBBLE_AREA_X, y: PADDING + TITLE_H + BLOCK_GAP + (BUBBLE_H + BUBBLE_GAP) * 2, width: BUBBLE_W, height: BUBBLE_H },
    { x: BUBBLE_AREA_X, y: PADDING + TITLE_H + BLOCK_GAP + (BUBBLE_H + BUBBLE_GAP) * 3, width: BUBBLE_W, height: BUBBLE_H },
  ],
  actions: {
    x: BUBBLE_AREA_X,
    y: PADDING + TITLE_H + BLOCK_GAP + (BUBBLE_H + BUBBLE_GAP) * 4 + 20,
    width: BUBBLE_W,
    height: 450,
    headerFontSize: 36,
    itemFontSize: 28,
  },
} as const;
