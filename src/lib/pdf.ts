import { Platform } from 'react-native'
import * as Print from 'expo-print'
import { shareAsync } from 'expo-sharing'
import type { Ficha } from '@/types'
import { toTitleCase } from '@/theme'

const esc = (s: string | null | undefined) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export interface Tecnico {
  nome: string
  email: string
  telefone: string
}

export interface FotosPdf {
  cto: string | null
  casa: string | null
  instalacao: string | null
  mac: string | null
}

const simNao = (v: boolean | null) => (v === true ? 'Sim' : v === false ? 'Não' : '—')

const linha = (label: string, valor: string) =>
  valor ? `<div class="row"><span class="label">${esc(label)}:</span> ${esc(valor)}</div>` : ''

const link = (label: string, url: string) =>
  url
    ? `<div class="row"><span class="label">${esc(label)}:</span> <span class="link"><a href="${esc(url)}">${esc(url)}</a></span></div>`
    : ''

const figura = (label: string, src: string | null) =>
  src
    ? `<div class="row"><span class="label">${esc(label)}</span></div><div class="figure"><img class="img" src="${src}" alt="${esc(label)}" /></div>`
    : ''

function html(ficha: Ficha, tecnico: Tecnico, fotos: FotosPdf) {
  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: A4; margin: 10mm; }
        body { font-family: -apple-system, Roboto, Arial; background: #f6f7fb; padding: 10px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .title { font-size: 20px; font-weight: 700; color: #222; }
        .meta { font-size: 12px; color: #666; }
        .card { background: #fff; border-radius: 8px; padding: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.06); margin: 12px 0; page-break-inside: avoid; break-inside: avoid; }
        .cardHeader { display: flex; align-items: center; margin-bottom: 8px; }
        .badge { display: inline-block; background: #e1e8ff; color: #2f6fed; font-weight: 700; font-size: 12px; border-radius: 6px; padding: 4px 8px; margin-right: 8px; }
        .cardTitle { font-size: 16px; font-weight: 600; color: #333; }
        .row { margin: 4px 0; font-size: 13px; color: #444; line-height: 1.35; break-inside: avoid; page-break-inside: avoid; }
        .label { font-weight: 600; }
        .figure { margin: 6px 0; break-inside: avoid; page-break-inside: avoid; }
        .img { width: 260px; height: 160px; object-fit: cover; border-radius: 8px; }
        a { color: #2f6fed; text-decoration: none; }
        .link { word-break: break-all; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">CheckTécnico</div>
        <div class="meta">${esc(new Date().toLocaleString('pt-BR'))}</div>
      </div>
      <div class="card">
        ${linha('Técnico', tecnico.nome)}
        ${linha('E‑mail', tecnico.email)}
        ${linha('Telefone', tecnico.telefone)}
      </div>
      <div class="card">
        <div class="cardHeader"><span class="badge">1</span><span class="cardTitle">Dados do cliente</span></div>
        ${linha('Nome completo', ficha.nome ? toTitleCase(ficha.nome) : '')}
        ${linha('Endereço', ficha.endereco)}
      </div>
      <div class="card">
        <div class="cardHeader"><span class="badge">2</span><span class="cardTitle">CTO / rede externa</span></div>
        ${link('Localização da CTO (link do Maps)', ficha.loc_cto_link)}
        ${figura('Foto da CTO', fotos.cto)}
        ${linha('Cor da fibra', ficha.cor_fibra)}
        ${ficha.possui_splitter !== null ? linha('Possui splitter?', simNao(ficha.possui_splitter)) : ''}
        ${linha('Número da porta utilizada pelo cliente', ficha.porta_cliente)}
      </div>
      <div class="card">
        <div class="cardHeader"><span class="badge">3</span><span class="cardTitle">Casa do cliente</span></div>
        ${link('Localização da casa (link do Maps)', ficha.loc_casa_link)}
        ${figura('Foto da frente da casa', fotos.casa)}
      </div>
      <div class="card">
        <div class="cardHeader"><span class="badge">4</span><span class="cardTitle">Instalação interna</span></div>
        ${figura('Foto da instalação do equipamento (ONT/Router)', fotos.instalacao)}
        ${figura('Foto do MAC do equipamento', fotos.mac)}
        ${linha('Nome do Wi‑Fi', ficha.nome_wifi)}
        ${linha('Senha do Wi‑Fi', ficha.senha_wifi)}
      </div>
      <div class="card">
        <div class="cardHeader"><span class="badge">5</span><span class="cardTitle">Finalização</span></div>
        ${ficha.teste_navegacao_ok !== null ? linha('Teste de navegação realizado com sucesso?', simNao(ficha.teste_navegacao_ok)) : ''}
        ${ficha.cliente_satisfeito !== null ? linha('Cliente ciente e satisfeito?', simNao(ficha.cliente_satisfeito)) : ''}
      </div>
    </body>
  </html>`
}

export async function exportarPdf(ficha: Ficha, tecnico: Tecnico, fotos: FotosPdf) {
  const conteudo = html(ficha, tecnico, fotos)
  if (Platform.OS === 'web') {
    const win = window.open('', '_blank')
    if (!win) throw new Error('popup bloqueado')
    win.document.write(conteudo)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 600)
    return
  }
  const { uri } = await Print.printToFileAsync({ html: conteudo })
  await shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' })
}
