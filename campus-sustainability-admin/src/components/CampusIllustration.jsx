// A simple, original flat-style campus illustration in the blue palette —
// not copied from any source. Purely decorative, hidden from screen readers.
export default function CampusIllustration() {
  return (
    <svg viewBox="0 0 480 420" role="presentation" aria-hidden="true" className="campus-illustration">
      <circle cx="240" cy="210" r="200" fill="var(--gold-soft)" opacity="0.6" />

      {/* main building */}
      <rect x="150" y="150" width="150" height="180" fill="var(--forest)" />
      <polygon points="150,150 225,105 300,150" fill="var(--forest-deep)" />
      <rect x="180" y="190" width="24" height="34" fill="#ffffff" opacity="0.85" />
      <rect x="222" y="190" width="24" height="34" fill="#ffffff" opacity="0.85" />
      <rect x="264" y="190" width="24" height="34" fill="#ffffff" opacity="0.85" />
      <rect x="180" y="244" width="24" height="34" fill="#ffffff" opacity="0.85" />
      <rect x="222" y="244" width="24" height="34" fill="#ffffff" opacity="0.85" />
      <rect x="264" y="244" width="24" height="34" fill="#ffffff" opacity="0.85" />
      <rect x="210" y="298" width="60" height="32" fill="#ffffff" opacity="0.9" />

      {/* side buildings */}
      <rect x="70" y="220" width="60" height="110" fill="#8fa8d9" opacity="0.8" />
      <rect x="320" y="200" width="70" height="130" fill="#6f8ecb" opacity="0.8" />

      {/* ground */}
      <rect x="20" y="330" width="440" height="10" fill="var(--forest)" opacity="0.25" />

      {/* trees */}
      <circle cx="110" cy="300" r="16" fill="var(--forest)" opacity="0.4" />
      <rect x="106" y="312" width="8" height="18" fill="var(--forest)" opacity="0.4" />
      <circle cx="370" cy="290" r="18" fill="var(--forest)" opacity="0.4" />
      <rect x="365" y="304" width="8" height="20" fill="var(--forest)" opacity="0.4" />
    </svg>
  )
}
