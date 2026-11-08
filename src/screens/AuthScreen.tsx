import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, type Auth } from 'firebase/auth';
import { Button, Card, Eyebrow, Field, Notice } from '../components/UI';
import { theme } from '../theme';

export function AuthScreen({
  auth,
  configured,
  onDemo,
}: {
  auth: Auth | null;
  configured: boolean;
  onDemo: () => void;
}) {
  const [createAccount, setCreateAccount] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    if (!email.trim() || password.length < 6) {
      setError('Informe um e-mail e uma senha com pelo menos 6 caracteres.');
      return;
    }
    if (!auth) {
      setError('Configure o Firebase para entrar com uma conta.');
      return;
    }
    setBusy(true);
    try {
      if (createAccount) await createUserWithEmailAndPassword(auth, email.trim(), password);
      else await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (cause) {
      const code = (cause as { code?: string }).code ?? '';
      setError(code.includes('email-already-in-use')
        ? 'Este e-mail já tem uma conta. Entre em vez de criar outra.'
        : code.includes('invalid-credential') || code.includes('user-not-found') || code.includes('wrong-password')
          ? 'E-mail ou senha não conferem.'
          : code.includes('weak-password')
            ? 'A senha precisa ter pelo menos 6 caracteres.'
            : 'Não foi possível autenticar. Verifique a conexão e as configurações do Firebase.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.brand}>
        <View style={styles.mark}><Text style={styles.markText}>L</Text></View>
        <View>
          <Eyebrow>FERRAMENTA DE TRADUÇÃO</Eyebrow>
          <Text style={styles.title}>Léxica</Text>
        </View>
      </View>
      <Text style={styles.intro}>Seus projetos, termos e glossários continuam à mão, mesmo sem internet.</Text>
      <Card>
        <Text style={styles.cardTitle}>{createAccount ? 'Criar uma conta' : 'Entrar na sua conta'}</Text>
        <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Field label="Senha" value={password} onChangeText={setPassword} secureTextEntry autoComplete={createAccount ? 'new-password' : 'current-password'} />
        {error ? <Notice tone="error">{error}</Notice> : null}
        {busy ? <ActivityIndicator color={theme.color.coral} /> : (
          <Button label={createAccount ? 'Criar conta' : 'Entrar'} onPress={() => void submit()} />
        )}
        <Button kind="quiet" label={createAccount ? 'Já tenho conta' : 'Criar conta'} onPress={() => { setCreateAccount(!createAccount); setError(''); }} />
      </Card>
      {!configured ? (
        <Notice tone="warning">
          O Firebase ainda precisa ser configurado. Crie um projeto no Firebase, habilite Authentication por e-mail e Firestore, copie os valores de .env.example para .env e reinicie o Expo.
        </Notice>
      ) : null}
      <Card style={styles.demoCard}>
        <Eyebrow>PARA TESTAR A INTERFACE</Eyebrow>
        <Text style={styles.demoText}>A demonstração local usa SQLite no aparelho e não cria uma conta nem envia os dados para a nuvem.</Text>
        <Button kind="quiet" label="Abrir demonstração local" onPress={onDemo} />
      </Card>
      <Text style={styles.privacy}>MyMemory só recebe uma frase quando você escolhe consultar a API. Seus registros ficam no dispositivo e na sua conta Firestore.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', gap: 20, padding: 24, backgroundColor: theme.color.paper },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  mark: { width: 54, height: 54, borderRadius: 18, backgroundColor: theme.color.ink, alignItems: 'center', justifyContent: 'center' },
  markText: { color: theme.color.marker, fontSize: 29, fontWeight: '900' },
  title: { color: theme.color.ink, fontSize: 36, fontWeight: '900', letterSpacing: -1.2 },
  intro: { color: theme.color.muted, fontSize: 17, lineHeight: 25, maxWidth: 390 },
  cardTitle: { color: theme.color.ink, fontWeight: '800', fontSize: 20, marginBottom: 4 },
  demoCard: { borderStyle: 'dashed' },
  demoText: { color: theme.color.muted, fontSize: 13, lineHeight: 19 },
  privacy: { color: theme.color.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
