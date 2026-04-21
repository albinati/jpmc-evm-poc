import { useCallback, useEffect, useState } from 'react'
import './App.css'

type Config = {
  chainId: number
  rpcUrl: string
  facilityContract: string
  treasuryContract: string
  workflowSignerConfigured: boolean
}

type Facility = {
  facilityId: number
  borrower: string | null
  state: string
  lockedCashWei: string
  titleTokenId: string
  tradeFinanceRefId: string
  stateCode: string
}

const api = (path: string, init?: RequestInit) => fetch(path, init)

/** On-chain enum order — matches CollateralizedFacility.FacilityState */
const STATE_ORDER: Record<string, number> = {
  Draft: 0,
  Active: 1,
  ComplianceHold: 2,
  Liquidation: 3,
  Closed: 4,
}

const STATE_LABELS = ['Draft', 'Active', 'ComplianceHold', 'Liquidation', 'Closed'] as const

export default function App() {
  const [config, setConfig] = useState<Config | null>(null)
  const [supply, setSupply] = useState<string>('')
  const [facilityId, setFacilityId] = useState('1')
  const [facility, setFacility] = useState<Facility | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [err, setErr] = useState<string | null>(null)

  const pushLog = useCallback((line: string) => {
    setLog((prev) => [`${new Date().toISOString()} ${line}`, ...prev].slice(0, 40))
  }, [])

  const loadConfig = useCallback(async () => {
    setErr(null)
    const r = await api('/api/config')
    if (!r.ok) throw new Error(await r.text())
    setConfig(await r.json())
  }, [])

  const loadSupply = useCallback(async () => {
    const r = await api('/api/treasury/total-supply')
    if (!r.ok) throw new Error(await r.text())
    setSupply(await r.text())
  }, [])

  const loadFacility = useCallback(async () => {
    setErr(null)
    const id = facilityId.trim() || '1'
    const r = await api(`/api/facilities/${id}`)
    if (!r.ok) throw new Error(await r.text())
    setFacility(await r.json())
  }, [facilityId])

  useEffect(() => {
    loadConfig().catch((e) => setErr(String(e)))
    loadSupply().catch(() => setSupply('(unavailable)'))
  }, [loadConfig, loadSupply])

  const workflowState = facility?.state
  const stateIdx = workflowState != null ? (STATE_ORDER[workflowState] ?? -1) : -1
  const canApplyHold = workflowState === 'Active'
  const canReleaseHold = workflowState === 'ComplianceHold'
  const canCommenceLiquidation =
    workflowState === 'Active' || workflowState === 'ComplianceHold'
  const canFinalizeLiquidation = workflowState === 'Liquidation'
  const workflowNeedsLoad = facility === null

  async function post(path: string, body?: object) {
    setErr(null)
    const r = await api(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-Id': crypto.randomUUID(),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await r.text()
    if (!r.ok) {
      let detail = text
      try {
        const j = JSON.parse(text) as { error?: string; message?: string }
        detail = j.error ?? j.message ?? text
      } catch {
        /* plain text body */
      }
      setErr(detail)
      pushLog(`ERROR ${r.status} ${detail}`)
      return
    }
    pushLog(`${path} -> ${text}`)
    await loadFacility().catch(() => {})
  }

  return (
    <div className="page">
      <header className="header">
        <h1>Kinexys-style orchestration (POC)</h1>
        <p className="sub">
          Hands-on tour of a <strong>permissioned</strong> collateral facility: cash + RWA-style title locked on-chain,
          <strong> compliance holds</strong>, and <strong>segregated liquidation</strong>. Educational demo only; not a
          JPMC product.
        </p>
      </header>

      {err && <div className="banner error">{err}</div>}

      <section className="panel panel--start">
        <h2>0 · Start here: chain, deploy, API, then this page</h2>
        <p className="panel-lead">
          There is <strong>no wallet connect</strong> in this UI and you do <strong>not</strong> “sign the contract” in a
          browser. Contracts are <strong>deployed</strong> to your local node with Hardhat; workflow <strong>transactions</strong>{' '}
          are <strong>signed by the Spring Boot service</strong> using <code className="inline-code">POC_SIGNER_PRIVATE_KEY</code>{' '}
          (see <code className="inline-code">.env.example</code>). Your job here is to bring up the stack,{' '}
          <strong>verify</strong> addresses and signer in section 1, then use section 2 to drive the state machine.
        </p>

        <div className="contracts-e2e">
          <h3 className="contracts-e2e__title">End-to-end on the contracts alone (CI-style)</h3>
          <p className="contracts-e2e__body">
            From the <strong>repo root</strong>, <code className="inline-code">npm run verify</code> compiles and runs all
            tests, including one that <strong>deploys</strong> like the demo script, <strong>seeds</strong> facility{' '}
            <strong>#1</strong>, and walks a full <strong>signed</strong> workflow (hold → release → liquidation →
            finalize) inside Hardhat — no UI, no Spring Boot.             To also write <code className="inline-code">deployments/local.json</code> against a <strong>real</strong> local
            node, use Git Bash or WSL:{' '}
            <code className="inline-code">npm run e2e:local-chain</code> (starts Hardhat RPC in the background, deploys,
            then keep that node up for the API).
          </p>
        </div>

        <ol className="start-checklist">
          <li>
            <strong>Local chain.</strong> From the repo root, install deps and keep a node running:
            <pre className="cmd">npm ci{'\n'}npx hardhat node</pre>
          </li>
          <li>
            <strong>Deploy + seed.</strong> In a second terminal (same repo root), deploy and write{' '}
            <code className="inline-code">deployments/local.json</code> (includes seeded facility <strong>#1</strong> in{' '}
            <strong>Active</strong>):
            <pre className="cmd">npx hardhat run scripts/deploy.js --network localhost</pre>
            If you skip this, the API has no addresses (or an old facility) and reads/POSTs will fail.
          </li>
          <li>
            <strong>Orchestration API.</strong> From <code className="inline-code">backend/</code>, run Spring Boot so the
            default <code className="inline-code">POC_DEPLOYMENTS_FILE=../deployments/local.json</code> resolves:
            <pre className="cmd">
              {`cd backend
export POC_RPC_URL=http://127.0.0.1:8545
export POC_CHAIN_ID=31337
export POC_DEPLOYMENTS_FILE=../deployments/local.json
export POC_SIGNER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
./mvnw spring-boot:run`}
            </pre>
            Use your shell’s syntax on Windows (PowerShell <code className="inline-code">$env:POC_RPC_URL=...</code>). The
            key above is Hardhat’s public test account #0 — POC only.
          </li>
          <li>
            <strong>This UI.</strong> From <code className="inline-code">frontend/</code>:
            <pre className="cmd">cd frontend{'\n'}npm ci{'\n'}npm run dev</pre>
            Open the URL Vite prints (usually <code className="inline-code">http://localhost:5173</code>). Vite proxies{' '}
            <code className="inline-code">/api</code> to the API on port <strong>8080</strong>.
          </li>
        </ol>

        <div className="verify-box">
          <h3 className="verify-box__title">Verify before using the workflow</h3>
          <ul className="verify-box__list">
            <li>
              Click <strong>Refresh config</strong> below. <strong>Workflow signer</strong> should read{' '}
              <strong>configured</strong>. If it says read-only, POSTs will not send transactions — set{' '}
              <code className="inline-code">POC_SIGNER_PRIVATE_KEY</code> and restart the API.
            </li>
            <li>
              <strong>Chain ID</strong> should match your node (Hardhat default <strong>31337</strong>).{' '}
              <strong>Facility</strong> should show a non-zero address from your latest deploy.
            </li>
            <li>
              In section 2, click <strong>Load on-chain state</strong> for facility <strong>1</strong>. You should see{' '}
              <strong>Active</strong> and non-zero locked cash (seeded by the deploy script).
            </li>
            <li>
              Then walk steps <strong>B–F</strong>: apply hold, release or escalate, commence liquidation, finalize to a
              recovery address. Watch the <strong>event log</strong> and your RPC explorer / Hardhat console for receipts.
            </li>
          </ul>
        </div>
      </section>

      <section className="panel">
        <h2>1 · Network and contracts</h2>
        <p className="panel-lead">
          After the stack is running (section 0), confirm chain id and contract addresses match your deploy. The API
          loads <code className="inline-code">deployments/local.json</code> and signs workflow POSTs with the configured
          key.
        </p>
        {config ? (
          <dl className="grid">
            <dt>Chain ID</dt>
            <dd>{config.chainId}</dd>
            <dt>RPC</dt>
            <dd className="mono">{config.rpcUrl}</dd>
            <dt>Facility</dt>
            <dd className="mono">{config.facilityContract}</dd>
            <dt>Treasury</dt>
            <dd className="mono">{config.treasuryContract}</dd>
            <dt>Workflow signer</dt>
            <dd>{config.workflowSignerConfigured ? 'configured' : 'read-only (set POC_SIGNER_PRIVATE_KEY)'}</dd>
            <dt>Treasury total supply (wei)</dt>
            <dd className="mono">{supply || '—'}</dd>
          </dl>
        ) : (
          <p>Loading config…</p>
        )}
        <button type="button" onClick={() => loadConfig().catch((e) => setErr(String(e)))}>
          Refresh config
        </button>
      </section>

      <section className="panel panel--flow">
        <h2>2 · Collateral facility lifecycle (step by step)</h2>
        <p className="panel-lead">
          The contract enforces a strict state machine. Each transition is <strong>role-gated</strong> (compliance vs
          liquidation agent). Off-chain detection and case work are not modeled here; this UI only shows how policy
          outcomes become <strong>tamper-evident on-chain state</strong>.
        </p>

        <div className="state-rail" aria-label="Facility state progression">
          {STATE_LABELS.map((label) => {
            const idx = STATE_ORDER[label]
            const isCurrent = workflowState === label
            const isPast = stateIdx >= 0 && idx < stateIdx
            return (
              <div
                key={label}
                className={`state-rail__node${isCurrent ? ' state-rail__node--current' : ''}${isPast ? ' state-rail__node--past' : ''}`}
              >
                <span className="state-rail__name">{label}</span>
              </div>
            )
          })}
        </div>
        <p className="rail-caption">
          <strong>Draft</strong> → borrower funds and posts title → <strong>Active</strong>. From Active you can hold,
          release, or escalate. <strong>Liquidation</strong> ends with assets sent to a <strong>recovery</strong> address,
          then <strong>Closed</strong>.
        </p>

        <div className="row">
          <label>
            Facility ID{' '}
            <input value={facilityId} onChange={(e) => setFacilityId(e.target.value)} className="inp" />
          </label>
          <button type="button" onClick={() => loadFacility().catch((e) => setErr(String(e)))}>
            Load on-chain state
          </button>
        </div>

        {facility && (
          <>
            <div className="state-banner">
              <span className="state-banner__label">Current on-chain state</span>
              <span className="state-banner__value">
                {facility.state} <span className="state-banner__code">(enum {facility.stateCode})</span>
              </span>
            </div>
            <dl className="grid grid--snapshot">
              <dt>Borrower</dt>
              <dd className="mono">{facility.borrower}</dd>
              <dt>Locked cash (wei)</dt>
              <dd className="mono">{facility.lockedCashWei}</dd>
              <dt>Title token id</dt>
              <dd className="mono">{facility.titleTokenId}</dd>
              <dt>Trade finance ref</dt>
              <dd className="mono">{facility.tradeFinanceRefId}</dd>
            </dl>
          </>
        )}

        {!facility && (
          <p className="hint hint--callout">
            <strong>Next:</strong> choose a facility id (demo seed uses <code>1</code>) and click{' '}
            <strong>Load on-chain state</strong> so the steps below know which buttons are valid.
          </p>
        )}

        <ol className="walkthrough">
          <li className="walkthrough__step">
            <h3 className="walkthrough__title">Step A — Operating: collateral encumbered (Active)</h3>
            <p className="walkthrough__body">
              Cash (treasury ERC-20 analog) and optionally an RWA-style NFT sit in the facility contract. The borrower
              cannot unilaterally pull collateral while the facility remains non-terminal. In this POC, deploy seeds
              facility <strong>#1</strong> already in <strong>Active</strong>.
            </p>
            <p className="walkthrough__role">
              <span className="role-tag">Roles</span> Banker / servicing paths exist on-chain; this dashboard focuses on
              compliance and liquidation.
            </p>
          </li>

          <li className={`walkthrough__step${workflowState === 'Active' ? ' walkthrough__step--here' : ''}`}>
            <h3 className="walkthrough__title">Step B — Administrative hold (compliance)</h3>
            <p className="walkthrough__body">
              Compliance moves the facility from <strong>Active</strong> to <strong>ComplianceHold</strong>. Collateral
              stays locked in the contract; the point is to freeze progression while an alert is reviewed (mirrors an
              investigation window, not a payout).
            </p>
            <p className="walkthrough__role">
              <span className="role-tag role-tag--compliance">COMPLIANCE_ROLE</span> calls{' '}
              <code className="inline-code">applyComplianceHold</code>.
            </p>
            <div className="walkthrough__action">
              <button
                type="button"
                className="btn-primary"
                disabled={workflowNeedsLoad || !canApplyHold}
                title={
                  workflowNeedsLoad
                    ? 'Load facility state first'
                    : canApplyHold
                      ? undefined
                      : 'Only available when state is Active'
                }
                onClick={() => post(`/api/facilities/${facilityId}/compliance-hold`)}
              >
                Apply compliance hold
              </button>
              {!workflowNeedsLoad && !canApplyHold && (
                <span className="action-hint">Requires Active — load state or return here after a release.</span>
              )}
            </div>
          </li>

          <li className={`walkthrough__step${workflowState === 'ComplianceHold' ? ' walkthrough__step--here' : ''}`}>
            <h3 className="walkthrough__title">Step C — Clear the hold (happy path)</h3>
            <p className="walkthrough__body">
              If the case clears, compliance returns the facility to <strong>Active</strong>. The borrower can continue
              normal servicing subject to other on-chain rules.
            </p>
            <p className="walkthrough__role">
              <span className="role-tag role-tag--compliance">COMPLIANCE_ROLE</span> calls{' '}
              <code className="inline-code">releaseComplianceHold</code>.
            </p>
            <div className="walkthrough__action">
              <button
                type="button"
                className="btn-primary"
                disabled={workflowNeedsLoad || !canReleaseHold}
                title={
                  workflowNeedsLoad
                    ? 'Load facility state first'
                    : canReleaseHold
                      ? undefined
                      : 'Only available when state is ComplianceHold'
                }
                onClick={() => post(`/api/facilities/${facilityId}/compliance-release`)}
              >
                Release compliance hold
              </button>
              {!workflowNeedsLoad && !canReleaseHold && workflowState !== 'ComplianceHold' && (
                <span className="action-hint">Apply a hold first, or you are already past this branch.</span>
              )}
            </div>
          </li>

          <li className={`walkthrough__step${canCommenceLiquidation ? ' walkthrough__step--here' : ''}`}>
            <h3 className="walkthrough__title">Step D — Escalate to enforced unwind (liquidation path)</h3>
            <p className="walkthrough__body">
              From either <strong>Active</strong> or <strong>ComplianceHold</strong>, compliance can escalate the
              facility into <strong>Liquidation</strong>. Assets are still inside the contract; no payout happens until
              the next step. This is the handoff point for <strong>segregation of duties</strong>.
            </p>
            <p className="walkthrough__role">
              <span className="role-tag role-tag--compliance">COMPLIANCE_ROLE</span> calls{' '}
              <code className="inline-code">commenceLiquidation</code>.
            </p>
            <div className="walkthrough__action">
              <button
                type="button"
                className="btn-primary"
                disabled={workflowNeedsLoad || !canCommenceLiquidation}
                title={
                  workflowNeedsLoad
                    ? 'Load facility state first'
                    : canCommenceLiquidation
                      ? undefined
                      : 'Requires Active or ComplianceHold'
                }
                onClick={() => post(`/api/facilities/${facilityId}/liquidation/commence`)}
              >
                Commence liquidation
              </button>
              {!workflowNeedsLoad && !canCommenceLiquidation && (
                <span className="action-hint">Not available from Liquidation or Closed.</span>
              )}
            </div>
          </li>

          <li className={`walkthrough__step${workflowState === 'Liquidation' ? ' walkthrough__step--here' : ''}`}>
            <h3 className="walkthrough__title">Step E — Payout to recovery (liquidation agent)</h3>
            <p className="walkthrough__body">
              A <strong>different</strong> role sends all escrowed cash and the title NFT (if any) to a{' '}
              <strong>recovery</strong> address you specify. The facility moves to <strong>Closed</strong>. This
              separation is deliberate: compliance escalates; the liquidation agent executes the final transfer.
            </p>
            <p className="walkthrough__role">
              <span className="role-tag role-tag--liquidation">LIQUIDATION_AGENT_ROLE</span> calls{' '}
              <code className="inline-code">finalizeLiquidation(recovery)</code>.
            </p>
            <div className="walkthrough__action">
              <button
                type="button"
                className="btn-primary"
                disabled={workflowNeedsLoad || !canFinalizeLiquidation}
                title={
                  workflowNeedsLoad
                    ? 'Load facility state first'
                    : canFinalizeLiquidation
                      ? undefined
                      : 'Only available in Liquidation state'
                }
                onClick={() => {
                  const recovery = window.prompt(
                    'Recovery address (0x…) — receives cash + NFT',
                    '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
                  )
                  if (recovery) void post(`/api/facilities/${facilityId}/liquidation/finalize`, { recoveryAddress: recovery })
                }}
              >
                Finalize liquidation (choose recovery)
              </button>
            </div>
          </li>

          <li className={`walkthrough__step${workflowState === 'Closed' ? ' walkthrough__step--here walkthrough__step--done' : ''}`}>
            <h3 className="walkthrough__title">Step F — Terminal: Closed</h3>
            <p className="walkthrough__body">
              No further workflow transitions apply to this facility id. In a real program you would reconcile events
              (for example <code className="inline-code">LiquidationFinalized</code>) with case systems and custody logs.
            </p>
          </li>
        </ol>
      </section>

      <section className="panel">
        <h2>3 · Event log</h2>
        <p className="panel-lead">Recent API responses and errors (newest first). Use this to correlate with block explorer receipts.</p>
        <ul className="log">
          {log.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
