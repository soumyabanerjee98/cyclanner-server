import {
  buildAdjustmentPrompt,
  buildCoachingPrompt,
  buildDailyInsight,
  buildWeeklyInsight,
} from '@/prompts/coach.prompts.js';
import {
  adjustedPlanSchema,
  coachInsightsSchema,
  dailyInsightsSchema,
  weeklyInsightsSchema,
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
    model: process.env.GROQ_AI_MODEL!,
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

      const parsed = JSON.parse(raw);

      const validated = coachInsightsSchema.safeParse(parsed);
      if (validated.success) {
        console.log('AI Generate Coach Insights successful: ', validated.data);
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

      const parsed = JSON.parse(raw);

      const validated = adjustedPlanSchema.safeParse(parsed);
      if (validated.success) {
        console.log('AI Adjust Plan successful: ', validated.data);
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

export const generateDailyInsights = async (
  input: {
    plannedLoad: number;
    totalActualLoad: number;
    deviation: number;
    status: 'overtrained' | 'undertrained' | 'on_track';
    atl: number | null;
    ctl: number | null;
    tsb: number | null;
  },
  maxRetries: number = 0,
) => {
  const prompt = buildDailyInsight(input);
  let retries = 0;
  let raw = '';
  do {
    try {
      raw = await callAI(
        [
          {
            role: 'system',
            content:
              'You are an expert cycling analyst who creates detailed daily insights.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        0.4,
      );

      const parsed = JSON.parse(raw);

      const validated = dailyInsightsSchema.safeParse(parsed);
      if (validated.success) {
        console.log('AI Daily Insights successful: ', validated.data);
        return { type: 'json', value: validated.data };
      }
      console.warn(
        `AI Daily Insights parse failed, retrying... (${retries + 1})`,
      );
      retries++;
    } catch (error) {
      console.warn(`AI Daily Insights error attempt ${retries + 1}`, error);
      retries++;
    }
  } while (retries < maxRetries);
  console.log('AI Daily Insights failed!.');
  return { type: 'string', value: raw };
};

export const generateWeeklyAIInsight = async (
  input: {
    plannedLoad: number;
    actualLoad: number;
    balance: number;
    adherenceScore: number;
    trend: string;
    fatigueRisk: string;
  },
  maxRetries = 2,
) => {
  const prompt = buildWeeklyInsight(input);
  let retries = 0;
  let raw = '';
  do {
    try {
      raw = await callAI(
        [
          {
            role: 'system',
            content:
              'You are an expert cycling analyst who creates detailed weekly summary insights.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        0.4,
      );

      const parsed = JSON.parse(raw);

      const validated = weeklyInsightsSchema.safeParse(parsed);
      if (validated.success) {
        console.log('AI Weekly Insights successful: ', validated.data);
        return { type: 'json', value: validated.data };
      }
      console.warn(
        `AI Weekly Insights parse failed, retrying... (${retries + 1})`,
      );
      retries++;
    } catch (error) {
      console.warn(`AI Weekly Insights error attempt ${retries + 1}`, error);
      retries++;
    }
  } while (retries < maxRetries);
  console.log('AI Weekly Insights failed!.');
  return { type: 'string', value: raw };
};
