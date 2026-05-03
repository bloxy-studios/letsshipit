import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CheckCommands, PackageManager, ProjectAnalysis, ProjectType } from '../types.js';
import { pathExists, readJsonFile } from '../utils/fs.js';
import { getDefaultBranch, getStatus } from './git.js';
import { isSensitiveFile } from './safety.js';

interface PackageJson {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export async function analyzeProject(cwd: string): Promise<ProjectAnalysis> {
  const packageJson = await readJsonFile<PackageJson>(join(cwd, 'package.json'));
  const packageManager = await detectPackageManager(cwd);
  const project = await detectProjectType(cwd, packageJson);
  const scripts = packageJson?.scripts ?? {};
  const git = await getStatus(cwd);
  const defaultBranch = git.isRepo ? await getDefaultBranch(cwd) : undefined;
  const checks = inferChecks(project.type, packageManager, scripts);
  const sensitiveFiles = git.changed.filter(isSensitiveFile);

  return {
    cwd,
    git,
    projectType: project.type,
    projectLabel: project.label,
    packageManager,
    packageName: packageJson?.name,
    framework: project.framework,
    language: project.language,
    scripts,
    checks,
    defaultBranch,
    remoteHost: detectRemoteHost(git.remoteUrl),
    sensitiveFiles,
  };
}

export async function detectPackageManager(cwd: string): Promise<PackageManager> {
  if (await pathExists(join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if ((await pathExists(join(cwd, 'bun.lockb'))) || (await pathExists(join(cwd, 'bun.lock')))) return 'bun';
  if (await pathExists(join(cwd, 'yarn.lock'))) return 'yarn';
  if (await pathExists(join(cwd, 'package-lock.json'))) return 'npm';
  if (await pathExists(join(cwd, 'Cargo.toml'))) return 'cargo';
  if (await pathExists(join(cwd, 'go.mod'))) return 'go';
  if ((await pathExists(join(cwd, 'pyproject.toml'))) || (await pathExists(join(cwd, 'requirements.txt'))))
    return 'pip';
  return 'unknown';
}

export async function detectProjectType(
  cwd: string,
  packageJson?: PackageJson,
): Promise<{ type: ProjectType; label: string; framework?: string; language?: string }> {
  if (packageJson) {
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    if (deps.next) {
      return { type: 'next', label: 'Node.js / TypeScript / Next.js', framework: 'Next.js', language: 'TypeScript' };
    }
    if (deps.react) {
      return { type: 'react', label: 'Node.js / React', framework: 'React', language: deps.typescript ? 'TypeScript' : 'JavaScript' };
    }
    if (deps.typescript) {
      return { type: 'typescript', label: 'Node.js / TypeScript', language: 'TypeScript' };
    }
    return { type: 'node', label: 'Node.js', language: 'JavaScript' };
  }

  if ((await pathExists(join(cwd, 'pyproject.toml'))) || (await pathExists(join(cwd, 'requirements.txt')))) {
    return { type: 'python', label: 'Python', language: 'Python' };
  }
  if (await pathExists(join(cwd, 'go.mod'))) return { type: 'go', label: 'Go', language: 'Go' };
  if (await pathExists(join(cwd, 'Cargo.toml'))) return { type: 'rust', label: 'Rust', language: 'Rust' };

  return { type: 'generic', label: 'Generic project' };
}

export function inferChecks(
  projectType: ProjectType,
  packageManager: PackageManager,
  scripts: Record<string, string>,
): CheckCommands {
  const checks: CheckCommands = {};
  const runner = packageManager === 'unknown' ? 'npm' : packageManager;

  if (['node', 'typescript', 'react', 'next'].includes(projectType)) {
    if (scripts.lint) checks.lint = `${runner} run lint`;
    if (scripts.test) checks.test = `${runner} run test`;
    if (scripts.build) checks.build = `${runner} run build`;
    return checks;
  }

  if (projectType === 'python') {
    checks.test = 'pytest';
    checks.lint = 'ruff check .';
  }

  if (projectType === 'rust') {
    checks.test = 'cargo test';
    checks.lint = 'cargo clippy';
    checks.build = 'cargo build';
  }

  if (projectType === 'go') {
    checks.test = 'go test ./...';
    checks.lint = 'go vet ./...';
  }

  return checks;
}

export function detectRemoteHost(remoteUrl?: string): ProjectAnalysis['remoteHost'] {
  if (!remoteUrl) return undefined;
  if (remoteUrl.includes('github.com')) return 'github';
  if (remoteUrl.includes('gitlab.com')) return 'gitlab';
  if (remoteUrl.includes('bitbucket.org')) return 'bitbucket';
  return 'unknown';
}

export async function readGitignoreTemplate(template: string): Promise<string> {
  const normalized = template.toLowerCase();

  if (normalized === 'node') {
    return ['node_modules', 'dist', 'coverage', '.env', '.env.*', '*.log', '.DS_Store'].join('\n');
  }
  if (normalized === 'python') {
    return ['__pycache__', '.pytest_cache', '.ruff_cache', '.venv', 'dist', '.env', '.env.*'].join('\n');
  }
  if (normalized === 'go') {
    return ['bin', '*.test', '.env', '.env.*'].join('\n');
  }
  if (normalized === 'rust') {
    return ['target', 'Cargo.lock', '.env', '.env.*'].join('\n');
  }

  return ['.env', '.env.*', '.DS_Store'].join('\n');
}

export async function readPackageJsonRaw(cwd: string): Promise<string | undefined> {
  const path = join(cwd, 'package.json');
  if (!(await pathExists(path))) return undefined;
  return readFile(path, 'utf8');
}
