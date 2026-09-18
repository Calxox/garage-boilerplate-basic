import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'HazardWatch',
  description:
    'HazardWatch interactive bushfire MVP prototype with fictional demonstration data.',
  icons: {
    icon: '/prototype/assets/mark.svg',
  },
}

export default function PrototypePage() {
  return (
    <>
      <link rel="stylesheet" href="/prototype/assets/leaflet/leaflet.css" />
      <link rel="stylesheet" href="/prototype/style.css" />

      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="app-shell">
        <aside className="sidebar">
          <a href="#overview" className="brand" aria-label="HazardWatch overview">
            <img src="/prototype/assets/mark.svg" alt="" width="34" height="34" />
            <span>
              HazardWatch
              <span className="brand-caption">FIELD INTELLIGENCE</span>
            </span>
          </a>
          <div className="workspace-label">OPERATIONS WORKSPACE</div>
          <nav aria-label="Main navigation" id="navigation" />
          <div className="sidebar-bottom">
            <div className="prototype-card">
              <span className="tiny-label">DESIGN PROTOTYPE / 01</span>
              <p>
                A shared picture.
                <br />A human decision.
              </p>
              <button className="tour-button" data-action="tour">
                Walk through the journey <span aria-hidden="true">↗</span>
              </button>
            </div>
            <div className="identity">
              <span className="avatar">IC</span>
              <div>
                <strong>Incident coordinator</strong>
                <small>Team 07 · Demo workspace</small>
              </div>
            </div>
          </div>
        </aside>

        <div className="workspace">
          <header className="topbar">
            <div className="breadcrumb">
              Workspace <span>/</span> <strong id="breadcrumb">Overview</strong>
            </div>
            <div className="topbar-right">
              <span className="demo-badge">
                <span />
                Prototype · Sample data
              </span>
              <button className="quiet-button topbar-tour" data-action="tour">
                Tour
              </button>
              <button className="quiet-button" data-action="reset">
                Reset demo
              </button>
            </div>
          </header>
          <main id="main" tabIndex={-1} />
          <footer className="page-footer">
            <span>Fictional incident data · 14 Sep 2026, 14:32 AEST</span>
            <span>Interactive design only · Not an operational service</span>
          </footer>
        </div>
      </div>

      <dialog id="upload-dialog" aria-labelledby="upload-title" />
      <dialog id="reset-dialog" aria-labelledby="reset-title">
        <div className="dialog-head">
          <div>
            <span className="eyebrow">DEMO WORKSPACE</span>
            <h2 id="reset-title">Start again?</h2>
          </div>
          <button className="icon-button" data-action="cancel-reset" aria-label="Close reset dialog">
            ×
          </button>
        </div>
        <p className="dialog-copy">
          This clears your session’s sample reports, review marks and conversation. The original
          demonstration data will be restored.
        </p>
        <div className="dialog-actions">
          <button className="button secondary" data-action="cancel-reset">
            Keep working
          </button>
          <button className="button primary" data-action="confirm-reset">
            Reset demo
          </button>
        </div>
      </dialog>
      <div id="tour" aria-live="polite" />
      <div id="toast" role="status" aria-live="polite" />
      <noscript>
        <p className="noscript">
          Enable JavaScript to explore this interactive prototype. No information is sent to a
          server.
        </p>
      </noscript>

      <script defer src="/prototype/model.js" />
      <script defer src="/prototype/assets/leaflet/leaflet.js" />
      <script defer src="/prototype/assets/geography.js" />
      <script defer src="/prototype/map.js" />
      <script defer src="/prototype/app.js" />
    </>
  )
}
