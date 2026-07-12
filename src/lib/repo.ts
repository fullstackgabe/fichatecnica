import { supabase } from './supabase'
import type { Ficha, FichaForm, FichaResumo, FotoCampo, Perfil } from '../types'

export async function entrar(email: string, senha: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })
  if (error) throw error
  return data.user
}

export async function sair() {
  await supabase.auth.signOut()
}

export async function usuarioAtual() {
  const { data } = await supabase.auth.getUser()
  return data.user ?? null
}

export async function obterPerfil(userId: string): Promise<Perfil | null> {
  const { data } = await supabase
    .from('users')
    .select('first_name, last_name, phone')
    .eq('id', userId)
    .maybeSingle()
  return data
}

export async function listarFichas(): Promise<FichaResumo[]> {
  const { data, error } = await supabase
    .from('fichas')
    .select('id, nome, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function obterFicha(id: string): Promise<Ficha | null> {
  const { data, error } = await supabase.from('fichas').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function criarFicha(form: FichaForm, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('fichas')
    .insert({ ...form, user_id: userId })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function atualizarFicha(id: string, form: Partial<FichaForm>) {
  const { error } = await supabase
    .from('fichas')
    .update({ ...form, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function excluirFicha(id: string, userId: string) {
  const { data: arquivos } = await supabase.storage.from('fotos').list(`${userId}/${id}`)
  if (arquivos?.length) {
    await supabase.storage.from('fotos').remove(arquivos.map((a) => `${userId}/${id}/${a.name}`))
  }
  const { error } = await supabase.from('fichas').delete().eq('id', id)
  if (error) throw error
}

function dataUriParaBytes(dataUri: string) {
  const base64 = dataUri.slice(dataUri.indexOf(',') + 1)
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export async function subirFoto(
  userId: string,
  fichaId: string,
  campo: FotoCampo,
  dataUri: string,
): Promise<string> {
  const path = `${userId}/${fichaId}/${campo}.jpg`
  const { error } = await supabase.storage
    .from('fotos')
    .upload(path, dataUriParaBytes(dataUri), { contentType: 'image/jpeg', upsert: true })
  if (error) throw error
  return path
}

export async function urlFoto(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('fotos').createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}

export async function fotoBase64(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('fotos').download(path)
  if (error || !data) return null
  return await new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(data)
  })
}
