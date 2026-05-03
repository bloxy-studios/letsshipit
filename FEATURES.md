# shipit Features

`shipit` is a CLI that feels like a smart Git assistant for any project directory.
It helps a user safely move from local changes to a pushed branch and pull
request:

```bash
working changes -> AI commit message -> commit -> push -> PR
```

The CLI should support both guided interactive usage:

```bash
shipit
```

and direct non-interactive usage:

```bash
shipit commit --yes
shipit pr --base main --title "Add auth flow"
```

## Core Promise

Analyze my repo, understand my changes, and help me safely ship them.

The best first version should center on:

```bash
shipit go
```

which runs the guided flow:

```text
analyze -> stage -> AI commit -> commit -> push -> PR
```

with `shipit config`, `shipit doctor`, and `--dry-run` making the tool reliable
enough for daily use.

## 1. Main CLI Flow

### `shipit`

Default interactive mode.

```bash
shipit
```

The CLI checks the current directory:

1. Detects whether this is a Git repo.
2. If no `.git` exists:
   - asks whether to initialize Git
   - optionally creates `.gitignore`
   - optionally makes the first commit
3. If Git exists:
   - checks branch, remote, staged changes, and unstaged changes
   - summarizes changed files
   - asks what the user wants to do:
     - stage changes
     - generate commit message
     - commit
     - push
     - create PR
     - inspect repo
     - configure settings

Example:

```text
No git repository found.

? Initialize git here? Yes
? Create a .gitignore? Yes
? What template? Node
Initialized empty Git repository.

12 changed files detected.

? What do you want to do?
  Stage all changes
  Select files to stage
  Generate commit message
  Commit and push
  Create pull request
```

## 2. Git Initialization

### `shipit init`

Initializes Git if missing.

```bash
shipit init
```

Supported usage:

```bash
shipit init
shipit init --yes
shipit init --gitignore node
shipit init --branch main
shipit init --remote git@github.com:user/repo.git
```

Behavior:

- If `.git` exists, print:

```text
Git repository already exists.
```

- If `.git` does not exist:
  - run `git init`
  - set default branch if provided
  - optionally add `.gitignore`
  - optionally add remote
  - optionally create initial commit

Possible flags:

```bash
--yes
--branch main
--remote <url>
--gitignore node|python|go|rust|none
--initial-commit
```

## 3. Project Analysis

### `shipit analyze`

Analyzes the current project.

```bash
shipit analyze
```

This should detect:

- language/framework
- package manager
- Git status
- changed files
- current branch
- remote URL
- likely repo host: GitHub, GitLab, or Bitbucket
- test, lint, and build commands
- project metadata from files like:
  - `package.json`
  - `pyproject.toml`
  - `Cargo.toml`
  - `go.mod`
  - `composer.json`
  - `requirements.txt`
  - `Makefile`
  - `README.md`

Example output:

```text
Project detected: Node.js / TypeScript
Package manager: pnpm
Git repo: yes
Current branch: feat/login-flow
Remote: origin git@github.com:acme/app.git
Changed files: 8
Suggested checks:
  pnpm lint
  pnpm test
  pnpm build
```

Useful flags:

```bash
shipit analyze --json
shipit analyze --changed-only
shipit analyze --suggest-checks
```

This command becomes the backbone for the rest of the CLI.

## 4. Staging Changes

### `shipit stage`

Stages files.

```bash
shipit stage
```

Modes:

```bash
shipit stage --all
shipit stage --interactive
shipit stage src/auth.ts src/login.tsx
shipit stage --exclude "*.md"
```

Interactive behavior:

```text
? Select files to stage:
  [x] src/auth.ts
  [x] src/login.tsx
  [ ] README.md
  [ ] package-lock.json
```

Good default:

```bash
shipit stage
```

should open an interactive selector unless `--all` or `--yes` is passed.

## 5. AI Commit Messages

### `shipit commit`

Stages, generates, previews, and commits.

```bash
shipit commit
```

Main flow:

1. Check for staged files.
2. If none are staged, ask whether to stage changes.
3. Generate a summary of the diff.
4. Ask OpenRouter for a commit message.
5. Show the proposed message.
6. User can accept, edit, regenerate, or cancel.
7. Run `git commit`.

Example:

```text
Generated commit message:

feat(auth): add login form validation

- add email/password validation
- show inline form errors
- disable submit while request is pending

? Use this commit message?
  Yes
  Edit
  Regenerate
  Cancel
```

Useful options:

```bash
shipit commit
shipit commit --all
shipit commit --message "fix: handle empty user state"
shipit commit --yes
shipit commit --dry-run
shipit commit --style conventional
shipit commit --style simple
shipit commit --style detailed
shipit commit --model openai/gpt-4o-mini
```

Important safety feature:

```bash
shipit commit --dry-run
```

should show what would happen but not commit.

## 6. Commit Message Generation Only

### `shipit suggest`

Useful when the user wants just the message.

```bash
shipit suggest
```

Examples:

```bash
shipit suggest
shipit suggest --staged
shipit suggest --all
shipit suggest --style conventional
shipit suggest --json
```

Output:

```text
feat(api): add user profile endpoint
```

This is useful for users who still want to run Git manually.

## 7. Push Support

### `shipit push`

Pushes the current branch.

```bash
shipit push
```

Behavior:

- Detect current branch.
- Detect remote.
- If no upstream exists, run:

```bash
git push -u origin current-branch
```

- If upstream exists:

```bash
git push
```

Options:

```bash
shipit push
shipit push --remote origin
shipit push --branch feat/login
shipit push --set-upstream
shipit push --force-with-lease
```

Important: avoid supporting plain `--force` at first. `--force-with-lease` is
safer.

## 8. Pull Request Creation

### `shipit pr`

Creates a pull request.

```bash
shipit pr
```

Flow:

1. Ensure branch is pushed.
2. Detect GitHub repo from remote URL.
3. Detect base branch, likely `main` or `master`.
4. Generate PR title and body using AI.
5. Preview title and body.
6. Create PR via GitHub CLI or GitHub API.

Example:

```text
Generated PR:

Title:
Add login form validation

Body:
## Summary
- Adds email and password validation to the login form
- Displays inline validation errors
- Prevents duplicate submissions while loading

## Testing
- Ran pnpm test
- Manually verified invalid email/password states

? Create this PR?
```

Options:

```bash
shipit pr
shipit pr --base main
shipit pr --draft
shipit pr --title "Add login form validation"
shipit pr --body "..."
shipit pr --yes
shipit pr --web
```

Potential implementation paths:

### Option A: Use GitHub CLI

Use `gh pr create`.

Pros:

- easier
- respects existing GitHub auth
- fewer tokens for the tool to manage

Cons:

- requires `gh` installed

### Option B: Use GitHub API Directly

Pros:

- no `gh` dependency
- more control

Cons:

- requires GitHub token setup

Start with GitHub CLI support first, then add direct API later.

## 9. One-Command Ship Flow

### `shipit go`

The hero command.

```bash
shipit go
```

This does:

```text
analyze -> stage -> generate commit -> commit -> push -> create PR
```

Interactive by default.

Useful flags:

```bash
shipit go
shipit go --yes
shipit go --no-pr
shipit go --draft
shipit go --base main
shipit go --run-checks
shipit go --style conventional
```

Example:

```bash
shipit go --run-checks --draft
```

Flow:

1. Analyze project.
2. Detect test, lint, and build commands.
3. Ask whether to run checks.
4. Stage selected files.
5. Generate commit.
6. Commit.
7. Push.
8. Generate PR.
9. Create draft PR.

This is probably the main selling point.

## 10. Configuration

### `shipit config`

Manages CLI settings.

```bash
shipit config
```

Interactive setup:

```text
? OpenRouter API key: ********
? Default model: anthropic/claude-3.5-sonnet
? Commit style: conventional
? Default PR base branch: main
? Auto-stage by default? No
? Use GitHub CLI for PRs? Yes
```

Commands:

```bash
shipit config set openrouter.apiKey <key>
shipit config set openrouter.model anthropic/claude-3.5-sonnet
shipit config set commit.style conventional
shipit config set pr.base main
shipit config get
shipit config list
shipit config reset
```

Config locations:

Global config:

```bash
~/.config/shipit/config.json
```

Project config:

```bash
.shipit.json
```

Environment variables:

```bash
OPENROUTER_API_KEY=
SHIPIT_MODEL=
SHIPIT_COMMIT_STYLE=
```

Priority order:

```text
CLI flags > environment variables > project config > global config > defaults
```

Example `.shipit.json`:

```json
{
  "model": "anthropic/claude-3.5-sonnet",
  "commitStyle": "conventional",
  "defaultBaseBranch": "main",
  "runChecksBeforeCommit": true,
  "checks": {
    "lint": "pnpm lint",
    "test": "pnpm test",
    "build": "pnpm build"
  }
}
```

## 11. AI Provider Design

Even though OpenRouter is first, design it as a provider system.

```text
AI Provider Interface
  - generateCommitMessage(diff, context)
  - generatePRTitle(commits, diff, context)
  - generatePRBody(commits, diff, context)
  - summarizeChanges(diff, context)
```

Initial provider:

```text
OpenRouterProvider
```

Future providers:

```text
OpenAIProvider
AnthropicProvider
OllamaProvider
LMStudioProvider
CustomHTTPProvider
```

Config example:

```json
{
  "ai": {
    "provider": "openrouter",
    "model": "anthropic/claude-3.5-sonnet"
  }
}
```

## 12. Commit Message Styles

Support multiple styles.

```bash
shipit commit --style conventional
shipit commit --style simple
shipit commit --style detailed
shipit commit --style emoji
```

### Conventional

```text
feat(auth): add login validation
```

### Simple

```text
Add login validation
```

### Detailed

```text
Add login form validation and error handling

- Validate email and password inputs
- Display inline form errors
- Disable submit button while loading
```

### Emoji

```text
feat(auth): add login validation
```

Also useful:

```bash
shipit commit --scope auth
shipit commit --type fix
```

## 13. Smart Diff Handling

The CLI should not blindly send giant diffs to AI.

It should:

- ignore binary files
- ignore lockfiles by default, or summarize them
- truncate very large diffs
- summarize file-level changes first
- use `git diff --stat`
- use `git diff --cached` for staged changes
- include package metadata
- include branch name
- include recent commits for style

Example AI context:

```text
Project: TypeScript React app
Branch: feat/login-form
Recent commits:
- feat(auth): add session provider
- fix(api): handle expired tokens

Changed files:
- src/auth/LoginForm.tsx
- src/auth/validation.ts
- src/api/login.ts

Diff summary:
...
```

Potential command:

```bash
shipit diff-summary
```

## 14. Pre-Commit Checks

### `shipit check`

Runs detected or configured checks.

```bash
shipit check
```

Detect common commands.

For Node:

```bash
pnpm lint
pnpm test
pnpm build
```

For Python:

```bash
pytest
ruff check .
mypy .
```

For Rust:

```bash
cargo test
cargo clippy
cargo build
```

For Go:

```bash
go test ./...
go vet ./...
```

Options:

```bash
shipit check
shipit check --lint
shipit check --test
shipit check --build
shipit check --before-commit
```

In `shipit go`, ask:

```text
? Run checks before committing? Yes
```

Or non-interactive:

```bash
shipit go --run-checks
```

## 15. Branch Management

### `shipit branch`

Create or switch branches.

```bash
shipit branch new feat/login-form
shipit branch current
shipit branch rename feat/auth-login
```

AI-generated branch names:

```bash
shipit branch suggest
```

Output:

```text
feat/login-validation
```

Or:

```bash
shipit branch create --ai
```

Flow:

1. Analyze diff.
2. Generate branch name.
3. Create branch.

Example:

```bash
shipit branch create --ai
```

```text
Suggested branch: feat/login-validation
? Create and switch to this branch? Yes
```

## 16. Changelog Generation

### `shipit changelog`

Generate changelog entries from commits.

```bash
shipit changelog
```

Options:

```bash
shipit changelog --since v1.2.0
shipit changelog --from main --to HEAD
shipit changelog --write
shipit changelog --format markdown
```

Output:

```md
## Changes

### Features
- Added login form validation.

### Fixes
- Fixed duplicate submit behavior.
```

This could become very useful for releases.

## 17. Release Helper

Later feature, but powerful.

### `shipit release`

```bash
shipit release patch
shipit release minor
shipit release major
```

Could do:

1. Run checks.
2. Generate changelog.
3. Bump version.
4. Commit release.
5. Tag release.
6. Push tags.
7. Create GitHub release.

Options:

```bash
shipit release patch --dry-run
shipit release minor --github-release
```

This is not needed for v1, but it is a strong roadmap item.

## 18. Issue-Aware Commits And PRs

Later, the CLI could detect issue numbers from branch names.

Branch:

```text
feat/123-login-validation
```

Then PR body includes:

```text
Closes #123
```

Commands:

```bash
shipit pr --issue 123
shipit commit --issue 123
```

Could also integrate Linear later:

```bash
shipit pr --linear ENG-123
```

## 19. Repo Health Command

### `shipit doctor`

Checks if the local environment is ready.

```bash
shipit doctor
```

Checks:

- Git installed
- inside repo or can initialize repo
- OpenRouter API key configured
- model configured
- remote exists
- GitHub CLI installed and authenticated
- current branch has upstream
- working tree status
- package manager detected
- test, lint, and build commands detected

Example:

```text
Git: OK
Repository: OK
OpenRouter API key: OK
Model: anthropic/claude-3.5-sonnet
GitHub CLI: installed, authenticated
Remote: origin
Checks: pnpm lint, pnpm test
```

## 20. Installation Flow

Provide a Claude-like install command:

```bash
curl -fsSL https://yourdomain.com/install.sh | bash
```

Example:

```bash
curl -fsSL https://shipit.dev/install.sh | bash
```

Or from GitHub:

```bash
curl -fsSL https://raw.githubusercontent.com/yourname/shipit/main/install.sh | bash
```

Installer should:

1. Detect OS:
   - macOS
   - Linux
   - Windows through PowerShell separately
2. Detect architecture:
   - x64
   - arm64
3. Download the correct binary.
4. Put it in:
   - `/usr/local/bin/shipit`
   - `~/.local/bin/shipit`
5. Make it executable.
6. Verify installation:

```bash
shipit --version
```

Example output:

```text
shipit installed successfully.

Run:
  shipit config
```

For Windows:

```powershell
irm https://shipit.dev/install.ps1 | iex
```

Alternative install methods:

```bash
brew install yourname/tap/shipit
npm install -g shipit-cli
cargo install shipit
go install github.com/yourname/shipit@latest
```

The curl installer is great for first impressions, but package managers are
better for updates.

## 21. Update Command

### `shipit update`

```bash
shipit update
```

Should check the latest release and replace the binary.

Useful if installed via curl.

Also:

```bash
shipit version
shipit --version
```

Could show:

```text
shipit 0.4.1
A newer version is available: 0.5.0
Run: shipit update
```

## 22. Suggested Command Map

Clean v1 command structure:

```bash
shipit                     # interactive mode
shipit init                # initialize git/project config
shipit analyze             # analyze current project
shipit status              # enhanced git status
shipit stage               # stage changes
shipit suggest             # suggest commit message
shipit commit              # generate and create commit
shipit push                # push current branch
shipit pr                  # create pull request
shipit go                  # commit + push + PR flow
shipit check               # run project checks
shipit config              # configure API key/model/settings
shipit doctor              # validate environment
shipit update              # update CLI
```

Future commands:

```bash
shipit branch
shipit changelog
shipit release
shipit rollback
shipit hooks
```

## 23. Non-Interactive Behavior

Every command should work in automation.

Examples:

```bash
shipit commit --all --yes
shipit go --yes --base main --draft
shipit pr --yes --title "Add login validation"
```

Rules:

- If `--yes` is provided:
  - do not ask questions
  - use defaults
  - fail clearly if required config is missing
- If `--json` is provided:
  - output machine-readable JSON
- If `--dry-run` is provided:
  - never mutate Git state

Example:

```bash
shipit commit --all --yes --json
```

Output:

```json
{
  "success": true,
  "commit": "abc123",
  "message": "feat(auth): add login validation"
}
```

## 24. Safety Principles

This CLI will touch people's repos, so it should feel trustworthy.

Important safety defaults:

- Never commit without showing the message in interactive mode.
- Never push without confirmation in interactive mode.
- Never force push by default.
- Never send ignored files to AI.
- Never send `.env`, secrets, or private key files to AI.
- Detect possible secrets in diffs.
- Redact values from files like:
  - `.env`
  - `.npmrc`
  - `.pypirc`
  - `id_rsa`
  - `*.pem`
  - `*.key`
- Warn before including large diffs.
- Always support `--dry-run`.

Secret detection can be basic in v1 and stronger later.

Example:

```text
Potential secret detected in .env.local.
This file will not be sent to AI or staged automatically.
```

## 25. Suggested MVP

Keep v1 focused and sharp.

### MVP Commands

```bash
shipit
shipit init
shipit config
shipit analyze
shipit stage
shipit suggest
shipit commit
shipit push
shipit pr
shipit go
shipit doctor
```

### MVP Features

- Git repo detection
- Git init if missing
- project analysis
- OpenRouter config
- AI commit message generation
- conventional commit support
- interactive staging
- commit creation
- push current branch
- GitHub PR creation through `gh`
- install script
- dry-run mode
- non-interactive `--yes` mode

That is enough for a useful first release.

## 26. Example UX

### First Install

```bash
curl -fsSL https://shipit.dev/install.sh | bash
```

Then:

```bash
shipit config
```

```text
? OpenRouter API key: ********
? Default model: anthropic/claude-3.5-sonnet
? Commit style: conventional
? Default PR base branch: main
Saved config to ~/.config/shipit/config.json
```

### Daily Use

```bash
cd my-project
shipit go
```

```text
Project: TypeScript React app
Branch: feat/login-validation
Changed files: 6

? Stage all changes? Yes

Generated commit:
feat(auth): add login validation

? Commit? Yes
Committed abc123.

? Push branch? Yes
Pushed feat/login-validation.

Generated PR:
Add login validation

? Create PR? Yes
Created PR: https://github.com/acme/app/pull/42
```

### Non-Interactive Use

```bash
shipit go --yes --run-checks --draft
```

## 27. Nice Product Touches

These would make `shipit` feel polished:

- `shipit explain` - explain current changes in plain English
- `shipit review` - AI review before committing
- `shipit risks` - identify risky changes
- `shipit todo` - scan changed files for TODO/FIXME
- `shipit clean` - show untracked files and ignored junk
- `shipit undo` - undo last `shipit` operation where possible
- `shipit history` - show previous AI-generated commits/PRs
- `shipit templates` - configure PR body templates
- `shipit alias` - create custom shortcuts
- `shipit hooks install` - optional Git hooks

Example:

```bash
shipit review
```

```text
Potential issues:
- src/auth/session.ts changes token expiration logic but tests were not updated.
- LoginForm.tsx introduces a new loading state but does not handle network errors.
```

## Recommended Direction

Build the CLI around this core promise:

```text
Analyze my repo, understand my changes, and help me safely ship them.
```

The best v1 would be:

```bash
shipit go
```

where the CLI does the full guided flow:

```text
analyze -> stage -> AI commit -> commit -> push -> PR
```

with `shipit config`, `shipit doctor`, and `--dry-run` making it reliable enough
for real daily use.
