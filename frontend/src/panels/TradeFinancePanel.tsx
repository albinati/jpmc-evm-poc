import { useCallback, useEffect, useState } from 'react'
import { apiGet, postAction } from '../api'
import type { ApiConfig, Invoice, TxReceipt } from '../types'
import { TxReceiptView } from '../components/TxReceiptView'

type Props = {
  config: ApiConfig | null
  onError: (msg: string) => void
  onReceipt: (r: TxReceipt) => void
}

export function TradeFinancePanel({ config, onError, onReceipt }: Props) {
  const [invoiceId, setInvoiceId] = useState('1')
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [last, setLast] = useState<TxReceipt | null>(null)
  const [factorTo, setFactorTo] = useState('')
  const [factorAmount, setFactorAmount] = useState('40000000000000000000000')
  const [settleAmount, setSettleAmount] = useState('30000000000000000000000')
  const [extendDays, setExtendDays] = useState('14')
  const [createPayable, setCreatePayable] = useState('')
  const [createAmount, setCreateAmount] = useState('100000000000000000000000')
  const [createRef, setCreateRef] = useState(`INV-DEMO-${Date.now()}`)

  useEffect(() => {
    if (config?.complianceAddress) setFactorTo((t) => t || config.complianceAddress!)
    if (config?.liquidationAgentAddress) setCreatePayable((t) => t || config.liquidationAgentAddress!)
  }, [config])

  const load = useCallback(async () => {
    try {
      setInvoice(await apiGet<Invoice>(`/api/invoices/${invoiceId.trim() || '1'}`))
    } catch (e) {
      onError(String((e as Error).message ?? e))
    }
  }, [invoiceId, onError])

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

  return (
    <section className="panel panel--flow">
      <h2>Trade Finance · ERC-1155 invoices with factor / settle / extend</h2>
      <p className="panel-lead">
        Each invoice is a fungible position; banker creates them with an initial supply minted
        to the receivable party. <strong>Factor</strong> moves a slice to a third-party financier
        (liquidity). <strong>Settle</strong> burns the position. The amend path is{' '}
        <strong>extendDueDate</strong>: pushes maturity further out without reissuing the invoice.
      </p>

      <div className="row">
        <label>
          Invoice ID{' '}
          <input className="inp" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} />
        </label>
        <button type="button" onClick={() => void load()}>
          Load invoice
        </button>
      </div>

      {invoice && (
        <dl className="grid grid--snapshot">
          <dt>Reference</dt>
          <dd className="mono">{invoice.invoiceReference}</dd>
          <dt>Receivable</dt>
          <dd className="mono">{invoice.receivableParty}</dd>
          <dt>Payable</dt>
          <dd className="mono">{invoice.payableParty}</dd>
          <dt>Face amount (wei)</dt>
          <dd className="mono">{invoice.amount}</dd>
          <dt>Current supply</dt>
          <dd className="mono">{invoice.currentSupply}</dd>
          <dt>Due date (epoch)</dt>
          <dd className="mono">{invoice.dueDate}</dd>
          <dt>Settled</dt>
          <dd>{invoice.settled ? 'yes' : 'no'}</dd>
        </dl>
      )}

      <ol className="walkthrough">
        <li className="walkthrough__step">
          <h3 className="walkthrough__title">A — Create a new invoice (banker)</h3>
          <p className="walkthrough__role">
            <span className="role-tag">BANKER_ROLE</span>
          </p>
          <div className="row row--stack">
            <input
              className="inp inp--wide"
              placeholder="payable party"
              value={createPayable}
              onChange={(e) => setCreatePayable(e.target.value)}
            />
            <input
              className="inp"
              placeholder="amount (wei)"
              value={createAmount}
              onChange={(e) => setCreateAmount(e.target.value)}
            />
            <input
              className="inp inp--wide"
              placeholder="invoice ref"
              value={createRef}
              onChange={(e) => setCreateRef(e.target.value)}
            />
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                const due = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
                void post('/api/invoices', {
                  receivableParty: config?.bankerAddress ?? '',
                  payableParty: createPayable,
                  amount: createAmount,
                  dueDate: String(due),
                  invoiceRef: createRef,
                  initialSupply: createAmount,
                })
              }}
            >
              Create
            </button>
          </div>
        </li>

        <li className="walkthrough__step">
          <h3 className="walkthrough__title">B — Factor a slice (liquidity)</h3>
          <p className="walkthrough__body">
            Move part of the invoice tokens to a financier in exchange for early cash. Emits{' '}
            <code className="inline-code">InvoiceFactored</code> + ERC-1155{' '}
            <code className="inline-code">TransferSingle</code>.
          </p>
          <p className="walkthrough__role">
            <span className="role-tag">BANKER_ROLE</span>
          </p>
          <div className="row">
            <input
              className="inp inp--wide"
              placeholder="factor 0x..."
              value={factorTo}
              onChange={(e) => setFactorTo(e.target.value)}
            />
            <input
              className="inp"
              placeholder="amount"
              value={factorAmount}
              onChange={(e) => setFactorAmount(e.target.value)}
            />
            <button
              type="button"
              className="btn-primary"
              onClick={() =>
                void post(`/api/invoices/${invoiceId}/factor`, {
                  factor: factorTo,
                  amount: factorAmount,
                })
              }
            >
              Factor
            </button>
          </div>
        </li>

        <li className="walkthrough__step">
          <h3 className="walkthrough__title">C — Settle (full or partial)</h3>
          <p className="walkthrough__role">
            <span className="role-tag role-tag--liquidation">SETTLEMENT_AGENT_ROLE</span>{' '}
            (liquidation key)
          </p>
          <div className="row">
            <input
              className="inp"
              placeholder="amount"
              value={settleAmount}
              onChange={(e) => setSettleAmount(e.target.value)}
            />
            <button
              type="button"
              className="btn-primary"
              onClick={() => void post(`/api/invoices/${invoiceId}/settle`, { amount: settleAmount })}
            >
              Settle
            </button>
          </div>
        </li>

        <li className="walkthrough__step">
          <h3 className="walkthrough__title">D — Extend due date (amend, no reissue)</h3>
          <p className="walkthrough__body">
            Push maturity further into the future without reissuing the invoice. Reverts on
            past timestamps and on shrinking — try setting days to <strong>-1</strong> to see
            the failure path.
          </p>
          <div className="row">
            <input
              className="inp"
              placeholder="extra days"
              value={extendDays}
              onChange={(e) => setExtendDays(e.target.value)}
            />
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                const days = parseInt(extendDays, 10)
                const newDue = Math.floor(Date.now() / 1000) + (isNaN(days) ? 14 : days) * 24 * 60 * 60
                void post(`/api/invoices/${invoiceId}/extend`, { newDueDate: String(newDue) })
              }}
            >
              Extend
            </button>
          </div>
        </li>

        <li className="walkthrough__step">
          <h3 className="walkthrough__title">E — Pause / unpause the contract</h3>
          <p className="walkthrough__role">
            <span className="role-tag role-tag--compliance">COMPLIANCE_ROLE</span>
          </p>
          <div className="row">
            <button
              type="button"
              className="btn-primary"
              onClick={() => void post('/api/invoices/pause')}
            >
              Pause
            </button>
            <button type="button" onClick={() => void post('/api/invoices/unpause')}>
              Unpause
            </button>
          </div>
        </li>
      </ol>

      <TxReceiptView receipt={last} />
    </section>
  )
}
