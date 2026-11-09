import { createHmac } from 'node:crypto';

export class CommunityError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createCommunity({ storage, projects, secret, now = Date.now }) {
  function project(id) {
    if (!projects.some(item => item.id === id)) throw new CommunityError(400, '등록된 작품을 선택해 주세요.');
    return id;
  }
  function visitor(token) {
    if (!uuid.test(token || '')) throw new CommunityError(401, '이 브라우저에서 참여 정보를 만들 수 없습니다. 저장 설정을 확인해 주세요.');
    if (!secret || secret.length < 32) throw new CommunityError(503, '관람객 반응을 준비하고 있습니다.');
    return createHmac('sha256', secret).update('community-v1:' + token).digest('hex');
  }
  function likePath(id, author) { return `community/likes/${id}/${author}.json`; }
  async function summary(id, token) {
    project(id);
    const author = token ? visitor(token) : null;
    const [likes, comments] = await Promise.all([storage.list(`community/likes/${id}/`), storage.list(`community/comments/${id}/`)]);
    return { projectId: id, likes: likes.length, comments: comments.length,
      liked: author ? likes.some(item => item.pathname === likePath(id, author)) : false };
  }
  return {
    summary,
    async all(token) { return Promise.all(projects.map(item => summary(item.id, token))); },
    async like(id, token, liked) {
      project(id);
      const author = visitor(token);
      if (typeof liked !== 'boolean') throw new CommunityError(400, '좋아요 상태를 확인해 주세요.');
      if (liked) await storage.create(likePath(id, author), { createdAt: new Date(now()).toISOString() }, true);
      else await storage.remove(likePath(id, author));
      return summary(id, token);
    },
    async comments(id, token) {
      project(id);
      const author = token ? visitor(token) : null;
      const files = await storage.list(`community/comments/${id}/`);
      const items = await Promise.all(files.sort((a, b) => a.pathname.localeCompare(b.pathname)).slice(0, 50).map(async file => {
        const comment = await storage.read(file.pathname);
        if (!comment) return null;
        return { id: file.pathname.split('/').at(-1).replace('.json', ''), text: comment.text,
          createdAt: comment.createdAt, own: comment.author === author };
      }));
      return { comments: items.filter(Boolean), total: files.length };
    },
    async comment(id, token, text) {
      project(id);
      const author = visitor(token);
      if (typeof text !== 'string' || !text.trim() || text.trim().length > 300) throw new CommunityError(400, '댓글은 1~300자로 작성해 주세요.');
      const minute = Math.floor(now() / 60000);
      const commentKey = createHmac('sha256', secret).update(`${id}:${minute}:${author}`).digest('hex');
      const key = `${99999999999 - minute}-${commentKey}`;
      const path = `community/comments/${id}/${key}.json`;
      const created = await storage.create(path, { text: text.trim(), author, createdAt: new Date(now()).toISOString() });
      if (!created) throw new CommunityError(429, '댓글을 남겼어요. 다음 댓글은 잠시 후 작성해 주세요.');
      return this.comments(id, token);
    },
    async removeComment(id, token, commentId) {
      project(id);
      const author = visitor(token);
      if (!/^\d{11}-[0-9a-f]{64}$/.test(commentId || '')) throw new CommunityError(400, '댓글을 확인해 주세요.');
      const path = `community/comments/${id}/${commentId}.json`;
      const comment = await storage.read(path);
      if (!comment) throw new CommunityError(404, '이미 삭제된 댓글입니다.');
      if (comment.author !== author) throw new CommunityError(403, '이 브라우저에서 작성한 댓글만 삭제할 수 있습니다.');
      await storage.remove(path);
      return this.comments(id, token);
    }
  };
}
