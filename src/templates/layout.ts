export const CANVAS = {
  width: 1920,
  height: 1080,
} as const;

export const LAYOUT = {
  title: { x: 30, y: 20, width: 580, height: 80, fontSize: 42, textAlign: 'center' as const },
  mainMessage: {
    x: 640,
    y: 20,
    width: 1250,
    height: 80,
    fontSize: 28,
    textAlign: 'center' as const,
  },
  blocks: [
    { x: 30, y: 140, width: 420, height: 320 },
    { x: 480, y: 140, width: 420, height: 320 },
    { x: 30, y: 500, width: 420, height: 320 },
    { x: 480, y: 500, width: 420, height: 320 },
  ],
  /** ブロック内のフォントサイズ */
  blockHeadingFontSize: 30,
  blockBulletFontSize: 20,
  speechBubbles: [
    { x: 940, y: 140, width: 430, height: 120 },
    { x: 1420, y: 140, width: 430, height: 120 },
    { x: 940, y: 290, width: 430, height: 120 },
    { x: 1420, y: 290, width: 430, height: 120 },
  ],
  speechBubbleFontSize: 24,
  actions: { x: 940, y: 460, width: 910, height: 360, headerFontSize: 30, itemFontSize: 22 },
} as const;
