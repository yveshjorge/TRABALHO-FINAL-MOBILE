import type { DataRecord, EntityType } from './types';

const languages = new Set(['en', 'pt', 'pt-BR', 'es', 'fr', 'de', 'it', 'ja']);
const limits: Record<string, number> = {
  name: 150, client: 150, sourceLang: 20, targetLang: 20, subject: 150,
  notes: 5000, description: 2000, original: 2000, translation: 2000,
  project: 150, glossary: 150, category: 100, source: 2000,
};

export function validateDraft(type: EntityType, draft: Record<string, string>) {
  const errors: Record<string, string> = {};
  const required = type === 'projects'
    ? ['name', 'client', 'sourceLang', 'targetLang', 'subject']
    : type === 'glossaries'
      ? ['name', 'client', 'sourceLang', 'targetLang']
      : ['original', 'translation', 'sourceLang', 'targetLang', 'category'];
  for (const key of required) {
    if (!draft[key]?.trim()) errors[key] = 'Preencha este campo.';
  }
  for (const key of ['sourceLang', 'targetLang']) {
    if (draft[key]?.trim() && !languages.has(draft[key].trim())) {
      errors[key] = 'Use en, pt, pt-BR, es, fr, de, it ou ja.';
    }
  }
  if (draft.sourceLang && draft.sourceLang === draft.targetLang) {
    errors.targetLang = 'Escolha idiomas diferentes.';
  }
  for (const [key, value] of Object.entries(draft)) {
    const max = limits[key];
    if (max && value.length > max) errors[key] = 'Use até ' + max + ' caracteres.';
  }
  if (draft.source) {
    const value = draft.source.trim().toLowerCase();
    if (value.includes(':') && !value.startsWith('http://') && !value.startsWith('https://')) {
      errors.source = 'Use uma URL HTTP/HTTPS ou referência de texto.';
    }
  }
  return errors;
}

export function toRecord(draft: Record<string, string>, previous: DataRecord | null, id: string, now = new Date().toISOString()): DataRecord {
  const fields = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim()]));
  return {
    ...fields,
    id,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    deletedAt: null,
  } as DataRecord;
}

export function recordToDraft(record: DataRecord) {
  return Object.fromEntries(
    Object.entries(record)
      .filter(([key]) => !['id', 'createdAt', 'updatedAt', 'deletedAt'].includes(key))
      .map(([key, value]) => [key, String(value ?? '')]),
  );
}
