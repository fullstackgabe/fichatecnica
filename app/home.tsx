import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import {
  atualizarFicha,
  criarFicha,
  excluirFicha,
  fotoBase64,
  obterFicha,
  obterPerfil,
  sair,
  subirFoto,
  urlFoto,
  usuarioAtual,
} from '@/lib/repo'
import { enderecoAtual, localizacaoAtual } from '@/lib/maps'
import { capturarFoto } from '@/lib/fotos'
import { exportarPdf, type FotosPdf } from '@/lib/pdf'
import { useBanner } from '@/lib/banner'
import { Botao, Campo, Secao, ToggleSimNao } from '@/components/ui'
import { colors, sanitizeNome, toTitleCase } from '@/theme'
import { FICHA_VAZIA, FOTO_PATH_KEY, type Ficha, type FichaForm, type FotoCampo } from '@/types'

const CAMPOS_FOTO: { campo: FotoCampo; label: string }[] = [
  { campo: 'foto_cto', label: '📷 Foto da CTO' },
  { campo: 'foto_frente_casa', label: '📷 Foto da frente da casa' },
  { campo: 'foto_instalacao', label: '📷 Foto da instalação do equipamento (ONT/Router)' },
  { campo: 'foto_mac', label: '📷 Foto do MAC do equipamento' },
]

type Fotos = Record<FotoCampo, string | null>
const FOTOS_VAZIAS: Fotos = { foto_cto: null, foto_frente_casa: null, foto_instalacao: null, foto_mac: null }

export default function Home() {
  const router = useRouter()
  const banner = useBanner()
  const { id } = useLocalSearchParams<{ id?: string }>()

  const [form, setForm] = useState<FichaForm>(FICHA_VAZIA)
  const [fotosNovas, setFotosNovas] = useState<Fotos>(FOTOS_VAZIAS)
  const [fotosSalvas, setFotosSalvas] = useState<Fotos>(FOTOS_VAZIAS)
  const [aberta, setAberta] = useState({ cliente: true, cto: false, casa: false, interna: false, fim: false })
  const [salvando, setSalvando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [localizando, setLocalizando] = useState<string | null>(null)
  const [mostrarSenhaWifi, setMostrarSenhaWifi] = useState(false)
  const [modalDeletar, setModalDeletar] = useState(false)
  const [modalPerfil, setModalPerfil] = useState(false)
  const [perfil, setPerfil] = useState({ nome: '', sobrenome: '', telefone: '', email: '' })

  const set = <K extends keyof FichaForm>(k: K, v: FichaForm[K]) => setForm((f) => ({ ...f, [k]: v }))

  const limpar = useCallback(() => {
    setForm(FICHA_VAZIA)
    setFotosNovas(FOTOS_VAZIAS)
    setFotosSalvas(FOTOS_VAZIAS)
    setAberta({ cliente: true, cto: false, casa: false, interna: false, fim: false })
  }, [])

  useEffect(() => {
    if (!id) {
      limpar()
      return
    }
    obterFicha(id).then(async (ficha) => {
      if (!ficha) return
      const { id: _i, user_id: _u, created_at: _c, updated_at: _p, ...resto } = ficha
      setForm(resto)
      const urls: Fotos = { ...FOTOS_VAZIAS }
      for (const { campo } of CAMPOS_FOTO) {
        const path = ficha[FOTO_PATH_KEY[campo]] as string | null
        if (path) urls[campo] = await urlFoto(path)
      }
      setFotosSalvas(urls)
      setFotosNovas(FOTOS_VAZIAS)
    })
  }, [id, limpar])

  const abrirLink = (url: string) => {
    if (!url) return
    if (Platform.OS === 'web') {
      if (window.confirm('Abrir o link no Google Maps?')) window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      Alert.alert('Abrir no Maps', 'Deseja abrir o link no Google Maps?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Abrir', onPress: () => Linking.openURL(url) },
      ])
    }
  }

  const preencherEndereco = async () => {
    setLocalizando('endereco')
    try {
      const end = await enderecoAtual()
      if (end) set('endereco', end)
      else banner('warn', 'Não foi possível identificar o endereço. Preencha manualmente.')
    } catch {
      banner('warn', 'Sinal de GPS fraco. Tente perto de uma janela ou preencha manualmente.')
    } finally {
      setLocalizando(null)
    }
  }

  const capturarLink = async (chave: 'loc_cto_link' | 'loc_casa_link') => {
    setLocalizando(chave)
    try {
      set(chave, await localizacaoAtual())
    } catch {
      banner('warn', 'Não foi possível obter sua localização.')
    } finally {
      setLocalizando(null)
    }
  }

  const tirarFoto = async (campo: FotoCampo) => {
    const dataUri = await capturarFoto()
    if (dataUri) setFotosNovas((f) => ({ ...f, [campo]: dataUri }))
  }

  const completa = Boolean(
    form.nome.trim() &&
      form.endereco.trim() &&
      form.loc_cto_link &&
      form.loc_casa_link &&
      form.cor_fibra.trim() &&
      form.possui_splitter !== null &&
      form.porta_cliente.trim() &&
      form.nome_wifi.trim() &&
      form.senha_wifi.trim() &&
      form.teste_navegacao_ok !== null &&
      form.cliente_satisfeito !== null &&
      CAMPOS_FOTO.every(({ campo }) => fotosNovas[campo] || form[FOTO_PATH_KEY[campo]]),
  )

  const salvar = async () => {
    setSalvando(true)
    try {
      const user = await usuarioAtual()
      if (!user) throw new Error('sem sessão')
      let fichaId = id ?? null
      if (!fichaId) fichaId = await criarFicha(form, user.id)
      const paths: Partial<FichaForm> = {}
      for (const { campo } of CAMPOS_FOTO) {
        const nova = fotosNovas[campo]
        if (nova) paths[FOTO_PATH_KEY[campo]] = await subirFoto(user.id, fichaId, campo, nova)
      }
      await atualizarFicha(fichaId, { ...form, ...paths })
      banner('success', id ? 'Checklist atualizado com sucesso.' : 'Checklist criado com sucesso.')
      if (!id) {
        limpar()
      } else {
        setForm((f) => ({ ...f, ...paths }))
        setFotosNovas(FOTOS_VAZIAS)
      }
    } catch {
      banner('error', 'Não foi possível salvar. Verifique a conexão.')
    } finally {
      setSalvando(false)
    }
  }

  const exportar = async () => {
    setExportando(true)
    try {
      const user = await usuarioAtual()
      const p = user ? await obterPerfil(user.id) : null
      const fotos: FotosPdf = { cto: null, casa: null, instalacao: null, mac: null }
      const mapa: Record<FotoCampo, keyof FotosPdf> = {
        foto_cto: 'cto',
        foto_frente_casa: 'casa',
        foto_instalacao: 'instalacao',
        foto_mac: 'mac',
      }
      for (const { campo } of CAMPOS_FOTO) {
        const path = form[FOTO_PATH_KEY[campo]] as string | null
        fotos[mapa[campo]] = fotosNovas[campo] ?? (path ? await fotoBase64(path) : null)
      }
      const ficha: Ficha = { id: id ?? '', user_id: '', created_at: '', updated_at: '', ...form }
      await exportarPdf(ficha, {
        nome: [p?.first_name, p?.last_name].filter(Boolean).join(' '),
        email: user?.email ?? '',
        telefone: p?.phone ?? '',
      }, fotos)
    } catch {
      banner('error', 'Não foi possível exportar o PDF.')
    } finally {
      setExportando(false)
    }
  }

  const deletar = async () => {
    if (!id) return
    setModalDeletar(false)
    try {
      const user = await usuarioAtual()
      if (!user) throw new Error('sem sessão')
      await excluirFicha(id, user.id)
      banner('success', 'Checklist deletado.')
      router.replace('/home')
    } catch {
      banner('error', 'Não foi possível deletar.')
    }
  }

  const abrirPerfil = async () => {
    const user = await usuarioAtual()
    const p = user ? await obterPerfil(user.id) : null
    setPerfil({
      nome: p?.first_name ?? '',
      sobrenome: p?.last_name ?? '',
      telefone: p?.phone ?? '',
      email: user?.email ?? '',
    })
    setModalPerfil(true)
  }

  const onSair = async () => {
    await sair()
    router.replace('/login')
  }

  const LinkLocalizacao = ({ chave, label }: { chave: 'loc_cto_link' | 'loc_casa_link'; label: string }) => (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={() => abrirLink(form[chave])}>
        <TextInput
          style={[styles.inputLink, form[chave] ? styles.inputLinkPreenchido : null]}
          value={form[chave]}
          placeholder="https://www.google.com/maps?..."
          placeholderTextColor={colors.placeholder}
          editable={false}
          pointerEvents="none"
        />
      </Pressable>
      <Botao
        titulo="Capturar localização"
        onPress={() => capturarLink(chave)}
        carregando={localizando === chave}
      />
    </View>
  )

  const CampoFoto = ({ campo, label }: { campo: FotoCampo; label: string }) => {
    const uri = fotosNovas[campo] ?? fotosSalvas[campo]
    return (
      <View>
        <Text style={styles.label}>{label}</Text>
        {uri ? <Image source={{ uri }} style={styles.foto} resizeMode="cover" /> : null}
        <Botao titulo="Capturar/Selecionar Foto" onPress={() => tirarFoto(campo)} />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <Pressable onPress={abrirPerfil} hitSlop={8}>
          <MaterialCommunityIcons name="account-edit" size={34} color={colors.textSoft} />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable style={styles.headerBtn} onPress={() => router.push('/checklists')}>
            <Text style={styles.headerBtnTexto}>Checklists</Text>
          </Pressable>
          <Pressable style={[styles.headerBtn, { backgroundColor: colors.red }]} onPress={onSair}>
            <Text style={styles.headerBtnTexto}>Sair</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Secao titulo="1️⃣ Dados do cliente" aberta={aberta.cliente} onToggle={() => setAberta((a) => ({ ...a, cliente: !a.cliente }))}>
          <Campo
            label="👤 Nome completo"
            value={form.nome}
            onChangeText={(t) => set('nome', toTitleCase(sanitizeNome(t)))}
            placeholder="Nome completo"
            maxLength={50}
            autoCapitalize="words"
            autoCorrect={false}
          />
          <Campo
            label="🏠 Endereço"
            value={form.endereco}
            onChangeText={(t) => set('endereco', t)}
            placeholder="Rua e número, bairro - cidade"
            maxLength={120}
            labelRight={
              <Pressable onPress={preencherEndereco} disabled={localizando === 'endereco'} hitSlop={8}>
                {localizando === 'endereco' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.linkAcao}> Carregando...</Text>
                  </View>
                ) : (
                  <Text style={styles.linkAcao}>📍 Usar localização atual</Text>
                )}
              </Pressable>
            }
          />
        </Secao>

        <Secao titulo="2️⃣ CTO / rede externa" aberta={aberta.cto} onToggle={() => setAberta((a) => ({ ...a, cto: !a.cto }))}>
          <LinkLocalizacao chave="loc_cto_link" label="📍 Localização da CTO (link do Maps)" />
          <CampoFoto campo="foto_cto" label="📷 Foto da CTO" />
          <Campo
            label="🎨 Cor da fibra"
            value={form.cor_fibra}
            onChangeText={(t) => set('cor_fibra', toTitleCase(sanitizeNome(t)))}
            placeholder="Ex.: Amarela, Azul..."
            maxLength={20}
            autoCapitalize="words"
          />
          <Text style={styles.label}>🔀 Possui splitter?</Text>
          <ToggleSimNao valor={form.possui_splitter} onChange={(v) => set('possui_splitter', v)} />
          <Campo
            label="🔌 Número da porta utilizada pelo cliente"
            value={form.porta_cliente}
            onChangeText={(t) => set('porta_cliente', t)}
            placeholder="Ex.: 4"
            maxLength={10}
            keyboardType="number-pad"
          />
        </Secao>

        <Secao titulo="3️⃣ Casa do cliente" aberta={aberta.casa} onToggle={() => setAberta((a) => ({ ...a, casa: !a.casa }))}>
          <LinkLocalizacao chave="loc_casa_link" label="📍 Localização da casa (link do Maps)" />
          <CampoFoto campo="foto_frente_casa" label="📷 Foto da frente da casa" />
        </Secao>

        <Secao titulo="4️⃣ Instalação interna" aberta={aberta.interna} onToggle={() => setAberta((a) => ({ ...a, interna: !a.interna }))}>
          <CampoFoto campo="foto_instalacao" label="📷 Foto da instalação do equipamento (ONT/Router)" />
          <CampoFoto campo="foto_mac" label="📷 Foto do MAC do equipamento" />
          <Campo
            label="📶 Nome do Wi-Fi"
            value={form.nome_wifi}
            onChangeText={(t) => set('nome_wifi', t)}
            placeholder="Nome da rede"
            maxLength={40}
            autoCapitalize="none"
          />
          <View>
            <Campo
              label="🔑 Senha do Wi-Fi"
              value={form.senha_wifi}
              onChangeText={(t) => set('senha_wifi', t)}
              placeholder="Senha da rede"
              maxLength={40}
              autoCapitalize="none"
              secureTextEntry={!mostrarSenhaWifi}
            />
            <Pressable style={styles.olhoWifi} onPress={() => setMostrarSenhaWifi((v) => !v)} hitSlop={8}>
              <Text style={{ fontSize: 15 }}>{mostrarSenhaWifi ? '🙈' : '👁️'}</Text>
            </Pressable>
          </View>
        </Secao>

        <Secao titulo="5️⃣ Finalização" aberta={aberta.fim} onToggle={() => setAberta((a) => ({ ...a, fim: !a.fim }))}>
          <Text style={styles.label}>🌐 Teste de navegação realizado com sucesso?</Text>
          <ToggleSimNao valor={form.teste_navegacao_ok} onChange={(v) => set('teste_navegacao_ok', v)} />
          <Text style={styles.label}>🤝 Cliente ciente e satisfeito?</Text>
          <ToggleSimNao valor={form.cliente_satisfeito} onChange={(v) => set('cliente_satisfeito', v)} />
        </Secao>

        <Botao
          titulo={id ? 'Salvar Alterações' : 'Criar Checklist'}
          onPress={salvar}
          disabled={id ? !form.nome.trim() : !completa}
          carregando={salvando}
        />
        <Botao titulo="Exportar PDF" variante="secondary" onPress={exportar} carregando={exportando} disabled={!form.nome.trim()} />
        <Botao titulo={id ? 'Novo Checklist' : 'Limpar Campos'} variante="secondary" onPress={() => (id ? router.replace('/home') : limpar())} />
        {id ? <Botao titulo="Deletar Checklist" variante="danger" onPress={() => setModalDeletar(true)} /> : null}
      </ScrollView>

      <Modal visible={modalDeletar} transparent animationType="fade" onRequestClose={() => setModalDeletar(false)}>
        <View style={styles.modalFundo}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>Deletar checklist?</Text>
            <Text style={{ color: colors.textSoft, marginBottom: 16 }}>Essa ação não pode ser desfeita.</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Botao titulo="Cancelar" variante="secondary" onPress={() => setModalDeletar(false)} style={{ flex: 1 }} />
              <Botao titulo="Deletar" variante="danger" onPress={deletar} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalPerfil} transparent animationType="fade" onRequestClose={() => setModalPerfil(false)}>
        <View style={styles.modalFundo}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitulo}>Perfil</Text>
            {[perfil.nome, perfil.sobrenome, perfil.telefone, perfil.email, 'demo1234'].map((v, i) => (
              <TextInput
                key={i}
                style={[styles.inputPerfil, { opacity: 0.7 }]}
                value={v}
                editable={false}
                secureTextEntry={i === 4}
              />
            ))}
            <Botao titulo="Fechar" onPress={() => setModalPerfil(false)} />
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
  label: { fontSize: 13, color: colors.textMid, marginTop: 4, marginBottom: 6 },
  linkAcao: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  inputLink: { backgroundColor: '#eef2ff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text, marginBottom: 8 },
  inputLinkPreenchido: { color: '#1e40af', fontWeight: '600' },
  foto: { width: '100%', height: 180, borderRadius: 10, marginBottom: 8, backgroundColor: colors.inputBg },
  olhoWifi: { position: 'absolute', right: 14, bottom: 18 },
  modalFundo: { flex: 1, backgroundColor: 'rgba(15,23,42,.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalBox: { width: '100%', maxWidth: 380, backgroundColor: colors.card, borderRadius: 14, padding: 20 },
  modalTitulo: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 10 },
  inputPerfil: { backgroundColor: colors.inputBg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colors.text, marginBottom: 8 },
})
