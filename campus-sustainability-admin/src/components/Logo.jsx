import psgLogo from '../assets/psg-logo.jpg'

// PSG College of Technology's official logo (provided by the user).
// `onDark` wraps it in a white chip so the logo's white background
// doesn't look like a stray box when placed on the dark top bar.
export default function Logo({ size = 64, onDark = false }) {
  const img = (
    <img
      src={psgLogo}
      alt="PSG College of Technology"
      width={size}
      height={size}
      style={{ objectFit: 'contain', display: 'block', borderRadius: 4 }}
    />
  )

  if (!onDark) return img

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
        borderRadius: 6,
        padding: 3,
      }}
    >
      {img}
    </span>
  )
}
