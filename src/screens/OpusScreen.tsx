import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Eyebrow, Field, Notice, SectionTitle } from '../components/UI';
import { listTmxDatasets, searchLocalTm, type LocalDataset } from '../database';
import { importOpusSample, searchMyMemory, searchOpusCatalog, type MemoryMatch, type OpusDataset } from '../opus';
import { theme } from '../theme';

export function OpusScreen() {
  const [source, setSource] = useState('en');
  const [target, setTarget] = useState('pt-BR');
  const [corpus, setCorpus] = useState('');
  const [phrase, setPhrase] = useState('');
  const [datasets, setDatasets] = useState<OpusDataset[]>([]);
  const [matches, setMatches] = useState<MemoryMatch[]>([]);
  const [localPhrase, setLocalPhrase] = useState('');
  const [localMatches, setLocalMatches] = useState<Array<{ source_text: string; target_text: string; corpus: string; version: string }>>([]);
  const [localDatasets, setLocalDatasets] = useState<LocalDataset[]>([]);
  const [importing, setImporting] = useState('');
  const [localError, setLocalError] = useState('');
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refreshLocal() {
    setLocalDatasets(await listTmxDatasets());
  }

  useEffect(() => { void refreshLocal(); }, []);

  async function findDatasets() {
    setError('');
    setNotice('');
    setCatalogBusy(true);
    try {
      const rows = await searchOpusCatalog(source, target, corpus);
      setDatasets(rows.slice(0, 25));
      setNotice(rows.length ? rows.length + ' bases TMX encontradas no catálogo.' : 'Nenhuma base foi encontrada para este par. Tente en e pt.');
    } catch (cause) {
      setError((cause as Error).message || 'Falha ao consultar o OPUS. Tente novamente quando estiver online.');
    } finally {
      setCatalogBusy(false);
    }
  }

  async function findMatches() {
    setError('');
    setNotice('');
    setMatches([]);
    if (!phrase.trim()) {
      setError('Escreva uma frase antes de consultar.');
      return;
    }
    const bytes = encodeURIComponent(phrase.trim()).replace(/%[A-F0-9]{2}/gi, 'x').length;
    if (bytes > 500) {
      setError('MyMemory aceita até 500 bytes por consulta. Divida o trecho e tente de novo.');
      return;
    }
    setLookupBusy(true);
    try {
      const rows = await searchMyMemory(phrase.trim(), source, target);
      setMatches(rows);
      setNotice(rows.length ? 'Revise as sugestões antes de usar. A consulta foi enviada ao MyMemory.' : 'A API não trouxe sugestões para esta frase.');
    } catch (cause) {
      setError((cause as Error).message || 'Falha ao consultar MyMemory. A frase continua no formulário.');
    } finally {
      setLookupBusy(false);
    }
  }

  async function findLocalMatches() {
    setLocalError('');
    try {
      const rows = await searchLocalTm(source, target, localPhrase);
      setLocalMatches(rows);
      if (!rows.length) setLocalError('Nenhuma correspondência nas amostras locais para este par de idiomas.');
    } catch {
      setLocalError('Não foi possível pesquisar a memória salva neste aparelho.');
    }
  }

  async function importDataset(dataset: OpusDataset) {
    setLocalError('');
    setImporting(dataset.id);
    try {
      const count = await importOpusSample(dataset, 1000);
      await refreshLocal();
      setNotice(count + ' pares da coleção ' + dataset.corpus + ' salvos no SQLite deste aparelho.');
    } catch (cause) {
      setLocalError((cause as Error).message || 'Não foi possível importar esta base.');
    } finally {
      setImporting('');
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.heading}>
        <Eyebrow>FONTES EXTERNAS</Eyebrow>
        <Text style={styles.title}>Memórias de tradução</Text>
        <Text style={styles.description}>Consulte bases e compare sugestões com suas decisões de tradução.</Text>
      </View>
      <Notice tone="warning">As consultas exigem internet. MyMemory recebe somente a frase que você enviar ao tocar em “Buscar correspondências”. Confira contexto, qualidade e licença antes de usar uma sugestão.</Notice>
      {notice ? <Notice tone="success">{notice}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {localError ? <Notice tone="error">{localError}</Notice> : null}
      <Card>
        <SectionTitle title="Buscar uma frase" subtitle="MyMemory procura correspondências no arquivo público de traduções." />
        <Field label="Idioma de origem" value={source} onChangeText={setSource} autoCapitalize="none" placeholder="en" />
        <Field label="Idioma de destino" value={target} onChangeText={setTarget} autoCapitalize="none" placeholder="pt-BR" />
        <Field label="Frase para consultar" value={phrase} onChangeText={setPhrase} placeholder="Digite uma frase curta" multiline maxLength={500} />
        <Button label={lookupBusy ? 'Consultando…' : 'Buscar correspondências'} disabled={lookupBusy} onPress={() => void findMatches()} />
        {lookupBusy ? <ActivityIndicator color={theme.color.coral} /> : null}
        {matches.map((match, index) => (
          <View key={index} style={styles.match}>
            <View style={styles.marker} />
            <View style={styles.matchCopy}>
              <Text style={styles.matchText}>{match.translation}</Text>
              <Text style={styles.matchMeta}>{match.source} · correspondência {(match.match * 100).toFixed(0)}%</Text>
            </View>
          </View>
        ))}
      </Card>
      <Card>
        <SectionTitle title="Suas amostras offline" subtitle="As amostras TMX importadas do OPUS ficam no SQLite e podem ser consultadas sem internet." />
        <Text style={styles.datasetMeta}>Cada importação para após 1.000 pares encontrados no início do arquivo. É uma amostra parcial e pode não representar o corpus inteiro.</Text>
        {localDatasets.length ? (
          <>
            <Field label="Frase para procurar" value={localPhrase} onChangeText={setLocalPhrase} placeholder="Digite uma frase" />
            <Button label="Buscar nas memórias deste aparelho" onPress={() => void findLocalMatches()} />
            {localMatches.map((match, index) => (
              <View style={styles.match} key={match.corpus + match.version + index}>
                <View style={styles.marker} />
                <View style={styles.matchCopy}>
                  <Text style={styles.matchMeta}>{match.corpus} · {match.version}</Text>
                  <Text style={styles.matchText}>{match.source_text}</Text>
                  <Text style={styles.matchText}>{match.target_text}</Text>
                </View>
              </View>
            ))}
            <Text style={styles.datasetMeta}>Amostras neste aparelho: {localDatasets.map((item) => item.corpus + ' (' + item.imported_pairs.toLocaleString('pt-BR') + ')').join(' · ')}</Text>
          </>
        ) : <Text style={styles.description}>Ainda não há uma memória OPUS neste aparelho. Busque o catálogo abaixo para importar até 1.000 pares de uma base.</Text>}
      </Card>
      <Card>
        <SectionTitle title="Catálogo OPUS" subtitle="Descubra coleções TMX disponíveis para baixar e depois importar no Léxica." />
        <View style={styles.languageRow}>
          <View style={styles.half}><Field label="Origem" value={source} onChangeText={setSource} autoCapitalize="none" /></View>
          <View style={styles.half}><Field label="Destino" value={target} onChangeText={setTarget} autoCapitalize="none" /></View>
        </View>
        <Field label="Coleção (opcional)" value={corpus} onChangeText={setCorpus} placeholder="Europarl, MultiUN, DGT..." autoCapitalize="none" />
        <Button label={catalogBusy ? 'Consultando OPUS…' : 'Procurar bases disponíveis'} disabled={catalogBusy} onPress={() => void findDatasets()} />
        {catalogBusy ? <ActivityIndicator color={theme.color.coral} /> : null}
        {datasets.map((dataset, index) => (
          <View key={dataset.corpus + dataset.version + index} style={styles.dataset}>
            <Eyebrow>{dataset.corpus} · {dataset.version}</Eyebrow>
            <Text style={styles.datasetCount}>{Number(dataset.alignment_pairs ?? 0).toLocaleString('pt-BR')} pares estimados</Text>
            <Button label={importing === dataset.id ? 'Importando até 1.000 pares…' : 'Importar amostra para uso offline'} disabled={Boolean(importing)} onPress={() => void importDataset(dataset)} />
            <Button kind="quiet" label="Abrir arquivo TMX no OPUS" onPress={() => void Linking.openURL(dataset.url)} />
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 36, gap: 16 },
  heading: { gap: 6 },
  title: { color: theme.color.ink, fontSize: theme.type.title, fontWeight: '900', letterSpacing: -1 },
  description: { color: theme.color.muted, fontSize: 14, lineHeight: 21 },
  languageRow: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  match: { flexDirection: 'row', gap: 11, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.color.line },
  marker: { width: 7, borderRadius: 4, backgroundColor: theme.color.marker },
  matchCopy: { flex: 1, gap: 4 },
  matchText: { color: theme.color.ink, fontSize: 16, fontWeight: '700', lineHeight: 23 },
  matchMeta: { color: theme.color.muted, fontSize: 11 },
  dataset: { gap: 8, paddingTop: 13, borderTopWidth: 1, borderTopColor: theme.color.line },
  datasetCount: { color: theme.color.ink, fontSize: 14, fontWeight: '700' },
  datasetMeta: { color: theme.color.muted, fontSize: 12, lineHeight: 18 },
});
