import { profileOf } from './community.mjs';

export async function importBlobCommunity(query, storage) {
  const name = 'blob-community-v1';
  if ((await query('SELECT name FROM hyfl_community.migrations WHERE name = $1', [name])).length) return { alreadyImported: true };
  const files = await storage.list('community/');
  const counts = { likes: 0, comments: 0, moderation: 0, orphanModeration: 0 };
  const fail = code => { const error = new Error(code); error.code = code; throw error; };
  const parsed = files.map(file => {
    const match = /^community\/(likes|comments|moderation)\/([a-z0-9][a-z0-9-]{0,80})\/([0-9a-f]{64}|[0-9]{11}-[0-9a-f]{64})\.json$/.exec(file.pathname);
    if (!match || (match[1] === 'likes') !== /^[0-9a-f]{64}$/.test(match[3])) fail('LEGACY_RECORD_PATH_INVALID');
    return { path: file.pathname, kind: match[1], project: match[2], key: match[3] };
  });
  // Import comments before their moderation markers; the source is read only.
  parsed.sort((a, b) => Number(a.kind === 'moderation') - Number(b.kind === 'moderation'));
  for (const item of parsed) {
    const record = await storage.read(item.path);
    if (!record) fail('LEGACY_RECORD_UNREADABLE');
    const profile = profileOf(record);
    if (item.kind === 'likes') {
      await query(`INSERT INTO hyfl_community.likes (project_id, author_id, profile, created_at)
        VALUES ($1, $2, $3::jsonb, $4) ON CONFLICT DO NOTHING`, [item.project, item.key, profile ? JSON.stringify(profile) : null, record.createdAt]);
      counts.likes++;
    } else if (item.kind === 'comments') {
      await query(`INSERT INTO hyfl_community.comments (project_id, comment_id, author_id, text, profile, author_email, created_at)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7) ON CONFLICT DO NOTHING`,
      [item.project, item.key, record.author, record.text, profile ? JSON.stringify(profile) : null, record.authorEmail || '', record.createdAt]);
      counts.comments++;
    } else {
      const added = await query(`INSERT INTO hyfl_community.moderation (project_id, comment_id, moderator_id, hidden_at)
        SELECT $1, $2, $3, $4 WHERE EXISTS (SELECT 1 FROM hyfl_community.comments WHERE project_id = $1 AND comment_id = $2)
        ON CONFLICT DO NOTHING RETURNING comment_id`, [item.project, item.key, record.moderator || '', record.hiddenAt]);
      if (added.length) counts.moderation++; else counts.orphanModeration++;
    }
  }
  await query('INSERT INTO hyfl_community.migrations (name, details) VALUES ($1, $2::jsonb) ON CONFLICT DO NOTHING', [name, JSON.stringify(counts)]);
  return counts;
}
