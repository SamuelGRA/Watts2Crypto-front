import { useMemo, useState } from 'react'
import { ExternalLink, ShieldCheck } from 'lucide-react'
import '../styles/guide-page.css'
import '../styles/hardware-page.css'

type GuideTab = 'about' | 'faq'

type FaqItem = {
  question: string
  answer: string
}

const apiAttributions = [
  {
    name: 'CoinCap',
    description: 'Metadatos y precios de criptomonedas.',
    url: 'https://coincap.io/',
  },
  {
    name: 'Energy-Charts',
    description: 'Referencia para precios de electricidad.',
    url: 'https://energy-charts.info/',
  },
  {
    name: 'WhatToMine',
    description: 'Datos de GPU y ASIC, y métricas relativas al minado de las distintas criptomonedas.',
    url: 'https://whattomine.com/',
  },
  {
    name: 'Hashrate.no',
    description: 'Fuente de datos de CPU, software y pools.',
    url: 'https://www.hashrate.no/',
  },
  {
    name: 'Frankfurter',
    description: 'Tipos de cambio y divisas tradicionales.',
    url: 'https://www.frankfurter.app/',
  },
]

const faqItems: FaqItem[] = [
  {
    question: '¿Necesito registrar una cuenta para usar la app?',
    answer:
      'No. Watts2Crypto está pensada como una herramienta local de consulta y cálculo, sin registro ni inicio de sesión.',
  },
  {
    question: '¿Por qué algunos datos pueden variar con el tiempo?',
    answer:
      'Los precios de criptomonedas, electricidad y tipos de cambio cambian con frecuencia. La guía muestra datos de referencia, no valores garantizados.',
  },
  {
    question: '¿Qué hago si no encuentro mi hardware o software?',
    answer:
      'Puedes usar el cálculo manual y completar hashrate, consumo y comisiones a mano. De esa manera no dependes de que el modelo de tu hardware exista en la base de datos.',
  },
  {
    question: '¿La rentabilidad calculada es exacta?',
    answer:
      'No. Es una estimación orientativa basada en los datos disponibles y en las condiciones que introduces. Conviene revisarla y contrastar la información con otras fuentes antes de tomar decisiones reales.',
  },
  {
    question: '¿Puedo usar la app mientras los datos se están actualizando?',
    answer:
      'Cuando actualizamos la base de datos, la interfaz muestra un aviso global y bloquea las pantallas para evitar resultados incompletos. Sin embargo, esto se hace en horarios en los que se espera poca concurrencia de usuarios.',
  },
  {
    question: 'A veces los datos de la app tardan mucho en cargar',
    answer:
      'El servicio en el que está alojada la aplicación la deja en un estado de suspensión si no hay actividad durante cierta cantidad de tiempo, se estima que la aplicación tarda alrededor de un minuto en volver a responder cuando esto ocurre. La alternativa que podemos ofrecer es usar la app por otra vía como, por ejemplo, Docker.'
  }
]

const aboutHighlights = [
  'Diseñado para comparar hardware, software, pools, monedas y coste eléctrico desde una única interfaz.',
  'Los cálculos se apoyan en datos de fuentes externas integradas para ofrecer una visión rápida de la rentabilidad.',
]

export function GuidePage() {
  const [activeTab, setActiveTab] = useState<GuideTab>('about')

  const tabContent = useMemo(() => {
    if (activeTab === 'about') {
      return (
        <div className="guide-grid guide-grid--about">
          <section className="card guide-panel guide-panel--featured guide-panel--intro">
            <p className="guide-kicker">Sobre la app</p>
            <h2>Qué es Watts2Crypto</h2>
            <p className="guide-lead">
              Watts2Crypto es una app pensada para estimar la rentabilidad de la minería de criptomonedas
              en función de las condiciones indicadas por los usuarios.
            </p>

            <div className="guide-highlight-list">
              {aboutHighlights.map((item) => (
                <div key={item} className="guide-highlight">
                  <ShieldCheck size={16} aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card guide-panel guide-panel--flow">
            <p className="guide-kicker">Cómo se usa</p>
            <h3>Flujo recomendado</h3>
            <ol className="guide-steps">
              <li>En la pantalla de cálculo, elige la moneda, el hardware y el software que quieres analizar.</li>
              <li>Indica el coste de electricidad y las comisiones si quieres afinar el resultado.</li>
              <li>Revisa el beneficio diario, mensual y anual antes de comparar escenarios.</li>
            </ol>
          </section>

          <section className="card guide-panel guide-panel--sources">
            <p className="guide-kicker">Atribuciones</p>
            <h3>Fuentes y servicios utilizados</h3>
            <div className="guide-source-list">
              {apiAttributions.map((item) => (
                <a key={item.name} className="guide-source" href={item.url} target="_blank" rel="noreferrer">
                  <div>
                    <strong>{item.name}</strong>
                    <p>{item.description}</p>
                  </div>
                  <ExternalLink size={15} aria-hidden="true" />
                </a>
              ))}
            </div>
          </section>
        </div>
      )
    }

    return (
      <div className="guide-grid guide-grid--faq">
        <section className="card guide-panel guide-panel--featured">
          <p className="guide-kicker">FAQ</p>
          <h2>Preguntas frecuentes</h2>
          <p className="guide-lead">
            Respuestas cortas a las dudas más habituales sobre el uso de la app, los datos y su alcance.
          </p>
        </section>

        <section className="card guide-panel">
          <div className="guide-faq-list">
            {faqItems.map((item) => (
              <article key={item.question} className="guide-faq-item">
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="card guide-panel">
          <p className="guide-kicker">Nota importante</p>
          <h3>Aclaración sobre los resultados de los cálculos</h3>
          <p>
            Los costes, beneficios y rendimientos son orientativos. Si cambian los precios del mercado o las
            condiciones de red de la moneda a minar; lo cual ocurre a menudo, el resultado del cálculo 
            también cambiará.
          </p>
        </section>

      </div>
    )
  }, [activeTab])

  return (
    <section className="card guide-page">
      <header className="guide-page__header">
        <div>
          <h2>Todo lo necesario para entender la app de un vistazo</h2>
          <p>
            Esta sección resume qué hace Watts2Crypto, cómo interpretar los cálculos y qué fuentes
            externas intervienen en los datos mostrados.
          </p>
        </div>

        <div className="hardware-tabs guide-page__tabs" role="tablist" aria-label="Secciones de la guía">
          <button
            type="button"
            className={`hardware-tab${activeTab === 'about' ? ' hardware-tab--active' : ''}`}
            role="tab"
            aria-selected={activeTab === 'about'}
            onClick={() => setActiveTab('about')}
          >
            Sobre la app
          </button>
          <button
            type="button"
            className={`hardware-tab${activeTab === 'faq' ? ' hardware-tab--active' : ''}`}
            role="tab"
            aria-selected={activeTab === 'faq'}
            onClick={() => setActiveTab('faq')}
          >
            FAQ
          </button>
        </div>
      </header>

      {tabContent}
    </section>
  )
}
