import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { apiGet } from './api'
import type { ApiConfig, TxReceipt } from './types'
import { SetupPanel } from './panels/SetupPanel'
import { NetworkPanel } from './panels/NetworkPanel'
import { TreasuryPanel } from './panels/TreasuryPanel'
import { TitlePanel } from './panels/TitlePanel'
import { TradeFinancePanel } from './panels/TradeFinancePanel'
import { FacilityPanel } from './panels/FacilityPanel'
import { EventLogPanel } from './panels/EventLogPanel'

type Tab =
  | 'setup'
  | 'network'
  | 'treasury'
  | 'title'
  | 'trade'
  | 'facility'
  | 'log'

const TABS: { id: Tab; label: string }[] = [
  { id: 'setup', label: '0 · Setup' },
  { id: 'network', label: '1 · Network' },
  { id: 'treasury', label: '2 · Treasury (ERC-20)' },
  { id: 'title', label: '3 · Titles (ERC-721)' },
  { id: 'trade', label: '4 · Trade finance (ERC-1155)' },
  { id: 'facility', label: '5 · Facility lifecycle' },
  { id: 'log', label: '6 · Event log' },
]

const IS_PUBLIC_DEMO = (import.meta.env.VITE_PUBLIC_DEMO ?? '') === 'true'

export default function App() {
  const [tab, setTab] = useState<Tab>('setup')
  const [config, setConfig] = useState<ApiConfig | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [history, setHistory] = useState<TxReceipt[]>([])

  const loadConfig = useCallback(async () => {
    setErr(null)
    try {
      setConfig(await apiGet<ApiConfig>('/api/config'))
    } catch (e) {
      setErr(String((e as Error).message ?? e))
    }
  }, [])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  const recordReceipt = useCallback((r: TxReceipt) => {
    setHistory((prev) => [r, ...prev].slice(0, 80))
  }, [])

  return (
    <div className="page">
      <header className="header">
        <h1>Kinexys-style orchestration · permissioned EVM POC</h1>
        <p className="sub">
          A hands-on tour of <strong>ERC-20</strong> deposit token, <strong>ERC-721</strong>{' '}
          property titles, <strong>ERC-1155</strong> trade-finance invoices, and a{' '}
          <strong>collateralized facility state machine</strong>. Three demo signers (banker /
          compliance / liquidation agent) prove segregation-of-duties on-chain. Every action shows
          the decoded receipt + events.
        </p>
      </header>

      {err && <div className="banner error">{err}</div>}

      <nav className="state-rail" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`state-rail__node${tab === t.id ? ' state-rail__node--current' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="state-rail__name">{t.label}</span>
          </button>
        ))}
      </nav>

      {tab === 'setup' && <SetupPanel />}
      {tab === 'network' && (
        <NetworkPanel config={config} onRefresh={() => void loadConfig()} isPublicDemo={IS_PUBLIC_DEMO} />
      )}
      {tab === 'treasury' && (
        <TreasuryPanel config={config} onError={setErr} onReceipt={recordReceipt} />
      )}
      {tab === 'title' && <TitlePanel config={config} onError={setErr} onReceipt={recordReceipt} />}
      {tab === 'trade' && (
        <TradeFinancePanel config={config} onError={setErr} onReceipt={recordReceipt} />
      )}
      {tab === 'facility' && <FacilityPanel onError={setErr} onReceipt={recordReceipt} />}
      {tab === 'log' && <EventLogPanel history={history} />}
    </div>
  )
}
