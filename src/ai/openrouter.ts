import { MissingConfigError, ShipitError } from '../core/errors.js';
import type { ResolvedConfig } from '../types.js';
import { buildCommitMessages, buildPullRequestMessages } from './prompts.js';
import type {
  AiProvider,
  ChangeSummaryInput,
  ChatMessage,
  CommitMessageInput,
  PullRequestDraft,
  PullRequestInput,
} from './provider.js';

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

export class OpenRouterProvider implements AiProvider {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(config: ResolvedConfig) {
    if (!config.openrouter.apiKey) {
      throw new MissingConfigError(
        'OpenRouter API key is not configured. Run `shipit config set openrouter.apiKey <key>` or set OPENROUTER_API_KEY.',
      );
    }

    this.apiKey = config.openrouter.apiKey;
    this.model = config.openrouter.model;
  }

  async generateCommitMessage(input: CommitMessageInput): Promise<string> {
    const content = await this.chat(buildCommitMessages(input), 0.2);
    return cleanupText(content);
  }

  async generatePullRequest(input: PullRequestInput): Promise<PullRequestDraft> {
    const content = await this.chat(buildPullRequestMessages(input), 0.25);
    return parsePrJson(content);
  }

  async summarizeChanges(input: ChangeSummaryInput): Promise<string> {
    return cleanupText(
      await this.chat(
        [
          {
            role: 'system',
            content: 'Summarize code changes clearly and briefly. Do not include secrets.',
          },
          {
            role: 'user',
            content: `Project: ${input.analysis.projectLabel}\n\nDiff stat:\n${input.diff.stat}\n\nDiff:\n${input.diff.diff}`,
          },
        ],
        0.2,
      ),
    );
  }

  private async chat(messages: ChatMessage[], temperature: number): Promise<string> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'shipit',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature,
      }),
    });

    const json = (await response.json().catch(() => ({}))) as ChatCompletionResponse;

    if (!response.ok) {
      throw new ShipitError(
        json.error?.message || `OpenRouter request failed with HTTP ${response.status}.`,
        'OPENROUTER_ERROR',
        1,
      );
    }

    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      throw new ShipitError('OpenRouter returned an empty response.', 'OPENROUTER_EMPTY_RESPONSE', 1);
    }

    return content;
  }
}

function cleanupText(value: string): string {
  return value.replace(/^```(?:\w+)?\s*/g, '').replace(/```$/g, '').trim();
}

function parsePrJson(value: string): PullRequestDraft {
  const cleaned = cleanupText(value);

  try {
    const parsed = JSON.parse(cleaned) as PullRequestDraft;
    if (!parsed.title || !parsed.body) {
      throw new Error('Missing title or body');
    }
    return parsed;
  } catch {
    const title = cleaned.split('\n').find(Boolean)?.replace(/^#+\s*/, '') || 'Update project';
    return {
      title,
      body: cleaned,
    };
  }
}
