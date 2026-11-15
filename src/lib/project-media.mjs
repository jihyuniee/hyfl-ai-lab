import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export function getProjectCover(id) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error('Invalid project ID');
  const bytes = readFileSync(`public/exhibition/ai-data/covers/${id}.webp`);
  const version = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
  return { bytes, version, path: `/exhibition/ai-data/covers/${id}-${version}.webp` };
}

export function getProjectRevision(project) {
  return createHash('sha256')
    .update(JSON.stringify(project))
    .update(getProjectCover(project.id).version)
    .digest('hex').slice(0, 12);
}
