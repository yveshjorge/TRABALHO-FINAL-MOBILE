import test from 'node:test';
import assert from 'node:assert/strict';
import { createTmxCollector } from '../src/tmx-parser.ts';

const header = '<?xml version="1.0"?><tmx version="1.4"><body>';
const footer = '</body></tmx>';

function unit(source: string, target: string) {
  return '<tu><tuv xml:lang="en"><seg>' + source + '</seg></tuv><tuv xml:lang="pt-BR"><seg>' + target + '</seg></tuv></tu>';
}

test('lê segmentos, decodifica entidades e escolhe o idioma regional exato', () => {
  const parser = createTmxCollector('en', 'pt-BR', 4);
  parser.write(header + '<tu><tuv xml:lang="pt"><seg>Português genérico</seg></tuv><tuv xml:lang="pt-BR"><seg>Português do Brasil</seg></tuv><tuv xml:lang="en"><seg>Health &amp; care</seg></tuv></tu>');
  parser.write(footer);
  parser.close();
  assert.deepEqual(parser.pairs, [{ source: 'Health & care', target: 'Português do Brasil' }]);
});

test('processa lotes e nunca ultrapassa o limite da amostra', () => {
  const parser = createTmxCollector('en', 'pt-BR', 2);
  parser.write(header + unit('Good morning', 'Bom dia') + unit('Good night', 'Boa noite') + unit('Thank you', 'Obrigado'));
  assert.equal(parser.done(), true);
  assert.deepEqual(parser.pairs, [
    { source: 'Good morning', target: 'Bom dia' },
    { source: 'Good night', target: 'Boa noite' },
  ]);
});

test('não inclui placeholders inline e recusa XML quebrado ou DTD interna', () => {
  const inline = '<tu><tuv xml:lang="en"><seg>Click <ph>&lt;tag&gt;</ph> here</seg></tuv><tuv xml:lang="pt-BR"><seg>Clique aqui</seg></tuv></tu>';
  const parser = createTmxCollector('en', 'pt-BR', 2);
  parser.write(header + inline + footer);
  parser.close();
  assert.equal(parser.pairs[0].source, 'Click  here');
  const broken = createTmxCollector('en', 'pt-BR', 2);
  assert.throws(() => { broken.write('<tmx><body><tu>'); broken.close(); }, /XML inválido/);
  const dtd = createTmxCollector('en', 'pt-BR', 2);
  assert.throws(() => dtd.write('<!DOCTYPE tmx [<!ENTITY x \"y\">]><tmx/>'), /DTD interna/);
});
