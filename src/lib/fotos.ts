import { Platform } from 'react-native'
import * as ImagePicker from 'expo-image-picker'

function comprimirWeb(dataUri: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const max = 1280
      const escala = Math.min(1, max / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * escala)
      canvas.height = Math.round(img.height * escala)
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(dataUri)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.5))
    }
    img.onerror = () => resolve(dataUri)
    img.src = dataUri
  })
}

export async function capturarFoto(): Promise<string | null> {
  const opcoes: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.6,
    base64: true,
    allowsEditing: false,
  }

  let resultado: ImagePicker.ImagePickerResult | null = null
  if (Platform.OS !== 'web') {
    const cam = await ImagePicker.requestCameraPermissionsAsync()
    if (cam.granted) {
      try {
        resultado = await ImagePicker.launchCameraAsync(opcoes)
      } catch {
        resultado = null
      }
    }
  }
  if (!resultado || resultado.canceled || !resultado.assets?.length) {
    resultado = await ImagePicker.launchImageLibraryAsync(opcoes)
  }
  if (resultado.canceled || !resultado.assets?.length) return null

  const asset = resultado.assets[0]
  const dataUri = asset.base64
    ? `data:image/jpeg;base64,${asset.base64}`
    : asset.uri.startsWith('data:')
      ? asset.uri
      : null
  if (!dataUri) return null
  return Platform.OS === 'web' ? comprimirWeb(dataUri) : dataUri
}
