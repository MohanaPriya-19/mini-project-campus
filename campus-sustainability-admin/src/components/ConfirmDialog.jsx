import { useState } from 'react'

export default function ConfirmDialog({ title, message, confirmLabel, requireReason, onConfirm, onCancel }) {
  const [reason, setReason] = useState('')

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-card">
        <h3>{title}</h3>
        <p>{message}</p>

        {requireReason && (
          <label className="field">
            <span>Reason</span>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Duplicate report, already resolved, insufficient detail…"
            />
          </label>
        )}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn-danger"
            onClick={() => onConfirm(reason)}
            disabled={requireReason && reason.trim().length === 0}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
