import { z } from 'zod';

export const chatInputSchema = z.object({
  message: z.string().trim().min(3).max(1600),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().trim().min(1).max(6000) }).strict()).max(6).default([]),
  symbols: z.array(z.string().max(30)).max(6).default([]),
}).strict().refine(value => value.history.reduce((sum, turn) => sum + turn.text.length, value.message.length) <= 10000, 'Conversation is too long. Start a new conversation.');

export const chatAnswerSchema = z.object({
  answer: z.string().min(1).max(6000),
  sourceIds: z.array(z.string().max(80)).max(12),
  followUps: z.array(z.string().min(3).max(180)).max(3),
  limitations: z.array(z.string().max(500)).max(6),
}).strict();

export const chatSourceSchema = z.object({
  id: z.string(), label: z.string(), provider: z.string(),
  asOf: z.string().nullable(), status: z.string(), url: z.string().nullable(),
});
export const chatResultSchema = chatAnswerSchema.extend({
  sources: z.array(chatSourceSchema), generatedAt: z.string(), cached: z.boolean(),
  engine: z.literal('gemini'), engineStatus: z.literal('available'),
});
export type ChatInput = z.infer<typeof chatInputSchema>;
export type ChatResult = z.infer<typeof chatResultSchema>;
export type ChatSource = z.infer<typeof chatSourceSchema>;
