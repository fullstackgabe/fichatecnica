import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { entrar } from '@/lib/repo'
import { useBanner } from '@/lib/banner'
import { Botao } from '@/components/ui'
import { colors } from '@/theme'

const DEMO_EMAIL = 'demo@demo.com'
const DEMO_SENHA = 'demo1234'

export default function Login() {
  const router = useRouter()
  const banner = useBanner()
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [entrando, setEntrando] = useState(false)

  const onEntrar = async () => {
    setEntrando(true)
    try {
      await entrar(DEMO_EMAIL, DEMO_SENHA)
      router.replace('/home')
    } catch {
      banner('error', 'Não foi possível fazer login.')
    } finally {
      setEntrando(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.box}>
        <Text style={styles.logo}>CheckTécnico</Text>
        <Text style={styles.titulo}>Login</Text>
        <TextInput style={[styles.input, { opacity: 0.7 }]} value={DEMO_EMAIL} editable={false} />
        <View>
          <TextInput
            style={[styles.input, { opacity: 0.7, paddingRight: 48 }]}
            value={DEMO_SENHA}
            editable={false}
            secureTextEntry={!mostrarSenha}
          />
          <Pressable style={styles.olho} onPress={() => setMostrarSenha((v) => !v)} hitSlop={8}>
            <Feather name={mostrarSenha ? 'eye' : 'eye-off'} size={16} color={colors.textSoft} />
          </Pressable>
        </View>
        <Botao titulo="Entrar" onPress={onEntrar} carregando={entrando} style={{ marginTop: 6 }} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 20 },
  box: { width: '100%', maxWidth: 380, backgroundColor: colors.card, borderRadius: 16, padding: 22, shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  logo: { fontSize: 26, fontWeight: '800', color: colors.primary, textAlign: 'center', marginBottom: 4 },
  titulo: { fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 16 },
  input: { backgroundColor: colors.inputBg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: colors.text, marginBottom: 10 },
  olho: { position: 'absolute', right: 14, top: 12 },
})
