import type { CommitStyle, DiffContext, ProjectAnalysis } from '../types.js';

export interface CommitMessageInput {
  analysis: ProjectAnalysis;
  diff: DiffContext;
  style: CommitStyle;
  type?: string;
  scope?: string;
  recentCommits?: string[];
}

export interface PullRequestInput {
  analysis: ProjectAnalysis;
  baseBranch: string;
  currentBranch: string;
  commits: string[];
  diff: DiffContext;
}

export interface ChangeSummaryInput {
  analysis: ProjectAnalysis;
  diff: DiffContext;
}

export interface PullRequestDraft {
  title: string;
  body: string;
}

export interface AiProvider {
  generateCommitMessage(input: CommitMessageInput): Promise<string>;
  generatePullRequest(input: PullRequestInput): Promise<PullRequestDraft>;
  summarizeChanges(input: ChangeSummaryInput): Promise<string>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
