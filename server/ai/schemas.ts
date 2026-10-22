import { z } from 'zod';

export const analysisInputSchema = z.object({
  headline: z.string().trim().min(5).max(2000),
  engine: z.enum(['gemini', 'finbert']),
  symbol: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9^&./:_-]+$/).transform(value => value.toUpperCase()).optional(),
}).strict();

const explanation = z.string().trim().min(1).max(2000);
const symbols = z.array(z.string().trim().min(1).max(32)).max(20);
const risks = z.array(z.string().trim().min(1).max(500)).min(1).max(8);

export const analysisOutputSchema = z.object({
  sentiment: z.enum(['Positive', 'Negative', 'Neutral']),
  signal: z.enum(['Buy', 'Sell', 'Hold']),
  confidence: z.number().finite().min(0).max(100),
  rationale: explanation,
  risks,
  affectedAssets: symbols,
}).strict().refine(value => ({ Positive: 'Buy', Negative: 'Sell', Neutral: 'Hold' }[value.sentiment] === value.signal), {
  message: 'Signal must represent the sentiment classification.',
});

export const finbertOutputSchema = z.array(z.object({
  label: z.enum(['positive', 'negative', 'neutral']),
  score: z.number().finite().min(0).max(1),
})).length(3).refine(rows => new Set(rows.map(row => row.label)).size === 3
  && Math.abs(rows.reduce((sum, row) => sum + row.score, 0) - 1) < 0.015, {
  message: 'FinBERT must return three distinct normalized class probabilities.',
});

export const geminiEnvelopeSchema = z.object({
  candidates: z.array(z.object({
    finishReason: z.string(),
    content: z.object({ parts: z.array(z.object({ text: z.string().optional(), thought: z.boolean().optional() })).min(1) }),
  })).min(1),
});

export type AnalysisInput = z.input<typeof analysisInputSchema>;
export type AnalysisResult = z.infer<typeof analysisOutputSchema> & {
  engine: 'gemini' | 'finbert';
  engineStatus: 'available';
  generatedAt: string;
  cached: boolean;
};

// Keep provider schemas explicit: Zod transformations/refinements are local checks,
// not JSON Schema features supported by every Gemini model.
export const analysisJsonSchema = {
  type: 'object',
  properties: {
    sentiment: { type: 'string', enum: ['Positive', 'Negative', 'Neutral'] },
    signal: { type: 'string', enum: ['Buy', 'Sell', 'Hold'] },
    confidence: { type: 'number', minimum: 0, maximum: 100 },
    rationale: { type: 'string' },
    risks: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 8 },
    affectedAssets: { type: 'array', items: { type: 'string' }, maxItems: 20 },
  },
  required: ['sentiment', 'signal', 'confidence', 'rationale', 'risks', 'affectedAssets'],
  additionalProperties: false,
};
