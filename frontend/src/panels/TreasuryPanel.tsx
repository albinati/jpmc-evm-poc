import { useCallback, useEffect, useState } from 'react'
import { apiGet, postAction } from '../api'
import type { ApiConfig, TreasuryHolder, TreasuryStatus, TxReceipt } from '../types'
import { TxReceiptView } from '../components/TxReceiptView'

type Props = {
  config: ApiConfig | null
  onError: (msg: string) => void
  onReceipt: (r: TxReceipt) => void
}

export function TreasuryPanel({ config, onError, onReceipt }: Props) {
  const [status, setStatus] = useState<TreasuryStatus | null>(null)
  const [holderAddr, setHolderAddr] = useState('')
  const [holder, setHolder] = useState<TreasuryHolder | null>(null)
  const [mintTo, setMintTo] = useState('')
  const [mintAmount, setMintAmount] = useState('1000000000000000000000')
  const [forceFrom, setForceFrom] = useState('')
  const [forceTo, setForceTo] = useState('')
  const [forceAmount, setForceAmount] = useState('1000000000000000000')
  const [forceReason, setForceReason] = useState('AML-2025-001')
  const [freezeAddr, setFreezeAddr] = useState('')
  const [freezeSeconds, setFreezeSeconds] = useState('86400')
  const [last, setLast] = useState<TxReceipt | null>(null)

  useEffect(() => {
    if (config?.complianceAddress) setForceTo(config.complianceAddress)
    if (config?.liquidationAgentAddress) {
      setMintTo((m) => m || config.liquidationAgentAddress!)
      setForceFrom((f) => f || config.liquidationAgentAddress!)
      setHolderAddr((a) => a || config.liquidationAgentAddress!)
      setFreezeAddr((a) => a || config.liquidationAgentAddress!)
    }
  }, [config])

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await apiGet<TreasuryStatus>('/api/treasury/status'))
    } catch (e) {
      onError(String((e as Error).message ?? e))
    }
  }, [onError])

  const loadHolder = useCallback(async () => {
    if (!holderAddr.trim()) return
    try {
      setHolder(await apiGet<TreasuryHolder>(`/api/treasury/holders/${holderAddr.trim()}`))
    } catch (e) {
      onError(String((e as Error).message ?? e))
    }
  }, [holderAddr, onError])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const post = async (path: string, body?: object) => {
    try {
      const r = await postAction(path, body)
      setLast(r)
      onReceipt(r)
      await loadStatus()
      if (holderAddr.trim()) await loadHolder()
    } catch (e) {
      onError(String((e as Error).message ?? e))
    }
  }

  return (
    <section className="panel panel--flow">
      <h2>Corporate Treasury · ERC-20 with compliance controls</h2>
      <p className="panel-lead">
        JPMD-analog deposit token. The compliance role can blacklist, freeze, pause, and seize.
        Watch the receipt panel: every action emits ERC-20 <code>Transfer</code> /{' '}
        <code>Paused</code> events alongside the contract's custom compliance events.
      </p>

      {status && (
        <dl className="grid grid--snapshot">
          <dt>Token</dt>
          <dd>
            {status.name} ({status.symbol})
          </dd>
          <dt>Decimals</dt>
          <dd>{status.decimals}</dd>
          <dt>Paused</dt>
          <dd>{status.paused ? 'yes' : 'no'}</dd>
          <dt>Total supply (wei)</dt>
          <dd className="mono">{status.totalSupply}</dd>
        </dl>
      )}

      <ol className="walkthrough">
        <li className="walkthrough__step">
          <h3 className="walkthrough__title">A — Inspect a holder</h3>
          <p className="walkthrough__body">
            Look up balance, blacklist status, and freeze deadline for any address.
          </p>
          <div className="row">
            <input
              className="inp inp--wide"
              placeholder="0x..."
              value={holderAddr}
              onChange={(e) => setHolderAddr(e.target.value)}
            />
            <button type="button" onClick={() => void loadHolder()}>
              Load holder
            </button>
          </div>
          {holder && (
            <dl className="grid grid--snapshot">
              <dt>Balance</dt>
              <dd className="mono">{holder.balance}</dd>
              <dt>Blacklisted</dt>
              <dd>{holder.blacklisted ? 'yes' : 'no'}</dd>
              <dt>Frozen until (epoch)</dt>
              <dd className="mono">{holder.frozenUntil}</dd>
            </dl>
          )}
        </li>

        <li className="walkthrough__step">
          <h3 className="walkthrough__title">B — Mint tokens (banker)</h3>
          <p className="walkthrough__role">
            <span className="role-tag">TREASURY_OPERATOR_ROLE</span> (banker key)
          </p>
          <div className="row">
            <input
              className="inp inp--wide"
              placeholder="recipient 0x..."
              value={mintTo}
              onChange={(e) => setMintTo(e.target.value)}
            />
            <input
              className="inp"
              placeholder="amount (wei)"
              value={mintAmount}
              onChange={(e) => setMintAmount(e.target.value)}
            />
            <button
              type="button"
              className="btn-primary"
              onClick={() => void post('/api/treasury/mint', { to: mintTo, amount: mintAmount })}
            >
              Mint
            </button>
          </div>
        </li>

        <li className="walkthrough__step">
          <h3 className="walkthrough__title">C — Freeze for a window (compliance)</h3>
          <p className="walkthrough__body">
            Temporary block — transfers from the address revert with{' '}
            <code className="inline-code">AccountFrozen</code> until the deadline elapses.
          </p>
          <p className="walkthrough__role">
            <span className="role-tag role-tag--compliance">COMPLIANCE_ROLE</span>
          </p>
          <div className="row">
            <input
              className="inp inp--wide"
              placeholder="address"
              value={freezeAddr}
              onChange={(e) => setFreezeAddr(e.target.value)}
            />
            <input
              className="inp"
              placeholder="duration (s)"
              value={freezeSeconds}
              onChange={(e) => setFreezeSeconds(e.target.value)}
            />
            <button
              type="button"
              className="btn-primary"
              onClick={() =>
                void post('/api/treasury/freeze', {
                  address: freezeAddr,
                  durationSeconds: freezeSeconds,
                })
              }
            >
              Freeze
            </button>
            <button
              type="button"
              onClick={() => void post(`/api/treasury/release/${encodeURIComponent(freezeAddr)}`)}
            >
              Release
            </button>
          </div>
        </li>

        <li className="walkthrough__step">
          <h3 className="walkthrough__title">D — Permanent block (blacklist)</h3>
          <p className="walkthrough__role">
            <span className="role-tag role-tag--compliance">COMPLIANCE_ROLE</span>
          </p>
          <div className="row">
            <button
              type="button"
              className="btn-primary"
              onClick={() => void post('/api/treasury/blacklist', { address: freezeAddr, on: true })}
            >
              Add to blacklist
            </button>
            <button
              type="button"
              onClick={() =>
                void post('/api/treasury/blacklist', { address: freezeAddr, on: false })
              }
            >
              Remove from blacklist
            </button>
          </div>
        </li>

        <li className="walkthrough__step">
          <h3 className="walkthrough__title">E — Compliance seizure (force transfer)</h3>
          <p className="walkthrough__body">
            Bypasses sender allowance and the blacklist/freeze guards on <em>from</em>. Still
            respects contract pause. Emits <code className="inline-code">ComplianceForceTransfer</code>.
          </p>
          <p className="walkthrough__role">
            <span className="role-tag role-tag--compliance">COMPLIANCE_ROLE</span>
          </p>
          <div className="row row--stack">
            <input
              className="inp inp--wide"
              placeholder="from"
              value={forceFrom}
              onChange={(e) => setForceFrom(e.target.value)}
            />
            <input
              className="inp inp--wide"
              placeholder="to (recovery)"
              value={forceTo}
              onChange={(e) => setForceTo(e.target.value)}
            />
            <input
              className="inp"
              placeholder="amount (wei)"
              value={forceAmount}
              onChange={(e) => setForceAmount(e.target.value)}
            />
            <input
              className="inp"
              placeholder="reason (text or bytes32)"
              value={forceReason}
              onChange={(e) => setForceReason(e.target.value)}
            />
            <button
              type="button"
              className="btn-primary"
              onClick={() =>
                void post('/api/treasury/force-transfer', {
                  from: forceFrom,
                  to: forceTo,
                  amount: forceAmount,
                  reason: forceReason,
                })
              }
            >
              Force-transfer
            </button>
          </div>
        </li>

        <li className="walkthrough__step">
          <h3 className="walkthrough__title">F — Whole-contract pause / unpause</h3>
          <p className="walkthrough__role">
            <span className="role-tag role-tag--compliance">COMPLIANCE_ROLE</span>
          </p>
          <div className="row">
            <button
              type="button"
              className="btn-primary"
              onClick={() => void post('/api/treasury/pause')}
            >
              Pause
            </button>
            <button type="button" onClick={() => void post('/api/treasury/unpause')}>
              Unpause
            </button>
          </div>
        </li>
      </ol>

      <TxReceiptView receipt={last} />
    </section>
  )
}
