import { SaxesParser } from 'saxes';

export type TranslationPair = { source: string; target: string };

function languageMatch(actual: string, expected: string) {
  const normalized = actual.toLowerCase();
  const requested = expected.toLowerCase();
  if (normalized === requested) return true;
  return !requested.includes('-') && normalized.split('-')[0] === requested;
}

export function createTmxCollector(source: string, target: string, maxPairs: number) {
  const parser = new SaxesParser({ xmlns: true });
  const pairs: TranslationPair[] = [];
  const stack: string[] = [];
  let variants: Array<{ lang: string; text: string }> | null = null;
  let current: { lang: string; text: string; hasSegment: boolean } | null = null;
  let insideSegment = false;
  let suppressed = 0;
  let unitChars = 0;
  let parseError = '';
  const fail = (message: string) => { parseError ||= message; };

  parser.on('error', () => fail('O arquivo TMX tem XML inválido.'));
  parser.on('doctype', (value) => {
    if (value.includes('[')) fail('O arquivo TMX com entidades DTD internas não é aceito.');
  });
  parser.on('opentag', (node) => {
    const name = node.local;
    const parent = stack.at(-1);
    if (!stack.length && name !== 'tmx') fail('O arquivo não tem o formato TMX.');
    if (stack.length > 64) fail('O TMX ultrapassou o limite de profundidade XML.');
    if (name === 'tu') {
      if (parent !== 'body' || variants) fail('Unidade TMX em posição inválida.');
      variants = [];
      unitChars = 0;
    } else if (name === 'tuv') {
      if (parent !== 'tu' || !variants || variants.length >= 64) fail('Variante TMX inválida.');
      const langAttr = node.attributes['xml:lang'] ?? node.attributes.lang;
      current = { lang: langAttr?.value ?? '', text: '', hasSegment: false };
    } else if (name === 'seg') {
      if (parent !== 'tuv' || !current || current.hasSegment) fail('Segmento TMX inválido.');
      if (current) current.hasSegment = true;
      insideSegment = true;
    } else if (insideSegment && ['bpt', 'ept', 'ph', 'it', 'ut'].includes(name)) {
      suppressed += 1;
    }
    stack.push(name);
  });
  const addText = (value: string) => {
    if (variants && (unitChars += value.length) > 262144) fail('Unidade TMX muito grande.');
    if (insideSegment && current && !suppressed) {
      current.text += value;
      if (current.text.length > 65536) fail('Segmento TMX muito grande.');
    }
  };
  parser.on('text', addText);
  parser.on('cdata', addText);
  parser.on('closetag', (node) => {
    const name = node.local;
    if (suppressed && ['bpt', 'ept', 'ph', 'it', 'ut'].includes(name)) suppressed -= 1;
    else if (name === 'seg') insideSegment = false;
    else if (name === 'tuv' && variants && current) variants.push(current);
    else if (name === 'tu' && variants) {
      const from = variants.filter((item) => languageMatch(item.lang, source));
      const to = variants.filter((item) => languageMatch(item.lang, target));
      if (from.length === 1 && to.length === 1 && from[0].text.trim() && to[0].text.trim()) {
        pairs.push({ source: from[0].text.trim(), target: to[0].text.trim() });
      }
      variants = null;
    }
    stack.pop();
  });

  return {
    pairs,
    write(text: string) {
      if (parseError) throw new Error(parseError);
      parser.write(text);
      if (parseError) throw new Error(parseError);
    },
    close() {
      if (parseError) throw new Error(parseError);
      parser.close();
      if (parseError) throw new Error(parseError);
    },
    done() { return pairs.length >= maxPairs; },
  };
}
