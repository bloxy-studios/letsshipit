# shipit

`shipit` is a TypeScript Node.js CLI that helps developers safely move from local
changes to an AI-generated commit, push, and pull request.

It is designed to be run inside any project directory:

```bash
shipit
```

The core promise:

```text
Analyze my repo, understand my changes, and help me safely ship them.
```

## Features

- Project analysis for Git, Node.js, TypeScript, React, Next.js, Python, Go, and Rust projects
- Safe staging that skips sensitive files
- OpenRouter-powered commit message generation
- AI-generated pull request title/body drafts
- GitHub pull request creation through the GitHub CLI
- Interactive by default
- Automation-friendly `--yes`, `--json`, and `--dry-run` options
- Config precedence from flags, environment, project config, global config, and defaults

## Installation

For local development:

```bash
pnpm install
pnpm build
pnpm link --global
shipit --help
```

Hosted install command:

```bash
curl -fsSL https://letsshipit.vercel.app/install.sh | bash
```

GitHub raw install alternative:

```bash
curl -fsSL https://raw.githubusercontent.com/bloxy-studios/letsshipit/main/install.sh | bash
```

## Quickstart

```bash
shipit config set openrouter.apiKey sk-or-v1-your-key
shipit config set openrouter.model openai/gpt-4o-mini

cd your-project
shipit analyze
shipit go
```

## OpenRouter Setup

Create an API key at [OpenRouter](https://openrouter.ai/settings/keys), then
configure it with either:

```bash
shipit config set openrouter.apiKey <key>
```

or:

```bash
export OPENROUTER_API_KEY=<key>
```

The default model is:

```text
openai/gpt-4o-mini
```

Override it globally:

```bash
shipit config set openrouter.model anthropic/claude-3.5-sonnet
```

or per command:

```bash
shipit suggest --model openai/gpt-4o-mini
```

## Configuration

Global config is stored at:

```text
~/.config/shipit/config.json
```

Project config is read from:

```text
.shipit.json
```

Precedence:

```text
CLI flags > environment variables > project config > global config > defaults
```

Environment variables:

```bash
OPENROUTER_API_KEY=
SHIPIT_MODEL=
SHIPIT_COMMIT_STYLE=
SHIPIT_PR_BASE=
```

Example `.shipit.json`:

```json
{
  "openrouter": {
    "model": "openai/gpt-4o-mini"
  },
  "commit": {
    "style": "conventional"
  },
  "pr": {
    "base": "main",
    "useGithubCli": true
  },
  "checks": {
    "lint": "pnpm lint",
    "test": "pnpm test",
    "build": "pnpm build"
  }
}
```

## Commands

```bash
shipit                     # interactive mode
shipit init                # initialize Git
shipit analyze             # analyze current project
shipit status              # enhanced Git status
shipit stage               # stage files safely
shipit suggest             # suggest commit message
shipit commit              # create commit
shipit push                # push current branch
shipit pr                  # create GitHub PR through gh
shipit go                  # stage -> commit -> push -> PR
shipit check               # run detected checks
shipit config              # manage config
shipit doctor              # validate environment
shipit update              # update placeholder
```

## Examples

Analyze:

```bash
shipit analyze
shipit analyze --json
```

Stage:

```bash
shipit stage
shipit stage --all
shipit stage --all --dry-run
```

Suggest a commit:

```bash
shipit suggest --style conventional
```

Commit:

```bash
shipit commit
shipit commit --all --yes
shipit commit --message "fix: handle empty state" --dry-run
```

Push:

```bash
shipit push
shipit push --set-upstream
shipit push --force-with-lease
```

Create PR:

```bash
shipit pr --base main --draft
shipit pr --title "Add login validation" --body "..."
```

Full flow:

```bash
shipit go
shipit go --yes --run-checks --draft
shipit go --dry-run
```

## Safety Notes

`shipit` is safe by default:

- Interactive mode previews generated commit messages and PR content.
- `--dry-run` never mutates Git state.
- `--force` is not supported; use `--force-with-lease`.
- Sensitive files are skipped for AI prompts and auto-staging.
- Diffs are redacted and truncated before being sent to OpenRouter.

Sensitive file patterns include:

- `.env`
- `.env.*`
- `*.pem`
- `*.key`
- `id_rsa`
- `id_ed25519`
- `.npmrc`
- `.pypirc`
- `.ssh/**`

## GitHub PR Requirements

For `shipit pr`, install and authenticate the GitHub CLI:

```bash
gh auth login
gh auth status
```

MVP PR creation supports GitHub remotes through `gh pr create`.

## Development

```bash
pnpm install
pnpm dev --help
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

Link locally:

```bash
pnpm build
pnpm link --global
shipit --version
```

## Current Limitations

- The updater is a placeholder until release artifacts exist.
- Pull request creation currently supports GitHub through `gh`.
- OpenRouter uses the OpenAI-compatible chat completions endpoint directly for stable CLI behavior.
- Direct GitHub API support can be added after the GitHub CLI path is solid.
