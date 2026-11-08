import test from 'node:test';
import assert from 'node:assert/strict';
import { recordToDraft, toRecord, validateDraft } from '../src/validation.ts';

test('cada tipo de registro exige os seus campos e idiomas válidos', () => {
  assert.equal(validateDraft('projects', {}).name, 'Preencha este campo.');
  assert.equal(validateDraft('glossaries', {
    name: 'Glossário', client: 'Cliente', sourceLang: 'en', targetLang: 'pt-BR',
  }).name, undefined);
  assert.equal(validateDraft('terms', {
    original: 'save', translation: 'salvar', sourceLang: 'en', targetLang: 'en', category: 'UI',
  }).targetLang, 'Escolha idiomas diferentes.');
  assert.match(validateDraft('terms', {
    original: 'save', translation: 'salvar', sourceLang: 'xx', targetLang: 'pt-BR', category: 'UI',
  }).sourceLang, /Use en/);
});

test('salvar preserva a data de criação, atualiza o registro e reabre os campos', () => {
  const first = toRecord({ name: '  Manual  ', sourceLang: 'en' }, null, 'id-1', '2026-11-08T10:00:00.000Z');
  const next = toRecord({ name: 'Manual 2', sourceLang: 'en' }, first, 'id-1', '2026-11-08T11:00:00.000Z');
  assert.equal(next.name, 'Manual 2');
  assert.equal(next.createdAt, first.createdAt);
  assert.equal(next.updatedAt, '2026-11-08T11:00:00.000Z');
  assert.deepEqual(recordToDraft(next), { name: 'Manual 2', sourceLang: 'en' });
});

test('origem só aceita referências de texto ou URLs HTTP e HTTPS', () => {
  const base = { original: 'term', translation: 'termo', sourceLang: 'en', targetLang: 'pt-BR', category: 'UI' };
  assert.equal(validateDraft('terms', { ...base, source: 'https://example.org' }).source, undefined);
  assert.match(validateDraft('terms', { ...base, source: 'javascript:alert(1)' }).source, /URL/);
});
