import AppError from '@/handler/error.handler.js';
import {
  buildCoachingPrompt,
  buildDailyInsight,
  buildPlanPrompt,
  buildSummaryInsight,
} from '@/prompts/coach.prompts.js';
import {
  coachInsightsSchema,
  dailyInsightsSchema,
  generatedPlanSchema,
  weeklyInsightsSchema,
} from '@/validator/ai.validator.js';
import 'dotenv/config';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
  maxRetries: 3,
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const callAI = async (
  messages: { role: 'system' | 'user'; content: string }[],
  temperature: number,
  maxRetries = 3, // Fallback safety layer for extreme limits
  attempt = 1,
): Promise<string> => {
  try {
    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_AI_MODEL!,
      messages,
      temperature,
    });

    return completion.choices[0]?.message?.content || '';
  } catch (error: any) {
    if (error.status === 429 && attempt <= maxRetries) {
      // Check if Groq sent an exact 'retry-after' time constraint (in seconds)
      const retryAfterHeader = error.headers?.['retry-after'];
      const waitTimeSec = retryAfterHeader
        ? parseFloat(retryAfterHeader)
        : Math.pow(2, attempt);

      console.warn(
        `[Groq Rate Limit] Hit 429. Retrying attempt ${attempt}/${maxRetries} after ${waitTimeSec}s...`,
      );

      await delay(waitTimeSec * 1000);
      return callAI(messages, temperature, maxRetries, attempt + 1);
    }
    if (error.status === 401 || error.status === 400) {
      console.error(
        '[Groq Fatal Error] Check configuration or API key credentials.',
        error.message,
      );
      throw new AppError('AI service configuration error: ' + error.message);
    }

    // 4. Handle persistent connection or server exceptions
    if (attempt <= maxRetries) {
      const fallbackWait = Math.pow(2, attempt);
      console.warn(
        `[Groq Error] Status ${error.status || 'unknown'}. Retrying in ${fallbackWait}s...`,
      );
      await delay(fallbackWait * 1000);
      return callAI(messages, temperature, maxRetries, attempt + 1);
    }

    console.error('[Groq Exhausted] All automatic and manual retries failed.');
    throw new AppError('AI service error: ' + error.message);
  }
};

export const generatePlanWithAI = async (
  input: {
    metrics: TrainingState;

    startDate: Date;
    endDate: Date;

    experienceLevel: string;
    customGoalRequest: string;
  },
  maxRetries: number = 3,
) => {
  const prompt = buildPlanPrompt(input);

  let retries = 0;
  let raw = '';

  do {
    try {
      raw = await callAI(
        [
          {
            role: 'system',
            content:
              'You are an elite cycling coach specializing in endurance training and structured progression.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        0.4,
      );

      const parsed = JSON.parse(raw);

      const validated = generatedPlanSchema.safeParse(parsed);

      if (validated.success) {
        console.log('AI Generate Plan successful: ', validated.data);
        return { type: 'json', value: validated.data };
      }
      console.warn(
        `AI Generate Plan parse failed, retrying... (${retries + 1})`,
      );
      retries++;
    } catch (error) {
      console.warn(`AI Generate Plan error attempt ${retries + 1}`, error);
      retries++;
    }
  } while (retries < maxRetries);
  console.log('AI Generate Plan failed!.');
  return { type: 'string', value: raw };
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

export const generateSummaryAIInsight = async (
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
  const prompt = buildSummaryInsight(input);
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
