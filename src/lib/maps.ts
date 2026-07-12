import { Platform } from 'react-native'
import * as Location from 'expo-location'

export function linkMaps(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`
}

interface Coords {
  lat: number
  lng: number
}

function posicaoWeb(precisa: boolean): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('sem geolocalização'))
    const alvo = precisa ? 15 : 30
    const espera = precisa ? 15000 : 8000
    let melhor: GeolocationPosition | null = null
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        if (!melhor || pos.coords.accuracy < melhor.coords.accuracy) melhor = pos
        if (pos.coords.accuracy <= alvo) finalizar()
      },
      () => {
        navigator.geolocation.clearWatch(watch)
        if (melhor) finalizar()
        else reject(new Error('sem posição'))
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: espera },
    )
    const timer = setTimeout(finalizar, espera)
    function finalizar() {
      clearTimeout(timer)
      navigator.geolocation.clearWatch(watch)
      if (melhor) resolve({ lat: melhor.coords.latitude, lng: melhor.coords.longitude })
      else reject(new Error('sem posição'))
    }
  })
}

async function posicaoNativa(precisa: boolean): Promise<Coords> {
  const { status } = await Location.requestForegroundPermissionsAsync()
  if (status !== 'granted') throw new Error('permissão de localização negada')
  const pos = await Location.getCurrentPositionAsync({
    accuracy: precisa ? Location.Accuracy.Highest : Location.Accuracy.Balanced,
  })
  return { lat: pos.coords.latitude, lng: pos.coords.longitude }
}

async function posicaoAtual(precisa = false): Promise<Coords> {
  return Platform.OS === 'web' ? posicaoWeb(precisa) : posicaoNativa(precisa)
}

export async function localizacaoAtual(): Promise<string> {
  const { lat, lng } = await posicaoAtual(false)
  return linkMaps(lat, lng)
}

export async function enderecoAtual(): Promise<string | null> {
  const { lat, lng } = await posicaoAtual(true)
  let rua = ''
  let numero = ''
  let bairro = ''
  let cidade = ''
  if (Platform.OS === 'web') {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=pt-BR`,
    )
    const j = resp.ok ? await resp.json() : null
    const a = j?.address ?? {}
    rua = a.road || a.pedestrian || ''
    numero = a.house_number || ''
    bairro = a.suburb || a.neighbourhood || a.quarter || a.city_district || a.borough || a.residential || ''
    cidade = a.city || a.town || a.village || a.municipality || ''
  } else {
    const [r] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng })
    if (r) {
      rua = r.street ?? ''
      numero = r.streetNumber ?? ''
      bairro = r.district ?? ''
      cidade = r.city ?? r.subregion ?? ''
    }
  }
  if (!rua && !bairro && !cidade) return null
  const ruaNum = [rua, numero].filter(Boolean).join(' ')
  return [ruaNum, bairro].filter(Boolean).join(', ') + (cidade ? ` - ${cidade}` : '')
}
