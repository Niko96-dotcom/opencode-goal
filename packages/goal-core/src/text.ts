export function tailText(text: string, max = 4000) {
  if (text.length <= max) return text
  return `…${text.slice(-max)}`
}

export function clipInline(text: string, max = 1200) {
  const trimmed = text.replace(/\s+/g, " ").trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}…`
}

export function truncateText(text: string, max: number) {
  if (text.length <= max) return text
  return `${text.slice(0, max)}…`
}
