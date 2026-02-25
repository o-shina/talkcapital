import type { StructuredContent } from '../types/structured-content.js';

/**
 * コンテンツ文字列からシンプルなハッシュ値を生成する（決定論的）
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash);
}

/**
 * シード付き疑似乱数生成器（xorshift32）
 * 同じシードからは常に同じ数列が生成される
 */
export function seededRandom(seed: number): () => number {
  let state = seed | 1; // 0を避ける
  return () => {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

/**
 * ブロックのレイアウト座標（重要度・ジッター適用済み）
 */
export interface ResolvedBlockLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number; // ラジアン
}

/**
 * コンテンツに基づいてブロックレイアウトを解決する
 * - importanceによるサイズ変動
 * - シード付きランダムによる微小ジッター
 */
export function resolveBlockLayouts(
  content: StructuredContent,
  baseBlocks: readonly { readonly x: number; readonly y: number; readonly width: number; readonly height: number }[],
): ResolvedBlockLayout[] {
  const hashStr = content.title + content.mainMessage + content.blocks.map((b) => b.heading).join('');
  const rand = seededRandom(simpleHash(hashStr));

  return baseBlocks.map((base, i) => {
    const block = content.blocks[i];
    const importance = block?.importance ?? 'medium';

    // 重要度によるサイズスケール（ギャップ40pxに収まるよう控えめに）
    const scale = importance === 'high' ? 1.02 : importance === 'low' ? 0.98 : 1.0;
    const width = Math.round(base.width * scale);
    const height = Math.round(base.height * scale);

    // サイズ変更分の位置オフセット（中心を維持）
    const dx = Math.round((base.width - width) / 2);
    const dy = Math.round((base.height - height) / 2);

    // 微小ジッター（±2px位置、±0.008rad≈±0.46度回転）
    const jitterX = Math.round((rand() - 0.5) * 4);
    const jitterY = Math.round((rand() - 0.5) * 4);
    const angle = (rand() - 0.5) * 0.016;

    return {
      x: base.x + dx + jitterX,
      y: base.y + dy + jitterY,
      width,
      height,
      angle,
    };
  });
}
