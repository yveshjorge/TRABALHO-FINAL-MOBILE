import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Eyebrow, Field, Notice, SectionTitle } from '../components/UI';
import { deleteLocalRecord, listRecords, makeId, saveLocalRecord } from '../database';
import { theme } from '../theme';
import type { DataRecord, EntityDefinition, StoredRecord } from '../types';
import { recordToDraft, toRecord, validateDraft } from '../validation';

export function CrudScreen({
  ownerId,
  localOnly = false,
  definition,
  refreshKey,
  onChanged,
}: {
  ownerId: string;
  localOnly?: boolean;
  definition: EntityDefinition;
  refreshKey: number;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<StoredRecord[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<DataRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');

  const inputLabel = useMemo(() => Object.fromEntries(definition.fields.map((field) => [field.key, field.label])), [definition.fields]);

  async function refresh() {
    setLoadError('');
    try {
      setRows(await listRecords(ownerId, definition.type));
    } catch {
      setLoadError('Não foi possível abrir os dados deste aparelho.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, [ownerId, definition.type, refreshKey]);

  function openCreate() {
    setEditing(null);
    setDraft(Object.fromEntries(definition.fields.map((field) => [field.key, ''])));
    setErrors({});
    setFormOpen(true);
  }

  function openEdit(record: DataRecord) {
    setEditing(record);
    setDraft(recordToDraft(record));
    setErrors({});
    setFormOpen(true);
  }

  function closeForm() {
    const changed = Object.values(draft).some((value) => value.trim());
    if (changed) {
      Alert.alert('Descartar alterações?', 'O que você digitou ainda não foi salvo.', [
        { text: 'Continuar editando', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: () => setFormOpen(false) },
      ]);
    } else setFormOpen(false);
  }

  async function save() {
    const validationErrors = validateDraft(definition.type, draft);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;
    setSaving(true);
    try {
      const id = editing?.id ?? await makeId();
      const record = toRecord(draft, editing, id);
      await saveLocalRecord(ownerId, definition.type, record);
      setFormOpen(false);
      setNotice(editing ? 'Alterações salvas neste aparelho.' : 'Registro criado neste aparelho.');
      await refresh();
      onChanged();
    } catch {
      setLoadError('O SQLite não conseguiu salvar. Seus dados permanecem no formulário; tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  function remove(record: DataRecord) {
    const label = String(record[definition.headlineKey] ?? 'este registro');
    Alert.alert('Excluir registro?', '“' + label + '” será removido das listas e a exclusão será sincronizada com a nuvem.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => {
        void deleteLocalRecord(ownerId, definition.type, record).then(async () => {
          setNotice('Registro excluído neste aparelho; a nuvem será atualizada na próxima sincronização.');
          await refresh();
          onChanged();
        }).catch(() => setLoadError('Não foi possível excluir o registro. Tente novamente.'));
      } },
    ]);
  }

  function displayValue(value: unknown) {
    if (value == null || value === '') return '';
    if (typeof value === 'string' && value.startsWith('http')) return value;
    return String(value);
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Eyebrow>{definition.eyebrow}</Eyebrow>
          <Text style={styles.title}>{definition.title}</Text>
        </View>
        <Button label="+ Novo" onPress={openCreate} />
      </View>
      <Text style={styles.description}>{definition.description}</Text>
      {notice ? <Notice tone="success">{notice}</Notice> : null}
      {loadError ? <Notice tone="error">{loadError}</Notice> : null}
      <SectionTitle title={rows.length ? 'Seus registros' : 'Comece por aqui'} subtitle={rows.length ? rows.length + ' registros neste aparelho' : 'Cadastre seu primeiro item. Você pode editar e excluir depois.'} />
      {loading ? <ActivityIndicator color={theme.color.coral} /> : rows.length ? rows.map(({ data, syncStatus }) => (
        <Card key={data.id} style={styles.record}>
          <View style={styles.recordHeader}>
            <View style={styles.marker} />
            <Text style={styles.recordTitle}>{displayValue(data[definition.headlineKey])}</Text>
          </View>
          {definition.detailKeys.map((key) => {
            const value = displayValue(data[key]);
            return value ? <Text key={key} style={styles.detail}><Text style={styles.detailLabel}>{inputLabel[key] ?? key}: </Text>{value}</Text> : null;
          })}
          <View style={styles.recordFooter}>
            <Text style={localOnly ? styles.pending : syncStatus === 'synced' ? styles.synced : styles.pending}>
              {localOnly ? 'Somente neste aparelho' : syncStatus === 'synced' ? 'Na nuvem' : 'Pendente de sincronização'}
            </Text>
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" onPress={() => openEdit(data)} hitSlop={8}><Text style={styles.action}>Editar</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={'Excluir ' + displayValue(data[definition.headlineKey])} onPress={() => remove(data)} hitSlop={8}><Text style={styles.delete}>Excluir</Text></Pressable>
            </View>
          </View>
        </Card>
      )) : !loading ? (
        <Card style={styles.empty}>
          <View style={styles.emptyMark}><Text style={styles.emptyMarkText}>✳</Text></View>
          <Text style={styles.emptyTitle}>Nenhum registro ainda</Text>
          <Text style={styles.description}>Os dados ficam no SQLite antes de qualquer sincronização.</Text>
          <Button label={'Criar ' + definition.title.toLowerCase().replace(/s$/, '')} onPress={openCreate} />
        </Card>
      ) : null}
      <Modal visible={formOpen} animationType="slide" transparent onRequestClose={closeForm}>
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKeyboard}>
            <View style={styles.sheet} accessibilityViewIsModal>
              <View style={styles.sheetHeading}>
                <View><Eyebrow>{editing ? 'EDITAR REGISTRO' : 'NOVO REGISTRO'}</Eyebrow><Text style={styles.sheetTitle}>{editing ? 'Atualizar ' + definition.title.toLowerCase().replace(/s$/, '') : 'Adicionar ' + definition.title.toLowerCase().replace(/s$/, '')}</Text></View>
                <Pressable accessibilityRole="button" accessibilityLabel="Fechar formulário" onPress={closeForm} hitSlop={10}><Text style={styles.close}>×</Text></Pressable>
              </View>
              <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
                {definition.fields.map((field) => (
                  <Field
                    key={field.key}
                    label={field.label}
                    placeholder={field.placeholder}
                    value={draft[field.key] ?? ''}
                    error={errors[field.key]}
                    onChangeText={(value) => { setDraft((old) => ({ ...old, [field.key]: value })); setErrors((old) => ({ ...old, [field.key]: '' })); }}
                    multiline={field.multiline}
                    maxLength={field.maxLength}
                    keyboardType={field.keyboardType}
                    autoCapitalize={field.key.endsWith('Lang') ? 'none' : 'sentences'}
                    style={field.multiline ? { minHeight: 88 } : undefined}
                  />
                ))}
                <Text style={styles.formHint}>Os idiomas aceitos incluem en, pt-BR, es, fr, de, it e ja.</Text>
                <View style={styles.formActions}>
                  <Button kind="quiet" label="Cancelar" onPress={closeForm} disabled={saving} />
                  <Button label={saving ? 'Salvando…' : 'Salvar no aparelho'} onPress={() => void save()} disabled={saving} />
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 36, gap: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headingCopy: { flex: 1, gap: 4 },
  title: { color: theme.color.ink, fontSize: theme.type.title, fontWeight: '900', letterSpacing: -1 },
  description: { color: theme.color.muted, fontSize: 14, lineHeight: 21 },
  record: { gap: 10 },
  recordHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  marker: { width: 8, height: 22, backgroundColor: theme.color.marker, borderRadius: 5, marginTop: 2 },
  recordTitle: { flex: 1, color: theme.color.ink, fontSize: 17, fontWeight: '800', lineHeight: 23 },
  detail: { color: theme.color.ink, fontSize: 13, lineHeight: 19 },
  detailLabel: { color: theme.color.muted, fontWeight: '700' },
  recordFooter: { borderTopWidth: 1, borderTopColor: theme.color.line, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  synced: { color: theme.color.success, fontSize: 11, fontWeight: '700' },
  pending: { color: theme.color.warning, fontSize: 11, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 18 },
  action: { color: theme.color.ink, fontWeight: '800', fontSize: 13 },
  delete: { color: theme.color.danger, fontWeight: '800', fontSize: 13 },
  empty: { alignItems: 'flex-start', padding: 22 },
  emptyMark: { width: 42, height: 42, backgroundColor: theme.color.marker, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emptyMarkText: { color: theme.color.ink, fontSize: 23 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: theme.color.ink },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(13, 32, 45, 0.5)' },
  modalKeyboard: { width: '100%', maxHeight: '92%' },
  sheet: { maxHeight: '100%', backgroundColor: theme.color.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 22, paddingHorizontal: 20 },
  sheetHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16 },
  sheetTitle: { color: theme.color.ink, fontSize: 22, fontWeight: '900', marginTop: 3 },
  close: { color: theme.color.ink, fontSize: 32, lineHeight: 36, paddingHorizontal: 6 },
  form: { paddingBottom: 28, gap: 14 },
  formHint: { color: theme.color.muted, fontSize: 12, lineHeight: 18 },
  formActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', paddingTop: 4 },
});
