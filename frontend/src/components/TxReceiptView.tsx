import type { TxReceipt } from '../types'

type Props = { receipt: TxReceipt | null }

export function TxReceiptView({ receipt }: Props) {
  if (!receipt) return null
  const ok = receipt.status === 'success' || receipt.status === '0x1'
  return (
    <div className="receipt">
      <div className="receipt__head">
        <span className={`receipt__badge ${ok ? 'receipt__badge--ok' : 'receipt__badge--bad'}`}>
          {ok ? 'success' : receipt.status}
        </span>
        <code className="receipt__hash">{receipt.transactionHash}</code>
      </div>
      <dl className="grid grid--receipt">
        <dt>Block</dt>
        <dd className="mono">{String(receipt.blockNumber)}</dd>
        <dt>Gas used</dt>
        <dd className="mono">{String(receipt.gasUsed)}</dd>
        <dt>From</dt>
        <dd className="mono">{receipt.from}</dd>
        <dt>To</dt>
        <dd className="mono">{receipt.contractAddress}</dd>
      </dl>
      {receipt.events.length > 0 && (
        <div className="receipt__events">
          <h4 className="receipt__events-title">Decoded events ({receipt.events.length})</h4>
          <ul className="receipt__event-list">
            {receipt.events.map((ev, idx) => (
              <li key={idx} className="receipt__event">
                <span className="receipt__event-name">{ev.name}</span>
                <span className="receipt__event-contract">{ev.contract}</span>
                {Object.entries(ev.args).map(([k, v]) => (
                  <span key={k} className="receipt__event-arg">
                    <em>{k}</em>: <code>{v}</code>
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
