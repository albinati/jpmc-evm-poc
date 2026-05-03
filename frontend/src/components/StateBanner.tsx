type Props = { label: string; value: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' }

export function StateBanner({ label, value, tone = 'neutral' }: Props) {
  return (
    <div className={`state-banner state-banner--${tone}`}>
      <span className="state-banner__label">{label}</span>
      <span className="state-banner__value">{value}</span>
    </div>
  )
}
