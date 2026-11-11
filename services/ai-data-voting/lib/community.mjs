import { createHmac } from 'node:crypto';

export class CommunityError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const isLegacyVisitor = token => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token || '');
const validComment = id => /^\d{11}-[0-9a-f]{64}$/.test(id || '');
const fileId = file => file.pathname.split('/').at(-1).replace('.json', '');
const profileOf = record => record?.profile ? { name: record.profile.name, picture: record.profile.picture || '' } : null;

export function createCommunity({ storage, projects, secret, now = Date.now }) {
  function project(id) {
    if (!projects.some(item => item.id === id)) throw new CommunityError(400, '등록된 작품을 선택해 주세요.');
  }
  function school(actor) {
    if (!actor?.school || !/^[0-9a-f]{64}$/.test(actor.id || '')) throw new CommunityError(401, '학교 구글 계정으로 로그인해 주세요.');
    return actor.id;
  }
  function legacy(token) {
    return isLegacyVisitor(token) && secret?.length >= 32 ? createHmac('sha256', secret).update('community-v1:' + token).digest('hex') : null;
  }
  function owns(record, actor, legacyToken) { return Boolean(record?.author && ((actor?.id && record.author === actor.id) || (legacy(legacyToken) && record.author === legacy(legacyToken)))); }
  function likePath(id, author) { return `community/likes/${id}/${author}.json`; }
  async function commentFiles(id, manage = false) {
    const files = await storage.list(`community/comments/${id}/`);
    const hidden = new Set((await storage.list(`community/moderation/${id}/`)).map(fileId));
    return { files: files.filter(file => manage || !hidden.has(fileId(file))), hidden };
  }
  async function summary(id, actor) {
    project(id);
    const [likes, comments] = await Promise.all([storage.list(`community/likes/${id}/`), commentFiles(id)]);
    const previews = await Promise.all(likes.slice(0, 4).map(file => storage.read(file.pathname)));
    return { projectId: id, likes: likes.length, comments: comments.files.length,
      liked: Boolean(actor && likes.some(file => file.pathname === likePath(id, actor.id))), people: previews.map(profileOf).filter(Boolean) };
  }
  return {
    summary,
    async all(actor) { return Promise.all(projects.map(item => summary(item.id, actor))); },
    async like(id, actor, liked, consent) {
      project(id); const author = school(actor);
      if (typeof liked !== 'boolean') throw new CommunityError(400, '좋아요 상태를 확인해 주세요.');
      if (liked && consent !== true) throw new CommunityError(400, '이름과 프로필 공개 안내를 확인해 주세요.');
      if (liked) await storage.create(likePath(id, author), { createdAt: new Date(now()).toISOString(), profile: actor.profile }, true);
      else await storage.remove(likePath(id, author));
      return summary(id, actor);
    },
    async likers(id, cursor = '') {
      project(id);
      if (cursor && !/^[0-9a-f]{64}$/.test(cursor)) throw new CommunityError(400, '목록 위치를 확인해 주세요.');
      const files = (await storage.list(`community/likes/${id}/`)).sort((a, b) => a.pathname.localeCompare(b.pathname));
      const page = files.filter(file => !cursor || fileId(file) > cursor).slice(0, 50);
      const records = await Promise.all(page.map(file => storage.read(file.pathname)));
      return { people: records.map(profileOf).filter(Boolean), total: files.length, anonymous: records.filter(record => record && !record.profile).length,
        nextCursor: page.length && files.some(file => file.pathname > page.at(-1).pathname) ? fileId(page.at(-1)) : null };
    },
    async comments(id, actor, { legacyToken, cursor = '', manage = false } = {}) {
      project(id);
      if (manage && !actor?.isAdmin) throw new CommunityError(403, '선생님만 댓글을 관리할 수 있습니다.');
      if (cursor && !validComment(cursor)) throw new CommunityError(400, '목록 위치를 확인해 주세요.');
      const { files, hidden } = await commentFiles(id, manage);
      const sorted = files.sort((a, b) => a.pathname.localeCompare(b.pathname));
      const page = sorted.filter(file => !cursor || fileId(file) > cursor).slice(0, 20);
      const items = await Promise.all(page.map(async file => {
        const record = await storage.read(file.pathname);
        if (!record) return null;
        return { id: fileId(file), text: record.text, createdAt: record.createdAt, profile: profileOf(record), own: owns(record, actor, legacyToken),
          ...(manage ? { hidden: hidden.has(fileId(file)), authorEmail: record.authorEmail || null } : {}) };
      }));
      return { comments: items.filter(Boolean), total: sorted.length,
        nextCursor: page.length && sorted.some(file => file.pathname > page.at(-1).pathname) ? fileId(page.at(-1)) : null };
    },
    async comment(id, actor, text, consent) {
      project(id); const author = school(actor);
      if (consent !== true) throw new CommunityError(400, '이름과 프로필 공개 안내를 확인해 주세요.');
      if (typeof text !== 'string' || !text.trim() || text.trim().length > 300) throw new CommunityError(400, '댓글은 1~300자로 작성해 주세요.');
      const minute = Math.floor(now() / 60000);
      const commentKey = createHmac('sha256', secret).update(`${id}:${minute}:${author}`).digest('hex');
      const key = `${99999999999 - minute}-${commentKey}`;
      const created = await storage.create(`community/comments/${id}/${key}.json`, {
        text: text.trim(), author, profile: actor.profile, authorEmail: actor.email || '', createdAt: new Date(now()).toISOString() });
      if (!created) throw new CommunityError(429, '댓글을 남겼어요. 다음 댓글은 잠시 후 작성해 주세요.');
      return this.comments(id, actor);
    },
    async removeComment(id, actor, commentId, legacyToken) {
      project(id);
      if (!validComment(commentId)) throw new CommunityError(400, '댓글을 확인해 주세요.');
      const path = `community/comments/${id}/${commentId}.json`;
      const record = await storage.read(path);
      if (!record) throw new CommunityError(404, '이미 삭제된 댓글입니다.');
      if (!owns(record, actor, legacyToken)) throw new CommunityError(403, '본인이 작성한 댓글만 삭제할 수 있습니다.');
      await storage.remove(path);
      await storage.remove(`community/moderation/${id}/${commentId}.json`);
      return this.comments(id, actor, { legacyToken });
    },
    async moderate(id, actor, commentId, hidden) {
      project(id);
      if (!actor?.isAdmin) throw new CommunityError(403, '선생님만 댓글을 관리할 수 있습니다.');
      if (!validComment(commentId) || typeof hidden !== 'boolean') throw new CommunityError(400, '댓글을 확인해 주세요.');
      if (!await storage.read(`community/comments/${id}/${commentId}.json`)) throw new CommunityError(404, '이미 삭제된 댓글입니다.');
      const path = `community/moderation/${id}/${commentId}.json`;
      if (hidden) await storage.create(path, { hiddenAt: new Date(now()).toISOString(), moderator: actor.id }, true);
      else await storage.remove(path);
      return this.comments(id, actor, { manage: true });
    }
  };
}
