import type { EntityDefinition, EntityType } from './types';

export const entityDefinitions: Record<EntityType, EntityDefinition> = {
  projects: {
    type: 'projects',
    title: 'Projetos',
    eyebrow: 'TRABALHOS EM ANDAMENTO',
    description: 'Organize cliente, idiomas, área e notas de cada trabalho.',
    headlineKey: 'name',
    detailKeys: ['client', 'sourceLang', 'targetLang', 'subject'],
    fields: [
      { key: 'name', label: 'Nome do projeto', placeholder: 'Ex.: Manual do produto' },
      { key: 'client', label: 'Cliente', placeholder: 'Nome do cliente' },
      { key: 'sourceLang', label: 'Idioma de origem', placeholder: 'en' },
      { key: 'targetLang', label: 'Idioma de destino', placeholder: 'pt-BR' },
      { key: 'subject', label: 'Área', placeholder: 'Ex.: tecnologia' },
      { key: 'notes', label: 'Notas', placeholder: 'Prazo, tom ou instruções', multiline: true },
    ],
  },
  glossaries: {
    type: 'glossaries',
    title: 'Glossários',
    eyebrow: 'VOCABULÁRIO APROVADO',
    description: 'Mantenha as escolhas aprovadas por cliente e par de idiomas.',
    headlineKey: 'name',
    detailKeys: ['client', 'sourceLang', 'targetLang', 'description'],
    fields: [
      { key: 'name', label: 'Nome do glossário', placeholder: 'Ex.: Interface do produto' },
      { key: 'client', label: 'Cliente', placeholder: 'Nome do cliente' },
      { key: 'sourceLang', label: 'Idioma de origem', placeholder: 'en' },
      { key: 'targetLang', label: 'Idioma de destino', placeholder: 'pt-BR' },
      { key: 'description', label: 'Descrição', placeholder: 'Escopo ou observações', multiline: true },
    ],
  },
  terms: {
    type: 'terms',
    title: 'Termos',
    eyebrow: 'DECISÕES DE TRADUÇÃO',
    description: 'Registre traduções, contexto e origem para consultar depois.',
    headlineKey: 'original',
    detailKeys: ['translation', 'sourceLang', 'targetLang', 'project', 'glossary'],
    fields: [
      { key: 'original', label: 'Texto de origem', placeholder: 'Segmento original', multiline: true },
      { key: 'translation', label: 'Tradução aprovada', placeholder: 'Sua tradução', multiline: true },
      { key: 'sourceLang', label: 'Idioma de origem', placeholder: 'en' },
      { key: 'targetLang', label: 'Idioma de destino', placeholder: 'pt-BR' },
      { key: 'project', label: 'Projeto', placeholder: 'Nome do projeto relacionado' },
      { key: 'glossary', label: 'Glossário', placeholder: 'Nome do glossário relacionado' },
      { key: 'category', label: 'Área', placeholder: 'Ex.: interface, jurídico, saúde' },
      { key: 'notes', label: 'Contexto e justificativa', placeholder: 'Quando usar esta tradução', multiline: true },
      { key: 'source', label: 'Fonte (opcional)', placeholder: 'URL, DOI ou referência', keyboardType: 'url' },
    ],
  },
};
