# Léxica Mobile interaction contract

## Product context

- Audience: translators organizing projects and terminology on a phone.
- Primary jobs: manage projects, glossaries, and translation terms; continue work offline; sync to the signed-in user's Firestore account; consult OPUS and MyMemory when online.
- Active locale: Portuguese (Brazil), with explicit source and target language codes on translation records.
- Accessibility target: native screen-reader labels, large touch targets, visible text status, and contrast consistent with WCAG 2.2 AA.

## Data and permissions

- Firebase Authentication identifies the owner. Cloud records live under \`users/{uid}/{entity}/{recordId}\` and Firestore rules restrict each path to the authenticated owner.
- SQLite stores each signed-in user's cached records and outbox separately by uid. Logging out does not reveal another account's local records.
- A record deletion is a soft-delete tombstone (\`deletedAt\`) so it can synchronize to other devices. Lists hide tombstones.
- If a request is queued offline, the UI says it is saved on this device and pending sync. It only says synced after Firestore accepts the write.

## CRUD and feedback

- Create and edit open the same form sheet pattern. Successful saves return to the owning list and refresh the row.
- Delete asks for confirmation, writes a tombstone locally, then queues it for Firestore.
- Validation errors stay beside the form. Network and sync errors remain visible with a retry action.
- The three complete CRUD collections are projects, glossaries, and translation terms.

## Offline and sync

- SQLite is the immediate source of truth for screens; all three CRUDs work without connectivity.
- On sign-in and whenever connectivity returns, the app pulls cloud records that have no local pending mutation, then flushes the local outbox in order.
- Writes are idempotent \`setDoc\` operations keyed by record id. Tombstones synchronize as ordinary record updates.
- A failed sync keeps the outbox item and local record. Retry occurs on the next foreground/reconnect or from the sync control.
- OPUS and MyMemory require an internet connection. MyMemory receives only the sentence the user explicitly submits for lookup.

## Navigation

- Bottom tabs: Projects, Glossaries, Terms, and OPUS.
- The account/sync header stays visible on all authenticated tabs.
- Forms and confirmation sheets keep the current tab context and are dismissible without silently dropping entered values.
