import type { ChatMessage, CommitMessageInput, PullRequestInput } from './provider.js';

export function buildCommitMessages(input: CommitMessageInput): ChatMessage[] {
  const styleInstruction = getStyleInstruction(input);
  const forcedParts = [
    input.type ? `Requested type: ${input.type}` : undefined,
    input.scope ? `Requested scope: ${input.scope}` : undefined,
  ]
    .filter(Boolean)
    .join('\n');

  return [
    {
      role: 'system',
      content:
        'You write accurate Git commit messages. Return only the commit message. Do not use markdown fences or explanations.',
    },
    {
      role: 'user',
      content: [
        styleInstruction,
        forcedParts,
        `Project: ${input.analysis.projectLabel}`,
        `Package manager: ${input.analysis.packageManager}`,
        `Branch: ${input.analysis.git.branch ?? 'unknown'}`,
        input.recentCommits?.length
          ? `Recent commits:\n${input.recentCommits.map((commit) => `- ${commit}`).join('\n')}`
          : undefined,
        `Changed files:\n${input.diff.files.map((file) => `- ${file}`).join('\n')}`,
        input.diff.stat ? `Diff stat:\n${input.diff.stat}` : undefined,
        input.diff.warnings.length ? `Safety notes:\n${input.diff.warnings.join('\n')}` : undefined,
        `Sanitized diff:\n${input.diff.diff}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
    },
  ];
}

export function buildPullRequestMessages(input: PullRequestInput): ChatMessage[] {
  return [
    {
      role: 'system',
      content:
        'You write clear pull request titles and bodies. Return strict JSON only with keys "title" and "body".',
    },
    {
      role: 'user',
      content: [
        'Create a pull request draft.',
        'Body format must include: Summary, Changes, Testing, and Notes/Risks when relevant.',
        `Project: ${input.analysis.projectLabel}`,
        `Base branch: ${input.baseBranch}`,
        `Current branch: ${input.currentBranch}`,
        input.commits.length ? `Commits:\n${input.commits.map((commit) => `- ${commit}`).join('\n')}` : undefined,
        `Changed files:\n${input.diff.files.map((file) => `- ${file}`).join('\n')}`,
        input.diff.stat ? `Diff stat:\n${input.diff.stat}` : undefined,
        input.diff.warnings.length ? `Safety notes:\n${input.diff.warnings.join('\n')}` : undefined,
        `Sanitized diff:\n${input.diff.diff}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
    },
  ];
}

function getStyleInstruction(input: CommitMessageInput): string {
  if (input.style === 'simple') {
    return 'Write a simple commit message in sentence case. Keep it concise.';
  }

  if (input.style === 'detailed') {
    return 'Write a commit message with a concise subject and a useful body with bullet points when helpful.';
  }

  if (input.style === 'emoji') {
    return 'Write a conventional commit message prefixed with a relevant emoji. Keep the subject under 72 characters.';
  }

  return [
    'Write a Conventional Commit message.',
    'Format: <type>(optional-scope): <description>',
    'Allowed types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.',
    'Keep the subject under 72 characters.',
    'Include a body only when useful.',
  ].join('\n');
}
