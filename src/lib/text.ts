/** "walmart" -> "Walmart", "club premier" -> "Club Premier" */
export function capitalizeStoreName(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase() + word.slice(1).toLocaleLowerCase())
    .join(' ')
}
