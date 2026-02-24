import { z } from 'zod';

const shortText = z.string().min(1).max(50);
const mediumText = z.string().min(1).max(80);

export const structuredContentSchema = z.object({
  title: z.string().min(1).max(30),
  mainMessage: mediumText,
  blocks: z
    .array(
      z.object({
        heading: shortText,
        bullets: z
          .array(
            z.object({
              text: shortText,
            }),
          )
          .min(1)
          .max(3),
        importance: z.enum(['high', 'medium', 'low']).optional(),
      }),
    )
    .min(3)
    .max(4),
  speechBubbles: z
    .array(
      z.object({
        quote: shortText,
        emphasis: z.enum(['important', 'surprising', 'humorous', 'inspiring']).optional(),
      }),
    )
    .min(1)
    .max(4),
  actions: z
    .array(
      z.object({
        text: shortText,
      }),
    )
    .length(3),
});

export type StructuredContent = z.infer<typeof structuredContentSchema>;

// ストリーミング中間スキーマ（途中テキスト前提で制約を緩和）
export const interimStructuredContentSchema = z.object({
  title: z.string().min(1).max(30),
  mainMessage: mediumText,
  blocks: z
    .array(
      z.object({
        heading: shortText,
        bullets: z
          .array(
            z.object({
              text: shortText,
            }),
          )
          .min(1)
          .max(3),
        importance: z.enum(['high', 'medium', 'low']).optional(),
      }),
    )
    .min(1)
    .max(4),
  speechBubbles: z
    .array(
      z.object({
        quote: shortText,
        emphasis: z.enum(['important', 'surprising', 'humorous', 'inspiring']).optional(),
      }),
    )
    .min(0)
    .max(4),
  actions: z
    .array(
      z.object({
        text: shortText,
      }),
    )
    .min(0)
    .max(3),
});

export type InterimStructuredContent = z.infer<typeof interimStructuredContentSchema>;

export function getInterimStructuredContentJsonSchema(): Record<string, unknown> {
  return {
    type: 'object',
    required: ['title', 'mainMessage', 'blocks', 'speechBubbles', 'actions'],
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 30 },
      mainMessage: { type: 'string', minLength: 1, maxLength: 80 },
      blocks: {
        type: 'array',
        minItems: 1,
        maxItems: 4,
        items: {
          type: 'object',
          required: ['heading', 'bullets'],
          properties: {
            heading: { type: 'string', minLength: 1, maxLength: 50 },
            bullets: {
              type: 'array',
              minItems: 1,
              maxItems: 3,
              items: {
                type: 'object',
                required: ['text'],
                properties: {
                  text: { type: 'string', minLength: 1, maxLength: 50 },
                },
                additionalProperties: false,
              },
            },
            importance: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
            },
          },
          additionalProperties: false,
        },
      },
      speechBubbles: {
        type: 'array',
        minItems: 0,
        maxItems: 4,
        items: {
          type: 'object',
          required: ['quote'],
          properties: {
            quote: { type: 'string', minLength: 1, maxLength: 50 },
            emphasis: {
              type: 'string',
              enum: ['important', 'surprising', 'humorous', 'inspiring'],
            },
          },
          additionalProperties: false,
        },
      },
      actions: {
        type: 'array',
        minItems: 0,
        maxItems: 3,
        items: {
          type: 'object',
          required: ['text'],
          properties: {
            text: { type: 'string', minLength: 1, maxLength: 50 },
          },
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
  };
}

export function getStructuredContentJsonSchema(): Record<string, unknown> {
  return {
    type: 'object',
    required: ['title', 'mainMessage', 'blocks', 'speechBubbles', 'actions'],
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 30 },
      mainMessage: { type: 'string', minLength: 1, maxLength: 80 },
      blocks: {
        type: 'array',
        minItems: 3,
        maxItems: 4,
        items: {
          type: 'object',
          required: ['heading', 'bullets'],
          properties: {
            heading: { type: 'string', minLength: 1, maxLength: 50 },
            bullets: {
              type: 'array',
              minItems: 1,
              maxItems: 3,
              items: {
                type: 'object',
                required: ['text'],
                properties: {
                  text: { type: 'string', minLength: 1, maxLength: 50 },
                },
                additionalProperties: false,
              },
            },
            importance: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
            },
          },
          additionalProperties: false,
        },
      },
      speechBubbles: {
        type: 'array',
        minItems: 1,
        maxItems: 4,
        items: {
          type: 'object',
          required: ['quote'],
          properties: {
            quote: { type: 'string', minLength: 1, maxLength: 50 },
            emphasis: {
              type: 'string',
              enum: ['important', 'surprising', 'humorous', 'inspiring'],
            },
          },
          additionalProperties: false,
        },
      },
      actions: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        items: {
          type: 'object',
          required: ['text'],
          properties: {
            text: { type: 'string', minLength: 1, maxLength: 50 },
          },
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
  };
}
