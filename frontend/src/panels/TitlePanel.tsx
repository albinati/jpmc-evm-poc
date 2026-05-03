import { useCallback, useEffect, useState } from 'react'
import { apiGet, postAction } from '../api'
import type { ApiConfig, Title, TxReceipt } from '../types'
import { TxReceiptView } from '../components/TxReceiptView'

type Props = {
  config: ApiConfig | null
  onError: (msg: string) => void
  onReceipt: (r: TxReceipt) => void
}

export function TitlePanel({ config, onError, onReceipt }: Props) {
  const [tokenId, setTokenId] = useState('1')
  const [title, setTitle] = useState<Title | null>(null)
  const [last, setLast] = useState<TxReceipt | null>(null)
  const [newURI, setNewURI] = useState('https://poc.jpmc-evm/demo/1?v=2')
  const [transferTo, setTransferTo] = useState('')
  const [mintTo, setMintTo] = useState('')
  const [mintTokenId, setMintTokenId] = useState('99')
  const [mintURI, setMintURI] = useState('https://poc.jpmc-evm/demo/99')

  useEffect(() => {
    if (config?.complianceAddress) setTransferTo((t) => t || config.complianceAddress!)
    if (config?.bankerAddress) setMintTo((t) => t || config.bankerAddress!)
  }, [config])

  const load = useCallback(async () => {
    try {
      setTitle(await apiGet<Title>(`/api/titles/${tokenId.trim() || '1'}`))
    } catch (e) {
      onError(String((e as Error).message ?? e))
    }
  }, [tokenId, onError])

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
      <h2>Title Tokenization · ERC-721 with encumbrance + transfer-agent gate</h2>
      <p className="panel-lead">
        Each property title is a non-fungible token with rich metadata. Compliance can encumber a
        title (block transfers without burning), update its metadata pointer, and qualify buyers.
        Transfers go through the <code className="inline-code">TRANSFER_AGENT_ROLE</code> — held
        by the banker key.
      </p>

      <div className="row">
        <label>
          Token ID{' '}
          <input className="inp" value={tokenId} onChange={(e) => setTokenId(e.target.value)} />
        </label>
        <button type="button" onClick={() => void load()}>
          Load title
        </button>
      </div>

      {title && (
        <dl className="grid grid--snapshot">
          <dt>Owner</dt>
          <dd className="mono">{title.owner}</dd>
          <dt>tokenURI</dt>
          <dd className="mono">{title.tokenURI}</dd>
          <dt>Property address</dt>
          <dd className="mono">{title.propertyAddress}</dd>
          <dt>Encumbered</dt>
          <dd>{title.isEncumbered ? 'yes (transfers blocked)' : 'no'}</dd>
          <dt>Jurisdiction</dt>
          <dd>{title.jurisdiction}</dd>
        </dl>
      )}

      <ol className="walkthrough">
        <li className="walkthrough__step">
          <h3 className="walkthrough__title">A — Mint a new title (compliance)</h3>
          <p className="walkthrough__role">
            <span className="role-tag role-tag--compliance">COMPLIANCE_OFFICER_ROLE</span>
          </p>
          <div className="row row--stack">
            <input
              className="inp inp--wide"
              placeholder="recipient 0x..."
              value={mintTo}
              onChange={(e) => setMintTo(e.target.value)}
            />
            <input
              className="inp"
              placeholder="tokenId"
              value={mintTokenId}
              onChange={(e) => setMintTokenId(e.target.value)}
            />
            <input
              className="inp inp--wide"
              placeholder="tokenURI"
              value={mintURI}
              onChange={(e) => setMintURI(e.target.value)}
            />
            <button
              type="button"
              className="btn-primary"
              onClick={() =>
                void post('/api/titles/mint', {
                  to: mintTo,
                  tokenId: mintTokenId,
                  tokenURI: mintURI,
                  propertyAddress: '0x1234567890123456789012345678901234567890',
                  salePrice: '1',
                  jurisdiction: 'NY',
                })
              }
            >
              Mint title
            </button>
          </div>
        </li>

        <li className="walkthrough__step">
          <h3 className="walkthrough__title">B — Toggle encumbrance</h3>
          <p className="walkthrough__body">
            Encumbered titles cannot move via{' '}
            <code className="inline-code">safeTransferTitle</code>. Try transferring while
            encumbered — the receipt panel shows the <code>EncumberedTitle</code> revert.
          </p>
          <div className="row">
            <button
              type="button"
              className="btn-primary"
              onClick={() => void post(`/api/titles/${tokenId}/encumbrance`, { on: true })}
            >
              Encumber
            </button>
            <button
              type="button"
              onClick={() => void post(`/api/titles/${tokenId}/encumbrance`, { on: false })}
            >
              Release encumbrance
            </button>
          </div>
        </li>

        <li className="walkthrough__step">
          <h3 className="walkthrough__title">C — Update tokenURI (amend metadata)</h3>
          <p className="walkthrough__body">
            Useful when the off-chain document changes (re-appraisal, jurisdiction updates).
            Emits <code className="inline-code">TokenURIUpdated</code>.
          </p>
          <div className="row">
            <input
              className="inp inp--wide"
              value={newURI}
              onChange={(e) => setNewURI(e.target.value)}
            />
            <button
              type="button"
              className="btn-primary"
              onClick={() => void post(`/api/titles/${tokenId}/uri`, { uri: newURI })}
            >
              Update URI
            </button>
          </div>
        </li>

        <li className="walkthrough__step">
          <h3 className="walkthrough__title">D — Transfer to a new owner</h3>
          <p className="walkthrough__role">
            <span className="role-tag">TRANSFER_AGENT_ROLE</span> (banker)
          </p>
          <div className="row">
            <input
              className="inp inp--wide"
              placeholder="to 0x..."
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
            />
            <button
              type="button"
              className="btn-primary"
              onClick={() =>
                void post(`/api/titles/${tokenId}/transfer`, {
                  from: title?.owner ?? '',
                  to: transferTo,
                })
              }
            >
              Transfer (will fail if encumbered)
            </button>
          </div>
        </li>
      </ol>

      <TxReceiptView receipt={last} />
    </section>
  )
}
