import test from 'node:test';
import assert from 'node:assert/strict';
import { createMessageBus } from '@backend/server/bus/messageBus';
import type { ResearchPort } from '@backend/app/ports';
import { ResearchModule } from '@backend/server/modules/researchModule';
import {
  HybridRetriever,
  lexicalFallback,
  type Retriever,
  type RetrieverRunner,
} from '@backend/server/retrieval/retrieverPort';
import type { WikiNote } from '@shared/domain/wiki';

function note(id: string, title: string, content: string): WikiNote {
  return {
    id,
    title,
    content,
    path: `wiki/${id}.md`,
    tags: [],
    frontmatter: {},
    outboundLinks: [],
    backlinks: [],
  };
}

const notes = [
  note('alpha', 'Alpha protocol', 'alpha gamma delta'),
  note('beta', 'Beta protocol', 'beta gamma'),
];

test('retriever port: lexical fallback uses the existing deterministic ranking', () => {
  const hits = lexicalFallback('alpha', notes, 2);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].id, 'alpha');
  assert.equal(hits[0].channel, 'lexical-fallback');
});

test('retriever port: successful CLI payload maps ranked hits and passes options', async () => {
  let input = '';
  let args: string[] = [];
  const runner: RetrieverRunner = (_command, commandArgs, options) => {
    args = commandArgs;
    input = options.input;
    return {
      status: 0,
      stdout: JSON.stringify({
        status: 'success',
        results: [
          { id: 'beta', score: 0.6, channel: 'semantic' },
          { id: 'alpha', score: 0.5, channel: 'lexical' },
          { id: 'missing', score: 0.9 },
          { id: 'beta', score: 0.8 },
        ],
      }),
      stderr: '',
    };
  };
  const retriever = new HybridRetriever({ rootDir: '/repo', runner });
  const hits = await retriever.retrieve('query', notes, { limit: 2, projectId: 'demo', hops: 1 });

  assert.deepEqual(hits.map(hit => hit.id), ['beta', 'alpha']);
  assert.equal(hits[0].channel, 'semantic');
  assert.ok(args.includes('--root') && args.includes('/repo'));
  assert.ok(args.includes('--scope') && args.includes('demo'));
  assert.ok(args.includes('--query') && args.includes('query'));
  assert.ok(args.includes('--limit') && args.includes('2'));
  assert.ok(args.includes('--hops') && args.includes('1'));
  assert.deepEqual(JSON.parse(input).notes.map((item: { id: string }) => item.id), ['alpha', 'beta']);
});

test('retriever port: invalid or failed CLI results fall back to lexical ranking', async () => {
  const failures: Array<RetrieverRunner> = [
    () => ({ status: 1, stdout: '', stderr: 'boom' }),
    () => ({ status: 0, stdout: 'not json', stderr: '' }),
    () => ({ status: 0, stdout: JSON.stringify({ status: 'error' }), stderr: '' }),
    () => ({ status: null, stdout: '', stderr: '', error: 'spawn failed' }),
  ];
  for (const runner of failures) {
    const hits = await new HybridRetriever({ runner }).retrieve('alpha', notes, { limit: 2 });
    assert.deepEqual(hits.map(hit => hit.id), ['alpha']);
    assert.equal(hits[0].channel, 'lexical-fallback');
  }
});

test('retriever port: update sends deletions and reports CLI failures', async () => {
  let args: string[] = [];
  const ok: RetrieverRunner = (_command, commandArgs) => {
    args = commandArgs;
    return { status: 0, stdout: JSON.stringify({ status: 'success' }), stderr: '' };
  };
  assert.equal(await new HybridRetriever({ runner: ok }).update(notes[0], {
    projectId: 'demo',
    deletedIds: ['old'],
  }), true);
  assert.ok(args.includes('update'));
  assert.ok(args.includes('--scope') && args.includes('demo'));
  assert.ok(args.includes('--delete-ids') && args.includes('old'));

  const fail: RetrieverRunner = () => ({ status: 0, stdout: JSON.stringify({ status: 'error' }), stderr: '' });
  assert.equal(await new HybridRetriever({ runner: fail }).update(notes), false);
});

test('research.search ranks notes through an injected retriever', async () => {
  const retriever: Retriever = {
    retrieve: async () => [
      { id: 'beta', score: 0.8, channel: 'hybrid' },
      { id: 'unknown', score: 0.9, channel: 'hybrid' },
    ],
    update: async () => true,
  };
  const services = {
    readAllWikiNotes: async () => notes,
  } as unknown as ResearchPort;
  const bus = createMessageBus();
  new ResearchModule(services, retriever).register(bus);

  const result = await bus.dispatch('research.search', { q: 'alpha', limit: 2 }, { projectId: 'demo' });
  assert.equal(result.kind, 'json');
  const body = (result as { body: { success: boolean; results: Array<{ note: { id: string } }>; total: number } }).body;
  assert.equal(body.success, true);
  assert.equal(body.total, 1);
  assert.equal(body.results[0].note.id, 'beta');
});
