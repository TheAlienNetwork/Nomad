import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { FieldButton } from '@/components/field-button';
import { Colors, Nomad } from '@/constants/theme';
import { signIn, signOut, signUp, useCloudSession } from '@/src/cloud-sync';

export function AccountCard() {
  const session = useCloudSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Account</Text>
      {session.email ? (
        <>
          <Text style={styles.body}>{session.email}</Text>
          <Text style={styles.quiet}>Saved to your account when you are online.</Text>
          <Text style={styles.quiet}>
            Internal preview — not a legal land-access or permission tool.
          </Text>
          <FieldButton
            accessibilityLabel="Sign out"
            style={styles.button}
            onPress={() => {
              void signOut();
            }}>
            <Text style={styles.buttonLabel}>Sign out</Text>
          </FieldButton>
        </>
      ) : (
        <>
          <Text style={styles.quiet}>Sign in to save across devices</Text>
          {!session.configured ? (
            <Text style={styles.warn}>
              Cloud save is unconfigured. Add EXPO_PUBLIC_SUPABASE_URL and
              EXPO_PUBLIC_SUPABASE_ANON_KEY.
            </Text>
          ) : (
            <>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={Colors.dark.muted}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={Colors.dark.muted}
                secureTextEntry
                style={styles.input}
              />
              <View style={styles.row}>
                <FieldButton
                  accessibilityLabel="Sign in"
                  style={styles.button}
                  onPress={() => {
                    void (async () => {
                      try {
                        await signIn(email, password);
                        setMessage(null);
                      } catch (error) {
                        setMessage(error instanceof Error ? error.message : 'Sign in failed.');
                      }
                    })();
                  }}>
                  <Text style={styles.buttonLabel}>Sign in</Text>
                </FieldButton>
                <FieldButton
                  accessibilityLabel="Create account"
                  style={styles.ghost}
                  onPress={() => {
                    void (async () => {
                      try {
                        await signUp(email, password);
                        setMessage('Check email if confirmation is required, then sign in.');
                      } catch (error) {
                        setMessage(error instanceof Error ? error.message : 'Sign up failed.');
                      }
                    })();
                  }}>
                  <Text style={styles.ghostLabel}>Create account</Text>
                </FieldButton>
              </View>
            </>
          )}
          {message ? <Text style={styles.warn}>{message}</Text> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Nomad.steel,
    borderColor: Nomad.line,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    marginBottom: 16,
  },
  title: {
    color: Nomad.bone,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  body: {
    color: Colors.dark.text,
  },
  quiet: {
    color: Colors.dark.muted,
    fontSize: 13,
  },
  warn: {
    color: '#ffd166',
    fontSize: 12,
  },
  input: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Nomad.ink,
    color: Nomad.bone,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: Nomad.rust,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    color: '#fff',
    fontWeight: '800',
  },
  ghost: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Nomad.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostLabel: {
    color: Nomad.bone,
    fontWeight: '700',
  },
});
