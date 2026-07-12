import { useEffect, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { colors } from '@/theme'

export default function Index() {
  const router = useRouter()
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      router.replace(data.session ? '/home' : '/login')
      setPronto(true)
    })
  }, [router])

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <Text style={{ fontSize: 24, fontWeight: '800', color: colors.primary, marginBottom: 18 }}>CheckTécnico</Text>
      <ActivityIndicator size="large" color={colors.primary} />
      {pronto ? null : null}
    </View>
  )
}
