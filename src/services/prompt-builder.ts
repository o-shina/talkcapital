import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import type { Config } from '../config/index.js';
import type { StructuredContent } from '../types/structured-content.js';

export interface PromptBuilderDependencies {
  client?: Pick<BedrockRuntimeClient, 'send'>;
}

export type ImageModelTarget = 'nova-canvas' | 'sd35-large';

export interface ImagePromptResult {
  prompt: string;
  negativePrompt: string;
}

export interface BlockImagePromptResult {
  blockIndex: number;
  prompt: string;
  negativePrompt: string;
}

/**
 * StructuredContent の具体的な内容から、画像生成用プロンプトを構築する。
 * Claude に各ブロックの内容を読ませ、描くべき具体的なイラスト・アイコンを抽出させる。
 */
export async function buildImagePrompt(
  content: StructuredContent,
  config: Config,
  deps: PromptBuilderDependencies = {},
  targetModel: ImageModelTarget = 'nova-canvas',
): Promise<ImagePromptResult> {
  const client = deps.client ?? new BedrockRuntimeClient({ region: config.bedrock.region });

  const contentSummary = formatContentForLLM(content);
  const systemPrompt = targetModel === 'sd35-large' ? SYSTEM_PROMPT_SD35 : SYSTEM_PROMPT;

  const command = new ConverseCommand({
    modelId: config.bedrock.modelId,
    system: [{ text: systemPrompt }],
    messages: [
      {
        role: 'user',
        content: [{ text: contentSummary }],
      },
    ],
  });

  const response = await client.send(command);
  const outputText = extractTextResponse(response.output?.message?.content as unknown[]);
  process.stderr.write(`[prompt-builder] Raw LLM response:\n${outputText}\n`);

  return parsePromptResponse(outputText);
}

/**
 * StructuredContent の各ブロックごとに画像生成用プロンプトを構築する。
 * 1回の LLM 呼び出しで全ブロック分を一括生成し、JSON 配列で返させる。
 */
export async function buildBlockImagePrompts(
  content: StructuredContent,
  config: Config,
  deps: PromptBuilderDependencies = {},
  targetModel: ImageModelTarget = 'nova-canvas',
): Promise<BlockImagePromptResult[]> {
  const client = deps.client ?? new BedrockRuntimeClient({ region: config.bedrock.region });

  const userMessage = formatBlocksForLLM(content);
  const systemPrompt = targetModel === 'sd35-large' ? ZONE_SYSTEM_PROMPT_SD35 : ZONE_SYSTEM_PROMPT_NOVA;

  const command = new ConverseCommand({
    modelId: config.bedrock.modelId,
    system: [{ text: systemPrompt }],
    messages: [
      {
        role: 'user',
        content: [{ text: userMessage }],
      },
    ],
  });

  const response = await client.send(command);
  const outputText = extractTextResponse(response.output?.message?.content as unknown[]);
  process.stderr.write(`[prompt-builder] Block prompts raw response:\n${outputText}\n`);

  return parseBlockPromptResponse(outputText);
}

function formatBlocksForLLM(content: StructuredContent): string {
  const blocks = content.blocks
    .map((b, i) => {
      const bullets = b.bullets.map((bl) => `  - ${bl.text}`).join('\n');
      return `ブロック${i + 1}「${b.heading}」:\n${bullets}`;
    })
    .join('\n\n');

  return `以下のグラフィックレコーディングの各ブロックについて、個別にゾーン画像用のプロンプトを生成してください。

講演タイトル: ${content.title}
メインメッセージ: ${content.mainMessage}
ブロック数: ${content.blocks.length}

${blocks}`;
}

function parseBlockPromptResponse(text: string): BlockImagePromptResult[] {
  // JSON 配列を抽出（```json ... ``` ブロックまたは直接 JSON）
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\[[\s\S]*\])/);
  if (!jsonMatch) {
    throw new Error('LLMレスポンスからブロックプロンプトのJSON配列を抽出できません');
  }

  const parsed = JSON.parse(jsonMatch[1].trim()) as Array<{
    blockIndex: number;
    prompt: string;
    negativePrompt: string;
  }>;

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('ブロックプロンプトのJSON配列が空です');
  }

  return parsed.map((item, i) => ({
    blockIndex: item.blockIndex ?? i,
    prompt: item.prompt,
    negativePrompt: item.negativePrompt ?? DEFAULT_NEGATIVE,
  }));
}

function formatContentForLLM(content: StructuredContent): string {
  const blocks = content.blocks
    .map((b, i) => {
      const bullets = b.bullets.map((bl) => `  - ${bl.text}`).join('\n');
      return `ブロック${i + 1}「${b.heading}」:\n${bullets}`;
    })
    .join('\n\n');

  const bubbles = content.speechBubbles.map((b) => `「${b.quote}」`).join('\n');

  const actions = content.actions.map((a) => `- ${a.text}`).join('\n');

  return `以下のグラフィックレコーディングの内容から、描くべきイラストを提案してください。

タイトル: ${content.title}
メインメッセージ: ${content.mainMessage}

${blocks}

印象的な発言:
${bubbles}

アクション:
${actions}`;
}

function extractTextResponse(content: unknown[]): string {
  for (const item of content) {
    const block = item as Record<string, unknown>;
    if (block.text && typeof block.text === 'string') {
      return block.text;
    }
  }
  throw new Error('Bedrockレスポンスにテキストが含まれていません');
}

function parsePromptResponse(text: string): ImagePromptResult {
  // PROMPT: と NEGATIVE: のセクションを抽出（改行あり/なし両対応）
  const promptMatch = text.match(/PROMPT:\s*([\s\S]*?)(?=\nNEGATIVE:|$)/);
  const negativeMatch = text.match(/NEGATIVE:\s*([\s\S]*?)(?=\n\n|$)/);

  if (!promptMatch) {
    throw new Error('LLMレスポンスからPROMPTセクションを抽出できません');
  }

  return {
    prompt: promptMatch[1].trim(),
    negativePrompt: negativeMatch ? negativeMatch[1].trim() : DEFAULT_NEGATIVE,
  };
}

const DEFAULT_NEGATIVE =
  'text, words, letters, alphabet, numbers, kanji, hiragana, katakana, korean, chinese, writing, handwriting, font, typography, calligraphy, whiteboard frame, whiteboard edge, board border, wall, room, desk, markers, pens, eraser, photograph, 3d object, shadow, perspective, neon, saturated, vivid, rainbow, cluttered, busy';

const SYSTEM_PROMPT_SD35 = `あなたは、グラフィックレコーディング用の画像生成プロンプトを作成するアシスタントです。

# タスク
講演の構造化データを受け取り、AI画像生成モデル（Stable Diffusion 3.5 Large）に渡す英語プロンプトを生成してください。

# 重要なルール
1. 講演内容に**実際に登場した具体的なモノ・シーン・人物の動き**をイラストのモチーフにする
   - 例: 「会議冒頭で安心を宣言」→ a person standing at a meeting table with hand raised, warm smile
   - 例: 「クラウド移行の課題」→ a cloud with a winding path leading to it, small figures carrying boxes
2. 抽象的・汎用的なアイコン（電球、歯車など）は、内容と直接関係がある場合のみ使う
3. **人物はデフォルメされたキャラクター**で描く（棒人間ではなく、丸い頭と簡略化された体を持つキャラクター）
4. **プロンプトに含めてはいけない表現**（これを破るとテキストが画像に描かれてしまう）:
   - "symbolizing ○○" "representing ○○" "indicating ○○" "depicting ○○" など意味説明 → 絶対禁止
   - "speech bubble with text" "thought bubble with words" → テキストが生成される。"empty speech balloon" を使う
   - 引用符で囲んだ英語テキスト（"Team Safety" など）→ そのまま画像にテキストとして描かれる。絶対禁止
   - "title" "banner" "label" "header" "caption" → テキスト要素が生成される。"decorated rectangular frame" 等で代替
   - 抽象概念の英単語（"safety" "communication" "failure" "psychological" "trust" "sharing" など）→ テキストとして描かれる
   - 代わりに、**身体のポーズと具体的な物体だけ**で表現する
   - プロンプトの最後に必ず "no text, no words, no letters, no numbers, no writing anywhere" を付ける
   - **概念名・テーマ名は一切使わない**。"about ○○" "related to ○○" も禁止

# 画像の構造要件
SD 3.5 Large は高品質な描画が可能なので、以下のリッチなグラレコレイアウトを指示すること：

- **スタイル**: professional graphic recording, hand-drawn illustration on white paper with colored markers and pens
- **レイアウト**: 画面全体に情報を密に配置
  - 左上に大きな装飾枠（リボン風バナー、中は空白）
  - 中央に3〜4個のコンテンツゾーン（手描き風の色付きボーダー: 青、緑、オレンジ、紫。内側は白）
  - 各ゾーンの近くに関連する**詳細なイラスト**（2〜3要素ずつ）
  - ゾーン間を曲線の矢印やフローラインで接続
  - 右側に空の吹き出し2〜3個（中は空白）
  - 右下に空のチェックボックス枠
  - 角にマスキングテープ風の装飾
- **色使い**: warm color palette, hand-drawn marker strokes, bold outlines with thin detail lines
- **イラスト密度**: 各ゾーンに2〜3個の具体的なイラスト。全体で10〜15個のイラスト要素
- **装飾**: 小さな星、矢印、番号付き丸、波線アンダーライン、ハイライトマーカー風の色帯
- テキスト・文字は**絶対に含めない**（テキストは後からオーバーレイする）

# 出力フォーマット
以下の形式で出力してください。補足説明は一切不要です。PROMPTとNEGATIVEのみ出力してください。

PROMPT:
（英語の画像生成プロンプト。改行なし1段落）

NEGATIVE:
（除外する要素。英語カンマ区切り。改行なし1段落）`;

const SYSTEM_PROMPT = `あなたは、グラフィックレコーディング用の画像生成プロンプトを作成するアシスタントです。

# タスク
講演の構造化データを受け取り、AI画像生成モデル（Amazon Nova Canvas）に渡す英語プロンプトを生成してください。

# 重要なルール
1. 講演内容に**実際に登場した具体的なモノ・シーン**をイラストのモチーフにする
   - 例: 「会議冒頭で安心を宣言」→ a small stick figure raising hand at a table
   - 例: 「クラウド移行の課題」→ a small cloud icon with an arrow
2. 抽象的・汎用的なアイコン（電球、歯車など）は、内容と直接関係がある場合のみ使う
3. イラストは各ゾーン枠線の隅に小さく添える程度。人物は棒人間（stick figure）で十分
4. **プロンプトに含めてはいけない表現**（これを破るとテキストが画像に描かれてしまう）:
   - "symbolizing ○○" "representing ○○" "indicating ○○" "showing ○○" "depicting ○○" など意味説明 → 絶対禁止
   - "speech bubble" "thought bubble" → 中にテキストが生成される。"empty oval outline" を使う
   - 抽象概念の英単語すべて（"communication" "dialogue" "message" "safety" "team" "failure" "question" "psychological" "welcoming" "sharing" "open" など）→ テキストとして描かれる
   - 代わりに、**身体のポーズと具体的な物体だけ**で表現する（例: "stick figure with arms spread wide", "two stick figures facing each other", "stick figure with one hand up"）
   - プロンプトの最後に必ず "absolutely no text anywhere in the image" を付ける
   - **概念名・テーマ名は一切使わない**。"about ○○" "related to ○○" も禁止

# 画像の構造要件（最重要）
以下の構造を必ずプロンプトに含めること：
- 白いフラットな背景が画面全体を覆う（ホワイトボードの縁・枠・壁は見えない）
- **3個の大きな空の長方形**が画面の主要構造（画面の60%以上を占める）
  - 各長方形は「太いマーカーの枠線だけ」で描かれ、内部は背景と同じ白のまま
  - 左上: 青い枠線、右上: 緑の枠線、左下: オレンジの枠線
- 各長方形の**外側**に、関連する小さな棒人間やアイコンを1つだけ配置
- 右側に2つの空の楕円アウトライン（内部は白）
- 右下に小さな四角い枠線
- ゾーン間を曲線の矢印で接続
- **スタイル**: シンプルなホワイトボードマーカーの線画。太い線、少ない要素、たっぷりの余白
- 水彩・ペイント・塗りつぶし・グラデーションは使わない
- テキスト・文字は**絶対に含めない**

# 出力フォーマット
以下の形式で出力してください。補足説明は一切不要です。PROMPTとNEGATIVEのみ出力してください。

PROMPT:
（英語の画像生成プロンプト。1024文字以内。改行なし1段落）

NEGATIVE:
（除外する要素。英語カンマ区切り。改行なし1段落）`;

// ============================================================
// ゾーン画像用システムプロンプト（ブロック単位の画像生成）
// ============================================================

const ZONE_COMMON_RULES = `
# 重要なルール
1. 講演内容に**実際に登場した具体的なモノ・シーン・人物の動き**をイラストのモチーフにする
   - 例: 「会議冒頭で安心を宣言」→ a person standing at a table with hand raised
   - 例: 「クラウド移行の課題」→ a cloud with a winding path, small figures carrying boxes
2. 抽象的・汎用的なアイコン（電球、歯車など）は、内容と直接関係がある場合のみ使う
3. **プロンプトに含めてはいけない表現**（テキストが画像に描かれてしまう）:
   - "symbolizing" "representing" "indicating" "depicting" → 絶対禁止
   - 引用符で囲んだ英語テキスト（"Team Safety" 等）→ 絶対禁止
   - "title" "banner" "label" "header" "caption" → 禁止
   - 抽象概念の英単語（"safety" "communication" "failure" "trust" 等）→ テキストとして描かれる
   - 代わりに**身体のポーズと具体的な物体だけ**で表現する
   - 各プロンプトの最後に必ず "no text, no words, no letters, no numbers, no writing anywhere" を付ける
   - **概念名・テーマ名は一切使わない**

# ゾーン画像の制約（最重要）
- この画像は大きなグラフィックレコーディングの**1ゾーン**として合成される
- **中央エリアは後からテキストを重ねるので、比較的シンプルに保つ**
- イラストは主に**辺縁・隅・端**に配置する
- 背景は温かみのある淡い色調（純白ではなく、ほんのりクリーム色）
- 全ゾーンで統一されたスタイル（同じ線の太さ、同じ色調のパレット）
- ゾーンの端は他のゾーンと接合されるため、端を装飾しすぎない`;

const ZONE_SYSTEM_PROMPT_NOVA = `あなたは、グラフィックレコーディングのゾーン画像用プロンプトを作成するアシスタントです。

# タスク
講演の各ブロック（トピック）ごとに、Amazon Nova Canvas 用の画像生成プロンプトを1つずつ生成してください。
各ゾーン画像は最終的に1つの大きなグラレコに合成されます。
${ZONE_COMMON_RULES}

# Nova Canvas 固有の注意
- 各プロンプトは**800文字以内**（改行なし1段落）
- スタイル: soft watercolor illustration, warm pastel tones, hand-drawn feel, gentle marker lines
- 人物は丸い頭と簡略化された体を持つキャラクター
- 各ゾーンに2〜3個の具体的なイラスト要素

# 出力フォーマット
以下のJSON配列を出力してください。補足説明は一切不要です。JSONのみ出力してください。

\`\`\`json
[
  {
    "blockIndex": 0,
    "prompt": "英語の画像生成プロンプト。改行なし1段落。800文字以内",
    "negativePrompt": "除外する要素。英語カンマ区切り"
  },
  ...
]
\`\`\``;

const ZONE_SYSTEM_PROMPT_SD35 = `あなたは、グラフィックレコーディングのゾーン画像用プロンプトを作成するアシスタントです。

# タスク
講演の各ブロック（トピック）ごとに、Stable Diffusion 3.5 Large 用の画像生成プロンプトを1つずつ生成してください。
各ゾーン画像は最終的に1つの大きなグラレコに合成されます。
${ZONE_COMMON_RULES}

# SD 3.5 Large 固有の注意
- スタイル: professional graphic recording, hand-drawn illustration with colored markers on white paper
- 人物はデフォルメされたキャラクター（丸い頭、簡略化された体）
- 各ゾーンに3〜4個の具体的でリッチなイラスト要素
- 色使い: warm color palette, bold outlines with thin detail lines

# 出力フォーマット
以下のJSON配列を出力してください。補足説明は一切不要です。JSONのみ出力してください。

\`\`\`json
[
  {
    "blockIndex": 0,
    "prompt": "英語の画像生成プロンプト。改行なし1段落",
    "negativePrompt": "除外する要素。英語カンマ区切り"
  },
  ...
]
\`\`\``;
