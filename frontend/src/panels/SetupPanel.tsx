export function SetupPanel() {
  return (
    <section className="panel panel--start">
      <h2>Setup</h2>
      <p className="panel-lead">
        This UI never holds private keys. Contracts are <strong>deployed</strong> via Hardhat;
        the Spring Boot orchestration API signs every workflow POST using the three demo keys
        (banker / compliance / liquidation agent), proving segregation-of-duties on-chain.
      </p>

      <div className="contracts-e2e">
        <h3 className="contracts-e2e__title">Run the whole stack with Docker</h3>
        <p className="contracts-e2e__body">
          From the repo root: <code className="inline-code">docker compose -f deploy/docker-compose.yml up --build</code>.
          Then open <strong>http://localhost:5173</strong> after services report healthy.
        </p>
      </div>

      <div className="contracts-e2e">
        <h3 className="contracts-e2e__title">Smart-contract end-to-end (no UI)</h3>
        <p className="contracts-e2e__body">
          <code className="inline-code">npm run verify</code> compiles every contract and runs
          the full test suite — including a scripted scenario that walks the facility lifecycle
          start-to-finish on Hardhat's in-process network.
        </p>
      </div>

      <ol className="start-checklist">
        <li>
          <strong>Local chain.</strong>
          <pre className="cmd">npm ci{'\n'}npx hardhat node</pre>
        </li>
        <li>
          <strong>Deploy + seed.</strong>
          <pre className="cmd">npx hardhat run scripts/deploy.js --network localhost</pre>
          Writes <code className="inline-code">deployments/local.json</code> with the four
          contract addresses and the three demo signer addresses.
        </li>
        <li>
          <strong>Orchestration API.</strong>
          <pre className="cmd">{`cd backend
./mvnw spring-boot:run`}</pre>
          With no env vars set, the API uses Hardhat accounts #1 / #2 / #3 as banker /
          compliance / liquidation agent. Override via <code className="inline-code">POC_BANKER_PRIVATE_KEY</code>,{' '}
          <code className="inline-code">POC_COMPLIANCE_PRIVATE_KEY</code>,{' '}
          <code className="inline-code">POC_LIQUIDATION_PRIVATE_KEY</code>.
        </li>
        <li>
          <strong>This UI.</strong>
          <pre className="cmd">cd frontend{'\n'}npm ci{'\n'}npm run dev</pre>
        </li>
      </ol>
    </section>
  )
}
