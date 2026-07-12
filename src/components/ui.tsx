import { type ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'
import { colors } from '@/theme'

type Variante = 'primary' | 'secondary' | 'danger'

export function Botao({
  titulo,
  onPress,
  variante = 'primary',
  disabled,
  carregando,
  style,
}: {
  titulo: string
  onPress: () => void
  variante?: Variante
  disabled?: boolean
  carregando?: boolean
  style?: object
}) {
  const base =
    variante === 'primary' ? styles.btnPrimary : variante === 'danger' ? styles.btnDanger : styles.btnSecondary
  const texto = variante === 'secondary' ? styles.btnSecondaryText : styles.btnPrimaryText
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || carregando}
      style={[styles.btn, base, (disabled || carregando) && { opacity: 0.55 }, style]}
    >
      {carregando ? (
        <ActivityIndicator size="small" color={variante === 'secondary' ? colors.primary : '#fff'} />
      ) : (
        <Text style={texto}>{titulo}</Text>
      )}
    </Pressable>
  )
}

export function Campo({
  label,
  labelRight,
  ...props
}: TextInputProps & { label: string; labelRight?: ReactNode }) {
  return (
    <View>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {labelRight}
      </View>
      <TextInput style={styles.input} placeholderTextColor={colors.placeholder} {...props} />
    </View>
  )
}

export function Secao({
  titulo,
  aberta,
  onToggle,
  children,
}: {
  titulo: string
  aberta: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <View style={styles.secao}>
      <Pressable onPress={onToggle} style={styles.secaoHeader}>
        <Text style={styles.secaoTitulo}>{titulo}</Text>
        <Text style={{ color: colors.textSoft, fontSize: 13 }}>{aberta ? '▲' : '▼'}</Text>
      </Pressable>
      {aberta ? <View style={styles.secaoBody}>{children}</View> : null}
    </View>
  )
}

export function ToggleSimNao({ valor, onChange }: { valor: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
      <Pressable onPress={() => onChange(true)} style={[styles.toggleOpcao, valor === true && styles.toggleAtivo]}>
        <Text style={[styles.toggleTexto, valor === true && styles.toggleTextoAtivo]}>✅ Sim</Text>
      </Pressable>
      <Pressable onPress={() => onChange(false)} style={[styles.toggleOpcao, valor === false && styles.toggleAtivo]}>
        <Text style={[styles.toggleTexto, valor === false && styles.toggleTextoAtivo]}>❌ Não</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  btn: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  btnPrimary: { backgroundColor: colors.primary },
  btnDanger: { backgroundColor: colors.red },
  btnSecondary: { backgroundColor: colors.primarySoft },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnSecondaryText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 6 },
  label: { fontSize: 13, color: colors.textMid },
  input: { backgroundColor: colors.inputBg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: colors.text, marginBottom: 8 },
  secao: { backgroundColor: colors.card, borderRadius: 12, marginBottom: 12, shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  secaoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  secaoTitulo: { fontSize: 16, fontWeight: '700', color: colors.text },
  secaoBody: { paddingHorizontal: 14, paddingBottom: 14 },
  toggleOpcao: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.inputBg },
  toggleAtivo: { backgroundColor: colors.primarySoft, borderWidth: 1.5, borderColor: colors.primary },
  toggleTexto: { color: colors.textSoft, fontWeight: '600' },
  toggleTextoAtivo: { color: colors.primary },
})
