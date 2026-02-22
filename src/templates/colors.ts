export const COLORS = {
  canvas: '#fffbeb',
  title: { fill: '#ffd8a8', stroke: '#e8590c' },
  mainMessage: { fill: '#fff3bf', stroke: '#f08c00' },
  blocks: [
    { fill: '#a5d8ff', stroke: '#1971c2' },
    { fill: '#b2f2bb', stroke: '#2f9e44' },
    { fill: '#d0bfff', stroke: '#7048e8' },
    { fill: '#ffc9c9', stroke: '#e03131' },
  ],
  speechBubble: { fill: '#fff9db', stroke: '#f59f00' },
  actions: { fill: '#f3f0ff', stroke: '#7048e8' },
  text: '#212529',
} as const;

export const STYLE = {
  roughness: 1,
  fontFamily: 1,
  strokeWidth: 2,
} as const;
