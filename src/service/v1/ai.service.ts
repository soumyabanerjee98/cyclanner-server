import {
  buildAdjustmentPrompt,
  buildCoachingPrompt,
} from '@/prompts/coach.prompts.js';
import { safeParse } from '@/utils/ai.util.js';
import {
  adjustedPlanSchema,
  coachInsightsSchema,
} from '@/validator/ai.validator.js';
import 'dotenv/config';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export const callAI = async (
  messages: { role: 'system' | 'user'; content: string }[],
  temperature: number,
) => {
  const completion = await groq.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    messages,
    temperature,
  });

  return completion.choices[0]?.message?.content || '';
};

export const generateCoachInsights = async (
  input: CoachInput,
  maxRetries: number = 0,
) => {
  const prompt = buildCoachingPrompt(input);
  let retries = 0;
  let raw = '';
  do {
    try {
      raw = await callAI(
        [
          {
            role: 'system',
            content:
              'You are a professional cycling coach. Give concise, actionable advice.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        0.7,
      );
      console.log('Raw Coach Insights: ', raw);

      const parsed = safeParse(raw);

      const validated = coachInsightsSchema.safeParse(parsed);
      if (validated.success) {
        console.log('AI Generate Coach Insights successful.');
        return { type: 'json', value: validated.data };
      }
      console.warn(
        `AI Generate Coach Insights parse failed, retrying... (${retries + 1})`,
      );
      retries++;
    } catch (error) {
      console.warn(
        `AI Generate Coach Insights error attempt ${retries + 1}`,
        error,
      );
      retries++;
    }
  } while (retries < maxRetries);
  console.log('AI Generate Coach Insights failed!.');
  return { type: 'string', value: raw };
};

export const adjustPlanWithAI = async (
  input: CoachInput,
  maxRetries: number = 0,
) => {
  const prompt = buildAdjustmentPrompt(input);
  let retries = 0;
  let raw = '';
  do {
    try {
      raw = await callAI(
        [
          {
            role: 'system',
            content:
              'You are an expert cycling coach who modifies training plans safely.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        0.4,
      );
      console.log('Raw Adjusted Plan: ', raw);

      const parsed = safeParse(raw);

      const validated = adjustedPlanSchema.safeParse(parsed);
      if (validated.success) {
        console.log('AI Adjust Plan successful.');
        return { type: 'json', value: validated.data };
      }
      console.warn(`AI Adjust Plan parse failed, retrying... (${retries + 1})`);
      retries++;
    } catch (error) {
      console.warn(`AI Adjust Plan error attempt ${retries + 1}`, error);
      retries++;
    }
  } while (retries < maxRetries);
  console.log('AI Adjust Plan failed!.');
  return { type: 'string', value: raw };
};
