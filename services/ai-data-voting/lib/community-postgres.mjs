import { createHmac } from 'node:crypto';
import { CommunityError, communityIdentity, profileOf, validComment } from './community.mjs';

export function createPostgresCommunity({ query, projects, secret, now = Date.now }) {
  const { project, signedIn, owns } = communityIdentity({ projects, secret });
  const summaries = async (ids, actor) => query(`
    WITH requested AS (
      SELECT project_id, ord FROM unnest($1::text[]) WITH ORDINALITY AS p(project_id, ord)
    ), ranked_likes AS (
      SELECT project_id, author_id, profile,
        row_number() OVER (PARTITION BY project_id ORDER BY author_id) AS rank
      FROM hyfl_community.likes WHERE project_id = ANY($1::text[])
    ), like_counts AS (
      SELECT project_id, count(*)::int AS likes, coalesce(bool_or(author_id = $2), false) AS liked,
        coalesce(jsonb_agg(jsonb_build_object('name', profile->>'name', 'picture', coalesce(profile->>'picture', '')) ORDER BY author_id)
          FILTER (WHERE rank <= 4 AND profile IS NOT NULL), '[]'::jsonb) AS people
      FROM ranked_likes GROUP BY project_id
    ), comment_counts AS (
      SELECT c.project_id, count(*)::int AS comments FROM hyfl_community.comments c
      LEFT JOIN hyfl_community.moderation m USING (project_id, comment_id)
      LEFT JOIN hyfl_community.moderation pm ON pm.project_id = c.project_id AND pm.comment_id = c.parent_id
      WHERE c.project_id = ANY($1::text[]) AND c.deleted_at IS NULL AND m.comment_id IS NULL AND pm.comment_id IS NULL GROUP BY c.project_id
    )
    SELECT r.project_id AS "projectId", coalesce(l.likes, 0) AS likes, coalesce(c.comments, 0) AS comments,
      coalesce(l.liked, false) AS liked, coalesce(l.people, '[]'::jsonb) AS people
    FROM requested r LEFT JOIN like_counts l USING (project_id) LEFT JOIN comment_counts c USING (project_id)
    ORDER BY r.ord`, [ids, actor?.id || null]);

  const service = {
    async summary(id, actor) { project(id); return (await summaries([id], actor))[0]; },
    async all(actor) { return summaries(projects.map(item => item.id), actor); },
    async like(id, actor, liked, consent) {
      project(id); const author = signedIn(actor);
      if (typeof liked !== 'boolean') throw new CommunityError(400, '좋아요 상태를 확인해 주세요.');
      if (liked && consent !== true) throw new CommunityError(400, '이름과 프로필 공개 안내를 확인해 주세요.');
      if (liked) await query(`INSERT INTO hyfl_community.likes (project_id, author_id, profile, created_at)
        VALUES ($1, $2, $3::jsonb, $4) ON CONFLICT (project_id, author_id) DO NOTHING`,
      [id, author, JSON.stringify(actor.profile), new Date(now()).toISOString()]);
      else await query('DELETE FROM hyfl_community.likes WHERE project_id = $1 AND author_id = $2', [id, author]);
      return service.summary(id, actor);
    },
    async likers(id, cursor = '') {
      project(id);
      if (cursor && !/^[0-9a-f]{64}$/.test(cursor)) throw new CommunityError(400, '목록 위치를 확인해 주세요.');
      const [result] = await query(`WITH page AS (
        SELECT author_id, profile FROM hyfl_community.likes
        WHERE project_id = $1 AND author_id > $2 COLLATE "C" ORDER BY author_id LIMIT 51
      ) SELECT (SELECT count(*)::int FROM hyfl_community.likes WHERE project_id = $1) AS total,
        coalesce((SELECT jsonb_agg(to_jsonb(page) ORDER BY author_id) FROM page), '[]'::jsonb) AS entries`, [id, cursor]);
      const page = result.entries.slice(0, 50);
      return { people: page.map(profileOf).filter(Boolean), total: result.total,
        anonymous: page.filter(row => !row.profile).length,
        nextCursor: result.entries.length > 50 ? page.at(-1).author_id : null };
    },
    async comments(id, actor, { legacyToken, cursor = '', manage = false, parentId = null } = {}) {
      project(id);
      if (manage && !actor?.isAdmin) throw new CommunityError(403, '선생님만 댓글을 관리할 수 있습니다.');
      if (cursor && !validComment(cursor)) throw new CommunityError(400, '목록 위치를 확인해 주세요.');
      if (parentId !== null && !validComment(parentId)) throw new CommunityError(400, '답글을 남길 댓글을 확인해 주세요.');
      const [result] = await query(`WITH visible AS (
        SELECT c.*, (m.comment_id IS NOT NULL) AS hidden FROM hyfl_community.comments c
        LEFT JOIN hyfl_community.moderation m USING (project_id, comment_id)
        LEFT JOIN hyfl_community.moderation pm ON pm.project_id = c.project_id AND pm.comment_id = c.parent_id
        WHERE c.project_id = $1 AND ($3::boolean OR (m.comment_id IS NULL AND pm.comment_id IS NULL))
      ), threads AS (
        SELECT c.*, (SELECT count(*)::int FROM visible r WHERE r.parent_id = c.comment_id AND r.deleted_at IS NULL) AS reply_count
        FROM visible c WHERE c.parent_id IS NULL
      ), page AS (
        SELECT c.*, 0 AS reply_count FROM visible c
        WHERE $4::text IS NOT NULL AND c.parent_id = $4 AND c.deleted_at IS NULL AND c.comment_id > $2 COLLATE "C"
        UNION ALL
        SELECT t.* FROM threads t WHERE $4::text IS NULL AND (t.deleted_at IS NULL OR t.reply_count > 0) AND t.comment_id > $2 COLLATE "C"
        ORDER BY comment_id LIMIT 21
      ) SELECT (SELECT count(*)::int FROM visible WHERE deleted_at IS NULL AND ($4::text IS NULL OR parent_id = $4)) AS total,
        ($4::text IS NULL OR EXISTS (SELECT 1 FROM threads WHERE comment_id = $4)) AS parent_exists,
        coalesce((SELECT jsonb_agg(to_jsonb(page) ORDER BY comment_id) FROM page), '[]'::jsonb) AS entries`, [id, cursor, manage, parentId]);
      if (!result.parent_exists) throw new CommunityError(404, '삭제되거나 숨겨진 댓글입니다. 댓글 목록을 다시 열어 주세요.');
      const page = result.entries.slice(0, 20);
      return { comments: page.map(row => ({ id: row.comment_id, text: row.text,
        createdAt: new Date(row.created_at).toISOString(), profile: profileOf(row),
        parentId: row.parent_id, replyCount: row.reply_count, deleted: Boolean(row.deleted_at),
        own: !row.deleted_at && owns({ author: row.author_id }, actor, legacyToken),
        ...(manage ? { hidden: row.hidden, authorEmail: row.author_email || null } : {}) })),
      total: result.total, nextCursor: result.entries.length > 20 ? page.at(-1).comment_id : null };
    },
    async comment(id, actor, text, consent, parentId = null) {
      project(id); const author = signedIn(actor);
      if (consent !== true) throw new CommunityError(400, '이름과 프로필 공개 안내를 확인해 주세요.');
      if (typeof text !== 'string' || !text.trim() || text.trim().length > 300) throw new CommunityError(400, '댓글은 1~300자로 작성해 주세요.');
      if (parentId !== null && !validComment(parentId)) throw new CommunityError(400, '답글을 남길 댓글을 확인해 주세요.');
      const minute = Math.floor(now() / 60000);
      const key = `${99999999999 - minute}-${createHmac('sha256', secret).update(`${id}:${minute}:${author}`).digest('hex')}`;
      // Lock the parent while inserting so deletion cannot turn a reply into an orphan.
      const [created] = await query(`WITH parent AS (
        SELECT p.comment_id FROM hyfl_community.comments p
        WHERE p.project_id = $1 AND p.comment_id = $8 AND p.parent_id IS NULL AND p.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM hyfl_community.moderation m WHERE m.project_id = p.project_id AND m.comment_id = p.comment_id)
        FOR UPDATE OF p
      ), inserted AS (
        INSERT INTO hyfl_community.comments (project_id, comment_id, author_id, text, profile, author_email, created_at, parent_id)
        SELECT $1, $2, $3, $4, $5::jsonb, $6, $7::timestamptz, $8::text
        WHERE ($8::text IS NULL OR EXISTS (SELECT 1 FROM parent)) AND ($8::text IS NULL OR $8 <> $2)
        ON CONFLICT (project_id, comment_id) DO NOTHING RETURNING comment_id
      ) SELECT ($8::text IS NULL OR EXISTS (SELECT 1 FROM parent)) AS parent_exists,
        EXISTS (SELECT 1 FROM inserted) AS inserted`,
      [id, key, author, text.trim(), JSON.stringify(actor.profile), actor.email || '', new Date(now()).toISOString(), parentId]);
      if (!created.parent_exists) throw new CommunityError(404, '삭제되거나 숨겨진 댓글에는 답글을 남길 수 없습니다. 댓글 목록을 다시 열어 주세요.');
      if (!created.inserted) throw new CommunityError(429, '댓글과 답글은 합쳐서 분당 한 번 작성할 수 있어요. 잠시 후 다시 남겨 주세요.');
      return service.comments(id, actor, { parentId });
    },
    async removeComment(id, actor, commentId, legacyToken) {
      project(id);
      if (!validComment(commentId)) throw new CommunityError(400, '댓글을 확인해 주세요.');
      const [record] = await query('SELECT author_id AS author, deleted_at FROM hyfl_community.comments WHERE project_id = $1 AND comment_id = $2', [id, commentId]);
      if (!record || record.deleted_at) throw new CommunityError(404, '이미 삭제된 댓글입니다.');
      if (!owns(record, actor, legacyToken)) throw new CommunityError(403, '본인이 작성한 댓글만 삭제할 수 있습니다.');
      // Redact the author's content and keep only a placeholder if other people's replies remain.
      // Retain moderation so deleting a hidden parent cannot republish its hidden discussion.
      await query(`UPDATE hyfl_community.comments SET text = '삭제된 댓글입니다.', profile = NULL, author_email = '', deleted_at = $3
        WHERE project_id = $1 AND comment_id = $2 AND deleted_at IS NULL`, [id, commentId, new Date(now()).toISOString()]);
      return service.comments(id, actor, { legacyToken });
    },
    async moderate(id, actor, commentId, hidden) {
      project(id);
      if (!actor?.isAdmin) throw new CommunityError(403, '선생님만 댓글을 관리할 수 있습니다.');
      if (!validComment(commentId) || typeof hidden !== 'boolean') throw new CommunityError(400, '댓글을 확인해 주세요.');
      const [record] = await query('SELECT comment_id FROM hyfl_community.comments WHERE project_id = $1 AND comment_id = $2', [id, commentId]);
      if (!record) throw new CommunityError(404, '이미 삭제된 댓글입니다.');
      if (hidden) {
        try { await query(`INSERT INTO hyfl_community.moderation (project_id, comment_id, moderator_id, hidden_at)
          VALUES ($1, $2, $3, $4) ON CONFLICT (project_id, comment_id) DO NOTHING`, [id, commentId, actor.id, new Date(now()).toISOString()]); }
        catch (error) { if (error.code === '23503') throw new CommunityError(404, '이미 삭제된 댓글입니다.'); throw error; }
      } else await query('DELETE FROM hyfl_community.moderation WHERE project_id = $1 AND comment_id = $2', [id, commentId]);
      return service.comments(id, actor, { manage: true });
    }
  };
  return service;
}
