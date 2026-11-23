import { num } from '../../game/engine'

export function Pagination({ label, page, size, total, onChange }: {
  label: string
  page: number
  size: number
  total: number
  onChange: (page: number) => void
}) {
  const pages = Math.ceil(total / size)
  if (pages <= 1) return null
  return <nav className="table-pagination" aria-label={label}>
    <span aria-live="polite">{num(page * size + 1)}–{num(Math.min((page + 1) * size, total))} de {num(total)}</span>
    <div className="row tight">
      <button className="btn sm" disabled={page === 0} onClick={() => onChange(page - 1)}>Anterior</button>
      <button className="btn sm" disabled={page + 1 >= pages} onClick={() => onChange(page + 1)}>Próxima</button>
    </div>
  </nav>
}

export const lastPage = (total: number, size: number) => Math.max(0, Math.ceil(total / size) - 1)
