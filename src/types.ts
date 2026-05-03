export type CommitStyle = 'conventional' | 'simple' | 'detailed' | 'emoji';

export type ProjectType =
  | 'node'
  | 'typescript'
  | 'react'
  | 'next'
  | 'python'
  | 'go'
  | 'rust'
  | 'generic';

export type PackageManager = 'pnpm' | 'yarn' | 'npm' | 'bun' | 'cargo' | 'go' | 'pip' | 'unknown';

export interface FileState {
  path: string;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
  status: string;
}

export interface GitStatus {
  isRepo: boolean;
  branch?: string;
  upstream?: string;
  remote?: string;
  remoteUrl?: string;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  changed: string[];
  files: FileState[];
  clean: boolean;
}

export interface CheckCommands {
  lint?: string;
  test?: string;
  build?: string;
}

export interface ProjectAnalysis {
  cwd: string;
  git: GitStatus;
  projectType: ProjectType;
  projectLabel: string;
  packageManager: PackageManager;
  packageName?: string;
  framework?: string;
  language?: string;
  scripts: Record<string, string>;
  checks: CheckCommands;
  defaultBranch?: string;
  remoteHost?: 'github' | 'gitlab' | 'bitbucket' | 'unknown';
  sensitiveFiles: string[];
}

export interface ShipitConfig {
  openrouter?: {
    apiKey?: string;
    model?: string;
  };
  commit?: {
    style?: CommitStyle;
  };
  pr?: {
    base?: string;
    useGithubCli?: boolean;
  };
  checks?: CheckCommands;
}

export interface ResolvedConfig {
  openrouter: {
    apiKey?: string;
    model: string;
  };
  commit: {
    style: CommitStyle;
  };
  pr: {
    base: string;
    useGithubCli: boolean;
  };
  checks: CheckCommands;
}

export interface CommandContext {
  cwd: string;
}

export interface JsonResult {
  success: boolean;
  [key: string]: unknown;
}

export interface DiffContext {
  diff: string;
  stat: string;
  files: string[];
  excludedSensitiveFiles: string[];
  truncated: boolean;
  warnings: string[];
}
