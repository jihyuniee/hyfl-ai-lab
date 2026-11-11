import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createPostgresQuery } from '../lib/postgres.mjs';
import { createPostgresCommunity } from '../lib/community-postgres.mjs';
import { importBlobCommunity } from '../lib/community-import.mjs';
import { list, get } from '../lib/blob.mjs';

export function deploymentConnections(env) {
  const fail = code => { const error = new Error(code); error.code = code; throw error; };
  if (!env.DATABASE_URL || !env.DATABASE_URL_UNPOOLED) fail('DATABASE_DIRECT_URL_REQUIRED');
  let direct;
  try { direct = new URL(env.DATABASE_URL_UNPOOLED); } catch { fail('DATABASE_DIRECT_URL_INVALID'); }
  if (!['postgres:', 'postgresql:'].includes(direct.protocol) || direct.hostname.includes('-pooler')) fail('DATABASE_DIRECT_URL_INVALID');
  return { migration: env.DATABASE_URL_UNPOOLED, application: env.DATABASE_URL };
}

export async function prepareCommunityDatabase(query, schema, legacyStorage, applicationQuery = query) {
  // Only create the application's own schema. Existing records and Neon Auth tables are untouched.
  for (const statement of schema.split(';').map(value => value.trim()).filter(Boolean)) await query(statement);
  const legacyImport = legacyStorage ? await importBlobCommunity(query, legacyStorage) : null;
  const id = `diagnostic-${randomUUID()}`;
  const actor = { authenticated: true, id: randomBytes(32).toString('hex'), profile: { name: '비공개 저장소 점검', picture: '' }, email: '', isAdmin: false };
  const other = { ...actor, id: randomBytes(32).toString('hex') };
  const teacher = { ...other, isAdmin: true };
  const service = createPostgresCommunity({ query: applicationQuery, projects: [{ id }], secret: randomBytes(32).toString('hex') });
  const check = (value, code) => { if (!value) { const error = new Error(code); error.code = code; throw error; } };
  try {
    await service.like(id, actor, true, true);
    check((await service.like(id, { ...actor }, true, true)).likes === 1, 'DB_LIKE_DEDUP_FAILED');
    const written = await service.comment(id, actor, '비공개 저장·조회·삭제 연결 점검', true);
    const commentId = written.comments[0]?.id;
    check(written.total === 1 && written.comments[0]?.own, 'DB_COMMENT_WRITE_FAILED');
    const publicPage = await service.comments(id, other);
    check(!publicPage.comments[0].own && !('authorEmail' in publicPage.comments[0]), 'DB_COMMENT_PRIVACY_FAILED');
    let denied = false;
    try { await service.removeComment(id, other, commentId); } catch (error) { denied = error.status === 403; }
    check(denied, 'DB_COMMENT_OWNER_FAILED');
    await service.moderate(id, teacher, commentId, true);
    check((await service.comments(id)).total === 0, 'DB_COMMENT_HIDE_FAILED');
    await service.moderate(id, teacher, commentId, false);
    check((await service.comments(id)).total === 1, 'DB_COMMENT_RESTORE_FAILED');
    await service.removeComment(id, actor, commentId);
    await service.like(id, actor, false);
    const summary = await service.summary(id, actor);
    check(summary.likes === 0 && summary.comments === 0, 'DB_COMMENT_CLEANUP_FAILED');
  } finally {
    // The random project is not registered in the public exhibition; only its own temporary rows are removed.
    await applicationQuery('DELETE FROM hyfl_community.comments WHERE project_id = $1', [id]);
    await applicationQuery('DELETE FROM hyfl_community.likes WHERE project_id = $1', [id]);
  }
  return { schemaReady: true, privateStorageTest: true, diagnosticRowsRemoved: true, ...(legacyImport ? { legacyImport } : {}) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.DATABASE_URL) console.log('Postgres is not configured; the existing Blob backend is retained.');
  else {
    try {
      const schema = await readFile(new URL('../sql/community.sql', import.meta.url), 'utf8');
      const connections = deploymentConnections(process.env);
      const legacyStorage = (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) ? {
        async list(prefix) {
          const files = []; let cursor;
          do { const page = await list({ prefix, cursor, limit: 1000 }); files.push(...page.blobs); cursor = page.hasMore ? page.cursor : undefined; } while (cursor);
          return files;
        },
        async read(path) {
          const result = await get(path, { access: 'private', useCache: false });
          return result?.statusCode === 200 ? JSON.parse(await new Response(result.stream).text()) : null;
        }
      } : null;
      const result = await prepareCommunityDatabase(createPostgresQuery(connections.migration), schema, legacyStorage, createPostgresQuery(connections.application));
      console.log('Community database verification:', JSON.stringify(result));
    } catch (error) {
      // Do not log connection strings, query parameters, user records, or raw database errors.
      const code = /^[A-Z0-9_]{3,64}$/.test(error.code || '') ? error.code : 'DATABASE_PREPARATION_FAILED';
      console.error('Community database preparation failed:', code);
      process.exitCode = 1;
    }
  }
}
