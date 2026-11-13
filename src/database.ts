import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { makeDemoRecords } from './demo-data';
import type { DataRecord, EntityType, PendingMutation, StoredRecord } from './types';

type DbRow = { data: string; sync_status: 'pending' | 'synced' };
type OutboxRow = { id: number; entity: EntityType; entity_id: string; data: string };

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function database() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync('lexica-mobile.db').then(async (db) => {
      await db.execAsync([
        'PRAGMA journal_mode = WAL;',
        'PRAGMA foreign_keys = ON;',
        'CREATE TABLE IF NOT EXISTS records (owner_id TEXT NOT NULL, entity TEXT NOT NULL, record_id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, sync_status TEXT NOT NULL DEFAULT \'pending\', PRIMARY KEY (owner_id, entity, record_id));',
        'CREATE INDEX IF NOT EXISTS records_visible ON records(owner_id, entity, deleted_at, updated_at DESC);',
        'CREATE TABLE IF NOT EXISTS outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(owner_id, entity, entity_id));',
        'CREATE INDEX IF NOT EXISTS outbox_order ON outbox(owner_id, id);',
        'CREATE TABLE IF NOT EXISTS app_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);',
        'CREATE TABLE IF NOT EXISTS tm_datasets (id TEXT PRIMARY KEY, corpus TEXT NOT NULL, version TEXT NOT NULL, source TEXT NOT NULL, target TEXT NOT NULL, imported_pairs INTEGER NOT NULL, imported_at TEXT NOT NULL);',
        'CREATE TABLE IF NOT EXISTS tm_pairs (id INTEGER PRIMARY KEY AUTOINCREMENT, dataset_id TEXT NOT NULL REFERENCES tm_datasets(id) ON DELETE CASCADE, source_text TEXT NOT NULL, target_text TEXT NOT NULL, normalized TEXT NOT NULL);',
        'CREATE INDEX IF NOT EXISTS tm_pairs_lookup ON tm_pairs(normalized, dataset_id);',
      ].join('\n'));
      return db;
    });
  }
  return databasePromise;
}

export async function listRecords(ownerId: string, entity: EntityType): Promise<StoredRecord[]> {
  const db = await database();
  const rows = await db.getAllAsync<DbRow>(
    'SELECT data, sync_status FROM records WHERE owner_id = ? AND entity = ? AND deleted_at IS NULL ORDER BY updated_at DESC',
    ownerId, entity,
  );
  return rows.map((row) => ({ data: JSON.parse(row.data) as DataRecord, syncStatus: row.sync_status }));
}

export async function ensureDemoData(ownerId: string) {
  const db = await database();
  const seedKey = 'demo-records-v1:' + ownerId;
  let inserted = false;

  await db.withTransactionAsync(async () => {
    const marker = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_metadata WHERE key = ?', seedKey,
    );
    if (marker) return;

    const existing = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM records WHERE owner_id = ?', ownerId,
    );
    if (existing?.count) {
      await db.runAsync('INSERT INTO app_metadata(key, value) VALUES(?, ?)', seedKey, 'existing-data-preserved');
      return;
    }

    for (const { entity, data } of makeDemoRecords()) {
      await db.runAsync(
        'INSERT INTO records(owner_id, entity, record_id, data, updated_at, deleted_at, sync_status) VALUES(?, ?, ?, ?, ?, ?, \'synced\')',
        ownerId, entity, data.id, JSON.stringify(data), data.updatedAt, data.deletedAt,
      );
    }
    await db.runAsync('INSERT INTO app_metadata(key, value) VALUES(?, ?)', seedKey, 'loaded');
    inserted = true;
  });

  return inserted;
}

export async function saveLocalRecord(ownerId: string, entity: EntityType, data: DataRecord) {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO records(owner_id, entity, record_id, data, updated_at, deleted_at, sync_status) VALUES(?, ?, ?, ?, ?, ?, \'pending\') ON CONFLICT(owner_id, entity, record_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at, deleted_at=excluded.deleted_at, sync_status=\'pending\'',
      ownerId, entity, data.id, JSON.stringify(data), data.updatedAt, data.deletedAt,
    );
    await enqueue(db, ownerId, entity, data);
  });
}

export async function deleteLocalRecord(ownerId: string, entity: EntityType, data: DataRecord) {
  const now = new Date().toISOString();
  await saveLocalRecord(ownerId, entity, { ...data, deletedAt: now, updatedAt: now });
}

async function enqueue(db: SQLite.SQLiteDatabase, ownerId: string, entity: EntityType, data: DataRecord) {
  await db.runAsync(
    'INSERT INTO outbox(owner_id, entity, entity_id, data, created_at) VALUES(?, ?, ?, ?, ?) ON CONFLICT(owner_id, entity, entity_id) DO UPDATE SET data=excluded.data, created_at=excluded.created_at',
    ownerId, entity, data.id, JSON.stringify(data), new Date().toISOString(),
  );
}

export async function getPending(ownerId: string): Promise<PendingMutation[]> {
  const db = await database();
  const rows = await db.getAllAsync<OutboxRow>(
    'SELECT id, entity, entity_id, data FROM outbox WHERE owner_id = ? ORDER BY id LIMIT 100', ownerId,
  );
  return rows.map((row) => ({
    outboxId: row.id,
    entity: row.entity,
    entityId: row.entity_id,
    data: JSON.parse(row.data) as DataRecord,
  }));
}

export async function acknowledgePending(ownerId: string, mutation: PendingMutation) {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'DELETE FROM outbox WHERE id = ? AND owner_id = ? AND data = ?',
      mutation.outboxId, ownerId, JSON.stringify(mutation.data),
    );
    const remaining = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM outbox WHERE owner_id = ? AND entity = ? AND entity_id = ?',
      ownerId, mutation.entity, mutation.entityId,
    );
    if (!remaining?.count) {
      await db.runAsync(
        'UPDATE records SET sync_status=\'synced\' WHERE owner_id=? AND entity=? AND record_id=?',
        ownerId, mutation.entity, mutation.entityId,
      );
    }
  });
}

export async function mergeRemoteRecords(ownerId: string, entity: EntityType, remote: DataRecord[]) {
  const db = await database();
  await db.withTransactionAsync(async () => {
    for (const data of remote) {
      const pending = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM outbox WHERE owner_id=? AND entity=? AND entity_id=?', ownerId, entity, data.id,
      );
      if (pending) continue;
      await db.runAsync(
        'INSERT INTO records(owner_id, entity, record_id, data, updated_at, deleted_at, sync_status) VALUES(?, ?, ?, ?, ?, ?, \'synced\') ON CONFLICT(owner_id, entity, record_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at, deleted_at=excluded.deleted_at, sync_status=\'synced\'',
        ownerId, entity, data.id, JSON.stringify(data), data.updatedAt, data.deletedAt,
      );
    }
  });
}

export async function makeId() {
  return Crypto.randomUUID();
}

export type LocalDataset = {
  id: string;
  corpus: string;
  version: string;
  source: string;
  target: string;
  imported_pairs: number;
  imported_at: string;
};

export async function listTmxDatasets(): Promise<LocalDataset[]> {
  const db = await database();
  return db.getAllAsync<LocalDataset>('SELECT * FROM tm_datasets ORDER BY imported_at DESC');
}

function foldText(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR').trim();
}

export async function saveTmxSample(
  dataset: Omit<LocalDataset, 'imported_pairs' | 'imported_at'>,
  pairs: Array<{ source: string; target: string }>,
) {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM tm_pairs WHERE dataset_id = ?', dataset.id);
    await db.runAsync(
      'INSERT INTO tm_datasets(id, corpus, version, source, target, imported_pairs, imported_at) VALUES(?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET corpus=excluded.corpus, version=excluded.version, source=excluded.source, target=excluded.target, imported_pairs=excluded.imported_pairs, imported_at=excluded.imported_at',
      dataset.id, dataset.corpus, dataset.version, dataset.source, dataset.target, pairs.length, new Date().toISOString(),
    );
    for (const pair of pairs) {
      await db.runAsync(
        'INSERT INTO tm_pairs(dataset_id, source_text, target_text, normalized) VALUES(?, ?, ?, ?)',
        dataset.id, pair.source, pair.target, foldText(pair.source),
      );
    }
  });
}

export async function searchLocalTm(source: string, target: string, phrase: string) {
  const db = await database();
  const normalized = foldText(phrase);
  if (!normalized) return [];
  return db.getAllAsync<{ source_text: string; target_text: string; corpus: string; version: string }>(
    'SELECT p.source_text, p.target_text, d.corpus, d.version FROM tm_pairs p JOIN tm_datasets d ON d.id=p.dataset_id WHERE d.source=? AND d.target=? AND instr(p.normalized, ?) > 0 ORDER BY CASE WHEN p.normalized=? THEN 0 ELSE 1 END LIMIT 8',
    source.toLowerCase(), target.toLowerCase(), normalized, normalized,
  );
}
