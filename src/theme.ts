export const colors = {
  primary: '#2f6fed',
  primaryDark: '#1d4fc4',
  primarySoft: '#e1e8ff',
  bg: '#f8f9fc',
  card: '#ffffff',
  text: '#222222',
  textMid: '#444444',
  textSoft: '#666666',
  border: '#e4e8f2',
  inputBg: '#f7f8fc',
  placeholder: '#9aa0b5',
  green: '#16a34a',
  greenSoft: '#e6f6ea',
  red: '#e53e3e',
  redSoft: '#fde8e8',
  amber: '#92400e',
  amberSoft: '#fef3c7',
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export function grupoMes(iso: string) {
  const d = new Date(iso)
  return { key: `${d.getFullYear()}-${d.getMonth()}`, label: `${MESES[d.getMonth()]} ${d.getFullYear()}` }
}

export function fmtDataHora(iso: string) {
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-BR')} • ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

export const toTitleCase = (s: string) =>
  s
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ')

export const sanitizeNome = (s: string) => s.replace(/[^A-Za-zÀ-ÿ\s'-]/g, '')
