export type FotoCampo = 'foto_cto' | 'foto_frente_casa' | 'foto_instalacao' | 'foto_mac'

export interface Ficha {
  id: string
  user_id: string
  created_at: string
  updated_at: string
  nome: string
  endereco: string
  loc_cto_link: string
  cor_fibra: string
  possui_splitter: boolean | null
  porta_cliente: string
  loc_casa_link: string
  nome_wifi: string
  senha_wifi: string
  teste_navegacao_ok: boolean | null
  cliente_satisfeito: boolean | null
  foto_cto_path: string | null
  foto_frente_casa_path: string | null
  foto_instalacao_path: string | null
  foto_mac_path: string | null
}

export type FichaForm = Omit<Ficha, 'id' | 'user_id' | 'created_at' | 'updated_at'>

export interface FichaResumo {
  id: string
  nome: string
  created_at: string
}

export interface Perfil {
  first_name: string
  last_name: string
  phone: string
}

export const FICHA_VAZIA: FichaForm = {
  nome: '',
  endereco: '',
  loc_cto_link: '',
  cor_fibra: '',
  possui_splitter: null,
  porta_cliente: '',
  loc_casa_link: '',
  nome_wifi: '',
  senha_wifi: '',
  teste_navegacao_ok: null,
  cliente_satisfeito: null,
  foto_cto_path: null,
  foto_frente_casa_path: null,
  foto_instalacao_path: null,
  foto_mac_path: null,
}

export const FOTO_PATH_KEY = {
  foto_cto: 'foto_cto_path',
  foto_frente_casa: 'foto_frente_casa_path',
  foto_instalacao: 'foto_instalacao_path',
  foto_mac: 'foto_mac_path',
} as const
