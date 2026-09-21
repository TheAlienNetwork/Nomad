import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRouter } from 'expo-router';

import { FieldButton } from '@/components/field-button';
import { Nomad } from '@/constants/theme';
import { signIn, signUp } from '@/src/cloud-sync';

const logo = require('@/assets/images/nomad-logo.png');

type Mode = 'sign-in' | 'create';

export default function SignInScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const creating = mode === 'create';

  async function submit(): Promise<void> {
    const trimmed = email.trim();
    if (!trimmed.includes('@') || trimmed.length < 5) {
      setMessage('Enter a valid email.');
      return;
    }
    if (password.length < 6) {
      setMessage('Password must be at least 6 characters.');
      return;
    }
    if (creating && password !== confirm) {
      setMessage('Passwords do not match.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      if (creating) {
        const session = await signUp(trimmed, password);
        setMessage(
          session
            ? null
            : 'Account created. Check your email if confirmation is required, then sign in.',
        );
        if (!session) setMode('sign-in');
        return;
      }
      await signIn(trimmed, password);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not complete that.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <Image
        source={logo}
        style={styles.backdrop}
        resizeMode="contain"
        accessibilityLabel="Nomad"
      />
      <View style={styles.scrim} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.kicker}>NOMAD</Text>
          <Text style={styles.title}>{creating ? 'Create account' : 'Sign in'}</Text>
          <Text style={styles.lede}>
            Sign in to open the map, memoir, and field kit.
          </Text>
          <Text style={styles.disclaimer}>
            Internal preview. Nomad is not a legal land-access, season, or permission
            tool. Verify posted boundaries before you hunt.
          </Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="rgba(255, 255, 255, 0.55)"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            style={styles.input}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="rgba(255, 255, 255, 0.55)"
            autoComplete={creating ? 'new-password' : 'password'}
            secureTextEntry
            style={styles.input}
          />
          {creating ? (
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Confirm password"
              placeholderTextColor="rgba(255, 255, 255, 0.55)"
              autoComplete="new-password"
              secureTextEntry
              style={styles.input}
            />
          ) : null}

          <FieldButton
            accessibilityLabel={creating ? 'Create account' : 'Sign in'}
            disabled={busy}
            glass
            style={styles.primary}
            onPress={() => {
              void submit();
            }}>
            <Text style={styles.primaryLabel}>
              {busy ? 'Working…' : creating ? 'Create account' : 'Sign in'}
            </Text>
          </FieldButton>

          <FieldButton
            accessibilityLabel={creating ? 'Switch to sign in' : 'Switch to create account'}
            glass
            style={styles.ghost}
            onPress={() => {
              setMode(creating ? 'sign-in' : 'create');
              setMessage(null);
            }}>
            <Text style={styles.ghostLabel}>
              {creating ? 'Already have an account? Sign in' : 'New here? Create an account'}
            </Text>
          </FieldButton>

          <FieldButton
            accessibilityLabel="Privacy"
            glass
            style={styles.ghost}
            onPress={() => router.push('/privacy')}>
            <Text style={styles.ghostLabel}>Privacy</Text>
          </FieldButton>

          {message ? <Text style={styles.warn}>{message}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 8, 6, 0.22)',
  },
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 28,
    paddingVertical: 32,
    gap: 12,
  },
  kicker: {
    color: Nomad.rust,
    fontWeight: '800',
    letterSpacing: 3,
    textAlign: 'center',
    fontSize: 12,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  title: {
    color: Nomad.bone,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  lede: {
    color: Nomad.bone,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  disclaimer: {
    color: Nomad.mist,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Nomad.rust,
    backgroundColor: 'rgba(241, 90, 36, 0.18)',
    color: '#FFFFFF',
    paddingHorizontal: 14,
  },
  primary: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(241, 90, 36, 0.16)',
    borderColor: 'rgba(255, 186, 140, 0.72)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: 'rgba(241, 90, 36, 0.45)',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  primaryLabel: {
    color: '#FFE8D6',
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  ghost: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(232, 223, 208, 0.42)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostLabel: {
    color: Nomad.bone,
    fontWeight: '700',
  },
  warn: {
    color: '#ffd166',
    fontSize: 13,
    textAlign: 'center',
  },
});
