export const COLORS = {
  canvas: '#fffbeb',
  title: {
    fill: 'transparent',
    stroke: '#e8590c',
    bannerFill: '#fff0e0',
    bannerStroke: '#e8590c',
  },
  mainMessage: {
    fill: 'transparent',
    stroke: '#f08c00',
    accentLight: '#fff8e6',
  },
  blocks: [
    { fill: '#edf5ff', stroke: '#1971c2', hachure: '#a5d8ff' },
    { fill: '#edfbf0', stroke: '#2f9e44', hachure: '#b2f2bb' },
    { fill: '#f3f0ff', stroke: '#7048e8', hachure: '#d0bfff' },
    { fill: '#fff0f0', stroke: '#e03131', hachure: '#ffc9c9' },
  ],
  speechBubble: { fill: '#fffdf5', stroke: '#f59f00' },
  actions: { fill: '#faf8ff', stroke: '#7048e8' },
  text: '#212529',
  emphasis: {
    important: '#e03131',
    surprising: '#f08c00',
    humorous: '#2f9e44',
    inspiring: '#1971c2',
  },
  decorationLight: '#dee2e6',
  connector: '#495057',
  tape: '#e8d5a3',
} as const;
