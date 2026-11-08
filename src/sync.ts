import { collection, doc, getDocs, setDoc, type Firestore } from 'firebase/firestore';
import { acknowledgePending, getPending, mergeRemoteRecords } from './database';
import type { DataRecord, EntityType } from './types';

const entities: EntityType[] = ['projects', 'glossaries', 'terms'];

export async function synchronize(cloud: Firestore, uid: string) {
  let pulled = 0;
  let uploaded = 0;
  for (const entity of entities) {
    const snapshot = await getDocs(collection(cloud, 'users', uid, entity));
    const remote = snapshot.docs.map((item) => item.data() as DataRecord);
    await mergeRemoteRecords(uid, entity, remote);
    pulled += remote.length;
  }

  const pending = await getPending(uid);
  for (const mutation of pending) {
    const ref = doc(cloud, 'users', uid, mutation.entity, mutation.entityId);
    await setDoc(ref, { ...mutation.data, userId: uid });
    await acknowledgePending(uid, mutation);
    uploaded += 1;
  }
  return { pulled, uploaded, remaining: (await getPending(uid)).length };
}
