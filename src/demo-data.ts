import type { DataRecord, EntityType } from './types';

export type DemoRecord = { entity: EntityType; data: DataRecord };

export function makeDemoRecords(now = new Date().toISOString()): DemoRecord[] {
  const base = { createdAt: now, updatedAt: now, deletedAt: null };
  const projectName = 'Tradução de contrato';
  const glossaryName = 'Direito dos Contratos';

  return [
    {
      entity: 'projects',
      data: {
        ...base,
        id: 'demo-project-contract',
        name: projectName,
        client: 'Cliente de demonstração',
        sourceLang: 'en',
        targetLang: 'pt-BR',
        subject: 'Direito dos Contratos',
        notes: 'Projeto de exemplo para demonstrar organização de traduções jurídicas.',
      },
    },
    {
      entity: 'glossaries',
      data: {
        ...base,
        id: 'demo-glossary-contract',
        name: glossaryName,
        client: 'Cliente de demonstração',
        sourceLang: 'en',
        targetLang: 'pt-BR',
        description: 'Vocabulário ilustrativo. Revise cada escolha conforme o contexto e a jurisdição.',
      },
    },
    {
      entity: 'terms',
      data: {
        ...base,
        id: 'demo-term-consideration',
        original: 'Consideration',
        translation: 'Contraprestação',
        sourceLang: 'en',
        targetLang: 'pt-BR',
        project: projectName,
        glossary: glossaryName,
        category: 'Direito dos Contratos',
        notes: 'Exemplo didático adaptado do projeto anterior; confirme a equivalência no contexto antes de usar.',
        source: '',
      },
    },
    {
      entity: 'terms',
      data: {
        ...base,
        id: 'demo-term-governing-law',
        original: 'Governing law',
        translation: 'Lei aplicável',
        sourceLang: 'en',
        targetLang: 'pt-BR',
        project: projectName,
        glossary: glossaryName,
        category: 'Direito dos Contratos',
        notes: 'Exemplo para demonstração; confira a redação adotada no documento e na jurisdição.',
        source: '',
      },
    },
    {
      entity: 'terms',
      data: {
        ...base,
        id: 'demo-term-force-majeure',
        original: 'Force majeure',
        translation: 'Força maior',
        sourceLang: 'en',
        targetLang: 'pt-BR',
        project: projectName,
        glossary: glossaryName,
        category: 'Direito dos Contratos',
        notes: 'Exemplo para demonstração; a escolha pode depender do sistema jurídico e do contexto.',
        source: '',
      },
    },
  ];
}
