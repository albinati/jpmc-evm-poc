import type { TxReceipt } from '../types'

type Props = { history: TxReceipt[] }

export function EventLogPanel({ history }: Props) {
  return (
    <section className="panel">
      <h2>Session event log</h2>
      <p className="panel-lead">
        Every successful POST is appended here with its decoded event log. Correlate with the
        receipt panel inside each tab — newest at the top.
      </p>
      <ul className="log">
        {history.length === 0 && <li>(no transactions yet)</li>}
        {history.map((r) => (
          <li key={r.transactionHash}>
            <code className="mono">{r.transactionHash.slice(0, 12)}…</code> · block{' '}
            {String(r.blockNumber)} · gas {String(r.gasUsed)} ·{' '}
            {r.events.map((e, i) => (
              <span key={i} className="role-tag">
                {e.name}
              </span>
            ))}
          </li>
        ))}
      </ul>
    </section>
  )
}
