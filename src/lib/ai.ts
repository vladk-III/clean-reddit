import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

import type { Comment } from './reddit';
import type { Question, ReadPost } from './quiz';

const MODEL = 'claude-opus-5-5';

const QuizSchema = z.object({
  questions: z.array(
    z.object({
      prompt: z.string(),
      choices: z.array(z.string()),
      answer_index: z.number().int(),
      explanation: z.string(),
    }),
  ),
});

const SYSTEM = `You write short comprehension questions that help someone remember what they just read on Reddit.
Write 3 multiple-choice questions about the post (and top comments if given). Each question has exactly 4 choices and one correct answer.
Focus on the facts, ideas, and takeaways a curious reader would want to remember a week later — not on usernames, vote counts, or formatting.
Keep every question and choice family-friendly. If the content is not suitable for that, return an empty questions array.
The explanation is one sentence that says why the answer is right, citing the post.`;

export class AiQuizError extends Error {}

/**
 * Generates questions with Claude, using the reader's own API key (stored only on device).
 * Callers fall back to the offline generator in quiz.ts when this throws.
 */
export async function aiQuestionsForPost(apiKey: string, post: ReadPost, comments: Comment[]): Promise<Question[]> {
  // The key belongs to the person using the app and never leaves their device
  // except to call the API, so the browser-environment guard does not apply.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });

  const topComments = comments
    .slice(0, 5)
    .map((c) => `- ${c.body.slice(0, 600)}`)
    .join('\n');
  const content = `Subreddit: r/${post.subreddit}
Title: ${post.title}

Post body:
${post.selftext.slice(0, 6000) || '(link post, no body text)'}

Top comments:
${topComments || '(none)'}`;

  let response;
  try {
    response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: betaZodOutputFormat(QuizSchema) },
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new AiQuizError('Your Anthropic API key was rejected.');
    if (error instanceof Anthropic.RateLimitError) throw new AiQuizError('Rate limited by the Anthropic API. Try again shortly.');
    if (error instanceof Anthropic.APIConnectionError) throw new AiQuizError('Could not reach the Anthropic API.');
    if (error instanceof Anthropic.APIError) throw new AiQuizError(`Anthropic API error (${error.status ?? 'unknown'}).`);
    throw error;
  }

  if (response.stop_reason === 'refusal' || !response.parsed_output) {
    throw new AiQuizError('No AI questions for this post.');
  }

  return response.parsed_output.questions
    .filter((q) => q.choices.length >= 2 && q.answer_index >= 0 && q.answer_index < q.choices.length)
    .map((q, i) => ({
      id: `${post.id}-ai-${Date.now().toString(36)}-${i}`,
      postId: post.id,
      postTitle: post.title,
      subreddit: post.subreddit,
      prompt: q.prompt,
      choices: q.choices,
      answerIndex: q.answer_index,
      explanation: q.explanation,
      source: 'ai' as const,
    }));
}
