import { useCallback, useState } from 'react'
import { apiGet, postAction } from '../api'
import type { Facility, TxReceipt } from '../types'
import { TxReceiptView } from '../components/TxReceiptView'

type Props = {
  onError: (msg: string) => void
  onReceipt: (r: TxReceipt) => void
}

const STATE_ORDER: Record<string, number> = {
  Draft: 0,
  Active: 1,
  ComplianceHold: 2,
  Liquidation: 3,
  Closed: 4,
}

const STATE_LABELS = ['Draft', 'Active', 'ComplianceHold', 'Liquidation', 'Closed'] as const

export function FacilityPanel({ onError, onReceipt }: Props) {
  const [facilityId, setFacilityId] = useState('1')
  const [facility, setFacility] = useState<Facility | null>(null)
  const [last, setLast] = useState<TxReceipt | null>(null)
  const [topUp, setTopUp] = useState('1000000000000000000')

  const load = useCallback(async () => {
    try {
      setFacility(await apiGet<Facility>(`/api/facilities/${facilityId.trim() || '1'}`))
    } catch (e) {
      onError(String((e as Error).message ?? e))
    }
  }, [facilityId, onError])

  const post = async (path: string, body?: object) => {
    try {
      const r = await postAction(path, body)
      setLast(r)
      onReceipt(r)
      await load()
    } catch (e) {
      onError(String((e as Error).message ?? e))
    }
  }

  const state = facility?.state
  const stateIdx = state != null ? (STATE_ORDER[state] ?? -1) : -1
  const canHold = state === 'Active'
  const canRelease = state === 'ComplianceHold'
  const canCommence = state === 'Active' || state === 'ComplianceHold'
  const canFinalize = state === 'Liquidation'
  const canTopUp = state === 'Active'
  const needsLoad = facility === null

  return (
    <section className="panel panel--flow">
      <h2>Collateralized Facility · the role-gated state machine</h2>
      <p className="panel-lead">
        Borrower posts cash + RWA-style title; transitions are role-gated across banker /
        compliance / liquidation agent. Watch the state rail update after each action.
      </p>

      <div className="state-rail" aria-label="Facility state progression">
        {STATE_LABELS.map((label) => {
          const idx = STATE_ORDER[label]
          const isCurrent = state === label
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

      <div className="row">
        <label>
          Facility ID{' '}
          <input
            className="inp"
            value={facilityId}
            onChange={(e) => setFacilityId(e.target.value)}
          />
        </label>
        <button type="button" onClick={() => void load()}>
          Load on-chain state
        </button>
      </div>

      {facility && (
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
      )}

      <ol className="walkthrough">
        <li className={`walkthrough__step${state === 'Active' ? ' walkthrough__step--here' : ''}`}>
          <h3 className="walkthrough__title">A — Top up cash (amend)</h3>
          <p className="walkthrough__body">
            Borrower adds more cash collateral to an Active facility. Demonstrates the{' '}
            <strong>amend an existing instrument</strong> path.
          </p>
          <div className="row">
            <input
              className="inp"
              placeholder="amount (wei)"
              value={topUp}
              onChange={(e) => setTopUp(e.target.value)}
            />
            <button
              type="button"
              className="btn-primary"
              disabled={needsLoad || !canTopUp}
              onClick={() => void post(`/api/facilities/${facilityId}/topup`, { amount: topUp })}
            >
              Top up
            </button>
          </div>
        </li>

        <li className={`walkthrough__step${canHold ? ' walkthrough__step--here' : ''}`}>
          <h3 className="walkthrough__title">B — Apply compliance hold</h3>
          <p className="walkthrough__role">
            <span className="role-tag role-tag--compliance">COMPLIANCE_ROLE</span>
          </p>
          <button
            type="button"
            className="btn-primary"
            disabled={needsLoad || !canHold}
            onClick={() => void post(`/api/facilities/${facilityId}/compliance-hold`)}
          >
            Apply hold
          </button>
        </li>

        <li className={`walkthrough__step${canRelease ? ' walkthrough__step--here' : ''}`}>
          <h3 className="walkthrough__title">C — Release the hold (happy path)</h3>
          <button
            type="button"
            className="btn-primary"
            disabled={needsLoad || !canRelease}
            onClick={() => void post(`/api/facilities/${facilityId}/compliance-release`)}
          >
            Release hold
          </button>
        </li>

        <li className={`walkthrough__step${canCommence ? ' walkthrough__step--here' : ''}`}>
          <h3 className="walkthrough__title">D — Escalate to liquidation</h3>
          <button
            type="button"
            className="btn-primary"
            disabled={needsLoad || !canCommence}
            onClick={() => void post(`/api/facilities/${facilityId}/liquidation/commence`)}
          >
            Commence liquidation
          </button>
        </li>

        <li className={`walkthrough__step${canFinalize ? ' walkthrough__step--here' : ''}`}>
          <h3 className="walkthrough__title">E — Finalize liquidation (separate signer)</h3>
          <p className="walkthrough__role">
            <span className="role-tag role-tag--liquidation">LIQUIDATION_AGENT_ROLE</span>
          </p>
          <button
            type="button"
            className="btn-primary"
            disabled={needsLoad || !canFinalize}
            onClick={() => {
              const recovery = window.prompt('Recovery address (0x…) — receives cash + NFT', '0x70997970C51812dc3A010C7d01b50e0d17dc79C8')
              if (recovery)
                void post(`/api/facilities/${facilityId}/liquidation/finalize`, {
                  recoveryAddress: recovery,
                })
            }}
          >
            Finalize liquidation
          </button>
        </li>
      </ol>

      <TxReceiptView receipt={last} />
    </section>
  )
}
