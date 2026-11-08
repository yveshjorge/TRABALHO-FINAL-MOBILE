export type EntityType = 'projects' | 'glossaries' | 'terms';

export type DataRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  [key: string]: string | number | boolean | null;
};

export type StoredRecord = {
  data: DataRecord;
  syncStatus: 'pending' | 'synced';
};

export type PendingMutation = {
  outboxId: number;
  entity: EntityType;
  entityId: string;
  data: DataRecord;
};

export type FieldDefinition = {
  key: string;
  label: string;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'url';
  maxLength?: number;
};

export type EntityDefinition = {
  type: EntityType;
  title: string;
  eyebrow: string;
  description: string;
  fields: FieldDefinition[];
  headlineKey: string;
  detailKeys: string[];
};
