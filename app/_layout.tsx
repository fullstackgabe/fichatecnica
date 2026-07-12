import { Platform } from 'react-native'
import { Stack } from 'expo-router'
import { BannerProvider } from '@/lib/banner'
import { colors } from '@/theme'

if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('web-frame')) {
  const s = document.createElement('style')
  s.id = 'web-frame'
  s.textContent = `
    html,body{margin:0}
    @media (min-width:720px){
      body{background:linear-gradient(135deg,#e1e8ff,#eef2ff);min-height:100vh}
      #root{width:460px;max-width:100%;height:min(860px, calc(100vh - 48px));margin:24px auto;background:#fff;border-radius:36px;overflow:hidden;box-shadow:0 24px 70px rgba(15,23,42,.22)}
    }`
  document.head.appendChild(s)
}

export default function Layout() {
  return (
    <BannerProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </BannerProvider>
  )
}
