import { prepare, failure, publicStatus } from '../../services/ai-data-voting/lib/http.mjs';
export default async function handler(req, res) {
  if (!prepare(req, res, ['GET'])) return;
  try { res.status(200).json(await publicStatus()); }
  catch (error) { failure(res, error); }
}
