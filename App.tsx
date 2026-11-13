import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import * as Network from 'expo-network';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { StatusBar } from 'expo-status-bar';
import { AuthScreen } from './src/screens/AuthScreen';
import { CrudScreen } from './src/screens/CrudScreen';
import { OpusScreen } from './src/screens/OpusScreen';
import { Button, Notice } from './src/components/UI';
import { auth, cloud, firebaseConfigured } from './src/firebase';
import { entityDefinitions } from './src/definitions';
import { synchronize } from './src/sync';
import { ensureDemoData } from './src/database';
import { theme } from './src/theme';
import type { EntityType } from './src/types';

type Tab = EntityType | 'opus';
type Account = { uid: string; email: string; demo: boolean };
type SyncState = 'local' | 'offline' | 'syncing' | 'synced' | 'pending' | 'error';

const tabs: Array<{ key: Tab; label: string; glyph: string }> = [
  { key: 'projects', label: 'Projetos', glyph: '⌂' },
  { key: 'glossaries', label: 'Glossários', glyph: '≡' },
  { key: 'terms', label: 'Termos', glyph: '↔' },
  { key: 'opus', label: 'OPUS', glyph: '◎' },
];

export default function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [tab, setTab] = useState<Tab>('projects');
  const [syncState, setSyncState] = useState<SyncState>('local');
  const [syncMessage, setSyncMessage] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const syncing = useRef(false);

  useEffect(() => {
    if (!auth) {
      setAuthReady(true);
      return;
    }
    return onAuthStateChanged(auth, (user: User | null) => {
      setAccount(user ? { uid: user.uid, email: user.email ?? 'Conta Firebase', demo: false } : null);
      setAuthReady(true);
      setSyncState(user ? 'offline' : 'local');
    });
  }, []);

  async function runSync() {
    if (!account || account.demo || !cloud || syncing.current) return;
    syncing.current = true;
    setSyncState('syncing');
    setSyncMessage('');
    try {
      const network = await Network.getNetworkStateAsync();
      if (!network.isConnected || network.isInternetReachable === false) {
        setSyncState('offline');
        setSyncMessage('Sem internet. As alterações ficam salvas no SQLite deste aparelho.');
        return;
      }
      const result = await synchronize(cloud, account.uid);
      setRefreshKey((value) => value + 1);
      setSyncState(result.remaining ? 'pending' : 'synced');
      setSyncMessage(result.remaining
        ? result.remaining + ' alterações ainda aguardam envio. Toque em sincronizar para tentar novamente.'
        : result.uploaded
          ? result.uploaded + ' alteração(ões) enviada(s); dados locais e nuvem atualizados.'
          : 'Dados deste aparelho e da nuvem estão atualizados.');
    } catch {
      setSyncState('error');
      setSyncMessage('A sincronização falhou. Os dados locais foram mantidos; tente novamente quando a conexão voltar.');
    } finally {
      syncing.current = false;
    }
  }

  useEffect(() => {
    if (!account || account.demo) return;
    void runSync();
    const networkSubscription = Network.addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) void runSync();
      else setSyncState('offline');
    });
    const appSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void runSync();
    });
    return () => {
      networkSubscription.remove();
      appSubscription.remove();
    };
  }, [account?.uid, account?.demo]);

  async function openDemo() {
    let examplesLoaded = false;
    let seedReady = true;
    try {
      examplesLoaded = await ensureDemoData('demo-local');
    } catch {
      seedReady = false;
    }
    setAccount({ uid: 'demo-local', email: 'Demonstração local', demo: true });
    setSyncState('local');
    setSyncMessage(seedReady
      ? examplesLoaded
        ? 'Amostra carregada no SQLite: um projeto, um glossário e três termos jurídicos. Você pode editar ou excluir os exemplos.'
        : 'Demonstração local aberta. Os dados que já estavam neste aparelho foram preservados.'
      : 'Os exemplos não puderam ser carregados; você ainda pode cadastrar dados manualmente.');
  }

  async function exitAccount() {
    if (account?.demo) {
      setAccount(null);
      return;
    }
    if (auth) await signOut(auth);
  }

  if (!authReady) {
    return <View style={styles.loading}><ActivityIndicator color={theme.color.coral} /><Text style={styles.loadingText}>Carregando sua sessão…</Text></View>;
  }

  if (!account) return <><StatusBar style="dark" /><AuthScreen auth={auth} configured={firebaseConfigured} onDemo={openDemo} /></>;

  const activeLabel = syncState === 'syncing'
    ? 'Sincronizando…'
    : syncState === 'synced'
      ? 'Sincronizado'
          : syncState === 'pending'
            ? 'Alterações aguardando envio'
      : syncState === 'error'
        ? 'Falha na sincronização'
        : syncState === 'offline'
          ? 'Offline · salvo no aparelho'
          : 'Modo local';

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar style="dark" />
      <View style={styles.topbar}>
        <View style={styles.brand}>
          <View style={styles.brandMark}><Text style={styles.brandLetter}>L</Text></View>
          <View><Text style={styles.brandName}>Léxica</Text><Text style={styles.brandSub}>CADERNO DE TRADUÇÃO</Text></View>
        </View>
        <View style={styles.account}>
          <Text numberOfLines={1} style={styles.email}>{account.email}</Text>
          <Pressable accessibilityRole="button" onPress={() => void exitAccount()} hitSlop={8}><Text style={styles.signOut}>{account.demo ? 'Sair' : 'Encerrar sessão'}</Text></Pressable>
        </View>
      </View>
      <View style={styles.syncBar}>
        <View style={[styles.syncDot, syncState === 'synced' && styles.dotSynced, syncState === 'error' && styles.dotError, syncState === 'syncing' && styles.dotSyncing]} />
        <Text style={styles.syncLabel}>{account.demo ? 'Demonstração local' : activeLabel}</Text>
        {!account.demo ? <Pressable accessibilityRole="button" disabled={syncState === 'syncing'} onPress={() => void runSync()}><Text style={styles.syncAction}>{syncState === 'syncing' ? '…' : 'Sincronizar'}</Text></Pressable> : null}
      </View>
      {account.demo ? <View style={styles.demoBanner}><Text style={styles.demoBannerText}>Conteúdo de exemplo, somente neste aparelho. Este modo não usa Firebase Auth nem sincroniza com a nuvem.</Text></View> : null}
      {syncMessage ? <View style={styles.message}><Notice tone={syncState === 'error' ? 'error' : syncState === 'synced' ? 'success' : 'info'}>{syncMessage}</Notice></View> : null}
      <View style={styles.content}>
        {tab === 'opus' ? <OpusScreen /> : (
          <CrudScreen
            key={tab}
            ownerId={account.uid}
            localOnly={account.demo}
            definition={entityDefinitions[tab]}
            refreshKey={refreshKey}
            onChanged={() => setRefreshKey((value) => value + 1)}
          />
        )}
      </View>
      <View style={styles.tabs}>
        {tabs.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item.key }}
            onPress={() => setTab(item.key)}
            style={styles.tab}
          >
            <Text style={[styles.tabGlyph, tab === item.key && styles.tabActive]}>{item.glyph}</Text>
            <Text style={[styles.tabLabel, tab === item.key && styles.tabActive]}>{item.label}</Text>
            {tab === item.key ? <View style={styles.tabMark} /> : null}
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: theme.color.paper },
  loading: { flex: 1, backgroundColor: theme.color.paper, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: theme.color.muted, fontSize: 14 },
  topbar: { minHeight: 68, paddingHorizontal: 18, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.color.line },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { width: 36, height: 36, borderRadius: 12, backgroundColor: theme.color.ink, alignItems: 'center', justifyContent: 'center' },
  brandLetter: { color: theme.color.marker, fontSize: 20, fontWeight: '900' },
  brandName: { color: theme.color.ink, fontSize: 19, fontWeight: '900', lineHeight: 22 },
  brandSub: { color: theme.color.muted, fontSize: 8, fontWeight: '800', letterSpacing: 0.9 },
  account: { alignItems: 'flex-end', maxWidth: '52%', gap: 3 },
  email: { color: theme.color.ink, fontSize: 11, fontWeight: '700' },
  signOut: { color: theme.color.coral, fontSize: 11, fontWeight: '700' },
  syncBar: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36, paddingHorizontal: 20, backgroundColor: theme.color.mint },
  syncDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color.warning },
  dotSynced: { backgroundColor: theme.color.success },
  dotError: { backgroundColor: theme.color.danger },
  dotSyncing: { backgroundColor: theme.color.coral },
  syncLabel: { flex: 1, color: theme.color.ink, fontSize: 11, fontWeight: '700' },
  syncAction: { color: theme.color.ink, fontSize: 11, fontWeight: '900', textDecorationLine: 'underline' },
  demoBanner: { paddingHorizontal: 18, paddingVertical: 8, backgroundColor: '#FFF7D9' },
  demoBannerText: { color: theme.color.warning, fontSize: 11, fontWeight: '700' },
  message: { paddingHorizontal: 14, paddingTop: 10 },
  content: { flex: 1 },
  tabs: { flexDirection: 'row', justifyContent: 'space-around', borderTopColor: theme.color.line, borderTopWidth: 1, paddingTop: 7, paddingBottom: 5, backgroundColor: theme.color.surface },
  tab: { minWidth: 68, minHeight: 48, justifyContent: 'center', alignItems: 'center', gap: 1 },
  tabGlyph: { fontSize: 20, color: theme.color.muted, lineHeight: 23 },
  tabLabel: { color: theme.color.muted, fontSize: 10, fontWeight: '700' },
  tabActive: { color: theme.color.ink, fontWeight: '900' },
  tabMark: { position: 'absolute', top: -7, width: 18, height: 3, borderRadius: 2, backgroundColor: theme.color.coral },
});
