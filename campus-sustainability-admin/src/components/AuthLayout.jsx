import Logo from './Logo'
import CampusIllustration from './CampusIllustration'

export default function AuthLayout({ eyebrow, title, subtitle, children }) {
  return (
    <div className="auth-shell">
      <aside className="auth-panel"><CampusIllustration /></aside>
      <main className="auth-main"><div className="auth-card"><div className="auth-card__brand"><Logo size={72} /><div><p className="auth-card__org">Campus Sustainability</p><p className="auth-card__org-sub">Admin & Maintenance Staff Portal</p></div></div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p className="auth-subtitle">{subtitle}</p>{children}</div></main>
    </div>
  )
}
