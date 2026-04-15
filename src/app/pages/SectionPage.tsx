import '../styles/section-page.css'

type SectionPageProps = {
  title: string
  description: string
}

export function SectionPage({ title, description }: SectionPageProps) {
  return (
    <section className="card section-page">
      <div>
        <p className="section-page__eyebrow">Vista en construccion</p>
        <h2>{title}</h2>
      </div>
      <p>{description}</p>
      <div className="section-page__hint">
        a.
      </div>
    </section>
  )
}