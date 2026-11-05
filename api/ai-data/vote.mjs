import { prepare, failure, service } from '../../services/ai-data-voting/lib/http.mjs';
import { VoteError } from '../../services/ai-data-voting/lib/voting.mjs';
export default async function handler(req, res) {
  if (!prepare(req, res, ['GET', 'POST'])) return;
  try {
    if (req.method === 'POST' && !req.headers['content-type']?.startsWith('application/json'))
      throw new VoteError(415, 'JSON 요청이 필요합니다.');
    if (Number(req.headers['content-length'] || 0) > 16384 || JSON.stringify(req.body || {}).length > 16384)
      throw new VoteError(413, '요청이 너무 큽니다.');
    const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
    res.status(200).json(await service({ method: req.method, token, body: req.body }));
  } catch (error) { failure(res, error); }
}
