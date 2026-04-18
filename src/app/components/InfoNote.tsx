import { TriangleAlert } from 'lucide-react'

type InfoNoteProps = {
  message: string
  title?: string
  ariaLabel?: string
  className?: string
}

export function InfoNote({ message, title = 'Nota', ariaLabel, className }: InfoNoteProps) {
  const classes = ['card', 'info-note', className].filter(Boolean).join(' ')

  return (
    <aside className={classes} aria-label={ariaLabel}>
      <h3>
        <TriangleAlert size={18} aria-hidden="true" />
        {title}
      </h3>
      <p>{message}</p>
    </aside>
  )
}
