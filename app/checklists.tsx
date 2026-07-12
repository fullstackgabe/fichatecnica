import { useCallback, useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { fotoBase64, excluirFicha, listarFichas, obterFicha, obterPerfil, sair, usuarioAtual } from '@/lib/repo'
import { exportarPdf, type FotosPdf } from '@/lib/pdf'
import { useBanner } from '@/lib/banner'
import { Botao, Secao } from '@/components/ui'
import { colors, fmtDataHora, grupoMes } from '@/theme'
import { FOTO_PATH_KEY, type FichaResumo, type FotoCampo } from '@/types'

interface Grupo {
  key: string
  label: string
  itens: FichaResumo[]
}

export default function Checklists() {
  const router = useRouter()
  const banner = useBanner()
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [abertos, setAbertos] = useState<Record<string, boolean>>({})
  const [exportando, setExportando] = useState<string | null>(null)
  const [deletando, setDeletando] = useState<FichaResumo | null>(null)
  const [vazio, setVazio] = useState(false)

  const carregar = useCallback(async () => {
    const fichas = await listarFichas()
    const gs: Grupo[] = []
    for (const f of fichas) {
      const { key, label } = grupoMes(f.created_at)
      let g = gs.find((x) => x.key === key)
      if (!g) {
        g = { key, label, itens: [] }
        gs.push(g)
      }
      g.itens.push(f)
    }
    setGrupos(gs)
    setVazio(gs.length === 0)
    setAbertos((prev) => {
      const next = { ...prev }
      for (const g of gs) if (next[g.key] === undefined) next[g.key] = true
      return next
    })
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const exportar = async (item: FichaResumo) => {
    setExportando(item.id)
    try {
      const ficha = await obterFicha(item.id)
      if (!ficha) throw new Error('não encontrada')
      const user = await usuarioAtual()
      const p = user ? await obterPerfil(user.id) : null
      const fotos: FotosPdf = { cto: null, casa: null, instalacao: null, mac: null }
      const mapa: Record<FotoCampo, keyof FotosPdf> = {
        foto_cto: 'cto',
        foto_frente_casa: 'casa',
        foto_instalacao: 'instalacao',
        foto_mac: 'mac',
      }
      for (const campo of Object.keys(mapa) as FotoCampo[]) {
        const path = ficha[FOTO_PATH_KEY[campo]] as string | null
        if (path) fotos[mapa[campo]] = await fotoBase64(path)
      }
      await exportarPdf(ficha, {
        nome: [p?.first_name, p?.last_name].filter(Boolean).join(' '),
        email: user?.email ?? '',
        telefone: p?.phone ?? '',
      }, fotos)
    } catch {
      banner('error', 'Não foi possível exportar o PDF.')
    } finally {
      setExportando(null)
    }
  }

  const deletar = async () => {
    const alvo = deletando
    setDeletando(null)
    if (!alvo) return
    try {
      const user = await usuarioAtual()
      if (!user) throw new Error('sem sessão')
      await excluirFicha(alvo.id, user.id)
      banner('success', 'Checklist deletado.')
      carregar()
    } catch {
      banner('error', 'Não foi possível deletar.')
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <Pressable style={styles.headerBtn} onPress={() => router.replace('/home')}>
          <Text style={styles.headerBtnTexto}>Voltar</Text>
        </Pressable>
        <Pressable
          style={[styles.headerBtn, { backgroundColor: colors.red }]}
          onPress={async () => {
            await sair()
            router.replace('/login')
          }}
        >
          <Text style={styles.headerBtnTexto}>Sair</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.titulo}>Checklists</Text>
        {vazio ? <Text style={{ color: colors.textSoft }}>Nenhum checklist pra exibir ainda.</Text> : null}
        {grupos.map((g) => (
          <Secao
            key={g.key}
            titulo={g.label}
            aberta={!!abertos[g.key]}
            onToggle={() => setAbertos((a) => ({ ...a, [g.key]: !a[g.key] }))}
          >
            {g.itens.map((item) => (
              <View key={item.id} style={styles.item}>
                <Pressable style={{ flex: 1 }} onPress={() => router.push({ pathname: '/home', params: { id: item.id } })}>
                  <Text style={styles.itemNome} numberOfLines={1}>
                    {item.nome || 'Sem nome'}
                  </Text>
                  <Text style={styles.itemData}>{fmtDataHora(item.created_at)}</Text>
                </Pressable>
                <Botao
                  titulo="Exportar"
                  variante="secondary"
                  onPress={() => exportar(item)}
                  carregando={exportando === item.id}
                  style={styles.itemBtn}
                />
                <Botao titulo="Deletar" variante="danger" onPress={() => setDeletando(item)} style={styles.itemBtn} />
              </View>
            ))}
          </Secao>
        ))}
      </ScrollView>

      <Modal visible={!!deletando} transparent animationType="fade" onRequestClose={() => setDeletando(null)}>
        <View style={styles.modalFundo}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>Deletar checklist?</Text>
            <Text style={{ color: colors.textSoft, marginBottom: 16 }}>
              {deletando?.nome ? `"${deletando.nome}" será removido de vez.` : 'Essa ação não pode ser desfeita.'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Botao titulo="Cancelar" variante="secondary" onPress={() => setDeletando(null)} style={{ flex: 1 }} />
              <Botao titulo="Deletar" variante="danger" onPress={deletar} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  headerBtnTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
  titulo: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 14 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemNome: { fontSize: 15, fontWeight: '700', color: colors.text },
  itemData: { fontSize: 12, color: colors.textSoft, marginTop: 2 },
  itemBtn: { marginBottom: 0, paddingVertical: 8, paddingHorizontal: 12 },
  modalFundo: { flex: 1, backgroundColor: 'rgba(15,23,42,.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalBox: { width: '100%', maxWidth: 380, backgroundColor: colors.card, borderRadius: 14, padding: 20 },
  modalTitulo: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 10 },
})
