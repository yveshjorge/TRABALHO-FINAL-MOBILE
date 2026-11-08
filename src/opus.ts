import { Gunzip, Unzip, UnzipInflate } from 'fflate';
import { saveTmxSample } from './database';
import { createTmxCollector } from './tmx-parser';

export type OpusDataset = {
  id: string;
  corpus: string;
  version: string;
  source: string;
  target: string;
  url: string;
  alignment_pairs?: number;
  preprocessing?: string;
};

export async function searchOpusCatalog(source: string, target: string, corpus: string) {
  const params = new URLSearchParams({ source, target, preprocessing: 'tmx', version: 'latest' });
  if (corpus.trim()) params.set('corpus', corpus.trim());
  const response = await fetch('https://opus.nlpl.eu/opusapi/?' + params.toString());
  if (!response.ok) throw new Error('OPUS respondeu HTTP ' + response.status + '.');
  const payload = await response.json() as { corpora?: OpusDataset[] };
  if (!Array.isArray(payload.corpora)) throw new Error('O catálogo OPUS retornou um formato inesperado.');
  return payload.corpora
    .filter((item) => {
      try {
        allowedOpusUrl(item.url);
        return Boolean(item.url);
      } catch {
        return false;
      }
    })
    .map((item) => ({
      ...item,
      id: [item.corpus, item.version, source, target].join(':'),
      source: source.toLowerCase(),
      target: target.toLowerCase(),
    }));
}

export type MemoryMatch = { translation: string; source: string; match: number };

export async function searchMyMemory(text: string, source: string, target: string): Promise<MemoryMatch[]> {
  const params = new URLSearchParams({ q: text, langpair: source + '|' + target });
  const response = await fetch('https://api.mymemory.translated.net/get?' + params.toString());
  if (!response.ok) throw new Error('MyMemory respondeu HTTP ' + response.status + '.');
  const payload = await response.json() as { responseStatus?: number; matches?: Array<{ translation?: string; source?: string; match?: number }> };
  if (payload.responseStatus && payload.responseStatus !== 200) throw new Error('MyMemory não encontrou sugestões para esta consulta.');
  return (payload.matches ?? [])
    .filter((item) => item.translation?.trim())
    .slice(0, 5)
    .map((item) => ({ translation: item.translation!.trim(), source: item.source ?? 'MyMemory', match: item.match ?? 0 }));
}

function allowedOpusUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    !['opus.nlpl.eu', 'object.pouta.csc.fi'].includes(url.hostname) ||
    (url.hostname === 'object.pouta.csc.fi' && !url.pathname.startsWith('/OPUS-'))
  ) {
    throw new Error('O catálogo retornou um endereço de download fora dos servidores OPUS.');
  }
  return url;
}

export async function importOpusSample(dataset: OpusDataset, maxPairs = 1000) {
  const start = allowedOpusUrl(dataset.url);
  const response = await fetch(start.href);
  if (!response.ok) throw new Error('OPUS respondeu HTTP ' + response.status + ' ao baixar a base.');
  if (response.url) allowedOpusUrl(response.url);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Este aparelho não oferece leitura em fluxo para limitar o download TMX.');
  const collector = createTmxCollector(dataset.source, dataset.target, maxPairs);
  const decoder = new TextDecoder('utf-8');
  let uncompressedBytes = 0;
  let compressedBytes = 0;
  let stopped = false;
  let gzip: Gunzip | null = null;
  const zipRef: { current: Unzip | null } = { current: null };
  let zipTmxCount = 0;
  let firstChunk = true;
  const maxCompressed = 25 * 1024 * 1024;
  const maxXml = 32 * 1024 * 1024;

  function xml(bytes: Uint8Array, final = false) {
    if (stopped) return;
    uncompressedBytes += bytes.byteLength;
    if (uncompressedBytes > maxXml) throw new Error('A amostra TMX ultrapassou o limite de segurança.');
    if (bytes.length) collector.write(decoder.decode(bytes, { stream: true }));
    if (final) {
      const rest = decoder.decode();
      if (rest) collector.write(rest);
      collector.close();
    }
    if (collector.done()) stopped = true;
  }

  function beginZip() {
    zipRef.current = new Unzip((file) => {
      if (!file.name.toLowerCase().endsWith('.tmx')) return;
      zipTmxCount += 1;
      if (zipTmxCount > 1) throw new Error('O ZIP contém mais de um TMX. Escolha um arquivo com uma única memória.');
      if (file.originalSize && file.originalSize > maxXml) {
        throw new Error('O TMX dentro do ZIP ultrapassa o limite de segurança.');
      }
      file.ondata = (error, data, final) => {
        if (error) throw new Error('Não foi possível extrair o TMX do ZIP.');
        if (data) xml(data, final);
      };
      file.start();
    });
    zipRef.current.register(UnzipInflate);
  }

  try {
    while (!stopped) {
      const part = await reader.read();
      if (part.done) {
        if (gzip) gzip.push(new Uint8Array(0), true);
        else if (zipRef.current) zipRef.current.push(new Uint8Array(0), true);
        else xml(new Uint8Array(0), true);
        break;
      }
      const chunk = part.value;
      compressedBytes += chunk.byteLength;
      if (compressedBytes > maxCompressed) throw new Error('O download excedeu 25 MB antes de chegar à amostra solicitada.');
      if (firstChunk) {
        firstChunk = false;
        if (chunk[0] === 0x50 && chunk[1] === 0x4b) beginZip();
        if (chunk[0] === 0x1f && chunk[1] === 0x8b) {
          gzip = new Gunzip((data, final) => xml(data, final));
        }
      }
      if (zipRef.current) zipRef.current.push(chunk, false);
      else if (gzip) gzip.push(chunk, false);
      else xml(chunk);
      if (collector.done() && !zipRef.current) {
        stopped = true;
        await reader.cancel();
      }
    }
  } catch (cause) {
    await reader.cancel().catch(() => undefined);
    throw cause;
  }
  if (zipRef.current && !zipTmxCount) throw new Error('O ZIP do OPUS não contém um arquivo TMX.');
  if (!collector.pairs.length) throw new Error('Não foram encontrados pares TMX completos neste arquivo.');
  await saveTmxSample({
    id: dataset.id,
    corpus: dataset.corpus,
    version: dataset.version,
    source: dataset.source.toLowerCase(),
    target: dataset.target.toLowerCase(),
  }, collector.pairs);
  return collector.pairs.length;
}
