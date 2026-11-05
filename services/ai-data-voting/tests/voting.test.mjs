import test from 'node:test';
import assert from 'node:assert/strict';
import { configuration, phase, schoolVoter, validProject, createService, tally, CAST_VOTE } from '../lib/voting.mjs';
const env = {
  GOOGLE_CLIENT_ID: 'test-client', SCHOOL_DOMAINS: 'school.example', VOTER_HASH_SECRET: 'x'.repeat(32),
  UPSTASH_REDIS_REST_URL: 'https://test.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'test',
  VOTING_START: '2026-11-10T00:00:00Z', VOTING_END: '2026-11-20T00:00:00Z', VOTING_ENABLED: 'true'
};
const projects = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }];
const payload = { sub: 'student-1', hd: 'school.example', email_verified: true, email: 'private@school.example' };
const now = () => Date.parse('2026-11-15T00:00:00Z');
function fixture(overrides = {}) {
  const values = new Map(), calls = [];
  const service = createService({ env, projects, now, verify: async () => payload,
    redis: async command => {
      calls.push(command);
      if (command[0] === 'HGET') return values.get(command[2]) || null;
      if (command[1] !== CAST_VOTE) return 1;
      const [, , , , voter, projectId] = command;
      if (projectId) values.set(voter, projectId); else values.delete(voter);
      return [1, projectId];
    }, ...overrides });
  return { service, calls, values };
}
const post = projectId => ({ method: 'POST', token: 'verified-test-token', body: { projectId } });
test('missing configuration and disabled elections fail closed', () => {
  assert.equal(phase(configuration({})), 'preparing');
  assert.equal(phase(configuration({ ...env, VOTING_ENABLED: 'false' }), now()), 'preparing');
  assert.equal(configuration({ ...env, VOTING_END: 'bad' }).ready, false);
});
test('exact opening and closing boundaries', () => {
  const c = configuration(env);
  assert.equal(phase(c, c.start - 1), 'upcoming');
  assert.equal(phase(c, c.start), 'open');
  assert.equal(phase(c, c.end - 1), 'open');
  assert.equal(phase(c, c.end), 'closed');
});
test('verified Workspace domain is required, not an email suffix', () => {
  for (const p of [{ ...payload, hd: undefined }, { ...payload, hd: 'evil.example' },
    { ...payload, email_verified: false }, { ...payload, sub: '' }]) {
    assert.throws(() => schoolVoter(p, configuration(env)), { status: 403 });
  }
});
test('stored identifier is keyed, stable, and contains no email or raw subject', () => {
  const a = schoolVoter(payload, configuration(env));
  assert.match(a, /^[a-f0-9]{64}$/);
  assert.equal(a, schoolVoter({ ...payload, email: 'changed@school.example' }, configuration(env)));
  assert.notEqual(a, schoolVoter({ ...payload, sub: 'student-2' }, configuration(env)));
  assert.notEqual(a, schoolVoter(payload, configuration({ ...env, VOTER_HASH_SECRET: 'y'.repeat(32) })));
});
test('unknown and missing project IDs rejected; null means cancel', () => {
  for (const id of [undefined, {}, '', 'unknown']) assert.throws(() => validProject(id, projects), { status: 400 });
  assert.equal(validProject(null, projects), null);
});
test('unauthenticated and forged tokens never reach vote storage', async () => {
  const f = fixture({ verify: async () => { throw new Error('invalid signature'); } });
  await assert.rejects(f.service({ ...post('a'), token: '' }), { status: 401 });
  await assert.rejects(f.service(post('a')), { status: 401 });
  assert.equal(f.calls.length, 0);
});
test('wrong school account cannot read or mutate votes', async () => {
  const f = fixture({ verify: async () => ({ ...payload, hd: 'elsewhere.example' }) });
  await assert.rejects(f.service(post('a')), { status: 403 });
  assert.equal(f.calls.length, 0);
});
test('repeat vote is idempotent, changing replaces old choice, cancellation deletes it', async () => {
  const f = fixture();
  await f.service(post('a')); await f.service(post('a'));
  assert.equal(f.values.size, 1);
  await f.service(post('b')); assert.deepEqual([...f.values.values()], ['b']);
  assert.deepEqual(await f.service({ method: 'GET', token: 'valid' }), { projectId: 'b', phase: 'open' });
  await f.service(post(null)); assert.equal(f.values.size, 0);
  assert.equal(f.calls.some(c => c.includes(payload.sub) || c.includes(payload.email)), false);
});
test('closed election rejects changes before verifying identity', async () => {
  const f = fixture({ now: () => Date.parse(env.VOTING_END) });
  await assert.rejects(f.service(post('a')), { status: 409 });
  assert.equal(f.calls.length, 0);
});
test('atomic storage deadline rejection is surfaced', async () => {
  const f = fixture({ redis: async c => c[1] === CAST_VOTE ? [0, ''] : 1 });
  await assert.rejects(f.service(post('a')), { status: 409 });
});
test('rate limit returns a retry message', async () => {
  const f = fixture({ redis: async () => 31 });
  await assert.rejects(f.service(post('a')), { status: 429 });
});
test('tally ignores invalid IDs, includes zero-vote projects, and contains no voter data', () => {
  assert.deepEqual(tally(['a', 'a', 'unknown'], projects), [
    { projectId: 'a', title: 'A', votes: 2 }, { projectId: 'b', title: 'B', votes: 0 }
  ]);
});
