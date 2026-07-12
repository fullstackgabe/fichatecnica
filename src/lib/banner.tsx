import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Animated, Platform, StyleSheet, Text, View } from 'react-native'

type Tipo = 'success' | 'error' | 'warn'

const BannerContext = createContext<(tipo: Tipo, msg: string) => void>(() => {})

export const useBanner = () => useContext(BannerContext)

const CORES: Record<Tipo, { bg: string; texto: string }> = {
  success: { bg: '#e6f6ea', texto: '#166534' },
  error: { bg: '#fde8e8', texto: '#7f1d1d' },
  warn: { bg: '#fef3c7', texto: '#92400e' },
}

export function BannerProvider({ children }: { children: ReactNode }) {
  const [visivel, setVisivel] = useState(false)
  const [tipo, setTipo] = useState<Tipo>('success')
  const [msg, setMsg] = useState('')
  const opacity = useRef(new Animated.Value(0)).current
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const mostrar = useCallback(
    (t: Tipo, m: string) => {
      setTipo(t)
      setMsg(m)
      setVisivel(true)
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: Platform.OS !== 'web' }).start()
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 600, useNativeDriver: Platform.OS !== 'web' }).start(() =>
          setVisivel(false),
        )
      }, 3500)
    },
    [opacity],
  )

  return (
    <BannerContext.Provider value={mostrar}>
      {children}
      {visivel ? (
        <View pointerEvents="none" style={styles.wrap}>
          <Animated.View style={[styles.box, { backgroundColor: CORES[tipo].bg, opacity }]}>
            <Text style={{ color: CORES[tipo].texto, fontWeight: '600', fontSize: 14 }}>{msg}</Text>
          </Animated.View>
        </View>
      ) : null}
    </BannerContext.Provider>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 24, left: 0, right: 0, alignItems: 'center', zIndex: 50 },
  box: { borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12, maxWidth: 380, marginHorizontal: 16 },
})
