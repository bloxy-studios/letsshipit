import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { analyzeProject, detectPackageManager } from '../src/core/project.js';

let dirs: string[] = [];

describe('project detection', () => {
  afterEach(async () => {
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
    dirs = [];
  });

  it('detects pnpm and Next.js', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'shipit-project-'));
    dirs.push(dir);
    await writeFile(join(dir, 'pnpm-lock.yaml'), '');
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({
        name: 'app',
        scripts: { lint: 'next lint', test: 'vitest', build: 'next build' },
        dependencies: { next: '^15.0.0', react: '^19.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      }),
    );

    expect(await detectPackageManager(dir)).toBe('pnpm');
    const analysis = await analyzeProject(dir);
    expect(analysis.projectType).toBe('next');
    expect(analysis.checks.lint).toBe('pnpm run lint');
  });
});
