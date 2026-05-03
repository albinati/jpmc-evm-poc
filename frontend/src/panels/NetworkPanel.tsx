import type { ApiConfig } from '../types'

type Props = { config: ApiConfig | null; onRefresh: () => void; isPublicDemo: boolean }

function formatResetCountdown(epochSec: number | null): string {
  if (!epochSec) return ''
  const ms = epochSec * 1000 - Date.now()
  if (ms <= 0) return 'now'
  const m = Math.floor(ms / 60000)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  return `${m}m`
}

export function NetworkPanel({ config, onRefresh, isPublicDemo }: Props) {
  return (
    <section className="panel">
      <h2>Network and contracts</h2>
      <p className="panel-lead">
        The API loads <code className="inline-code">deployments/local.json</code> and signs
        workflow POSTs with the three demo keys. Verify each address matches the chain you just
        deployed to.
      </p>
      {config ? (
        <>
          <dl className="grid">
            <dt>Chain ID</dt>
            <dd>{config.chainId}</dd>
            <dt>RPC</dt>
            <dd className="mono">{config.rpcUrl}</dd>
            <dt>Treasury (ERC-20)</dt>
            <dd className="mono">{config.treasuryContract}</dd>
            <dt>Title (ERC-721)</dt>
            <dd className="mono">{config.titleContract}</dd>
            <dt>Trade finance (ERC-1155)</dt>
            <dd className="mono">{config.tradeContract}</dd>
            <dt>Facility</dt>
            <dd className="mono">{config.facilityContract}</dd>
            <dt>Workflow signers</dt>
            <dd>
              {config.workflowSignerConfigured
                ? 'all three configured'
                : 'incomplete (some signers missing)'}
            </dd>
          </dl>

          <div className="state-rail" aria-label="Demo signer roles">
            <div className="state-rail__node state-rail__node--current">
              <span className="role-tag">banker</span>
              <code className="mono">{config.bankerAddress ?? '—'}</code>
            </div>
            <div className="state-rail__node state-rail__node--current">
              <span className="role-tag role-tag--compliance">compliance</span>
              <code className="mono">{config.complianceAddress ?? '—'}</code>
            </div>
            <div className="state-rail__node state-rail__node--current">
              <span className="role-tag role-tag--liquidation">liquidation agent</span>
              <code className="mono">{config.liquidationAgentAddress ?? '—'}</code>
            </div>
          </div>

          {isPublicDemo && (
            <p className="hint hint--callout">
              You are on the <strong>public demo</strong>. The chain is reset every 6 hours so
              everyone gets a clean slate. {config.nextResetAt ? `Next reset in ${formatResetCountdown(config.nextResetAt)}.` : ''}
            </p>
          )}
        </>
      ) : (
        <p>Loading config…</p>
      )}
      <button type="button" onClick={onRefresh}>
        Refresh config
      </button>
    </section>
  )
}
