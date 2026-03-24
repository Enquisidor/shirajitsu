import registry from '../../../../registry/source-registry.json'

export function RegistryPage() {
  const { tiers, version, lastUpdated } = registry

  return (
    <main>
      <h1>Source Registry</h1>
      <p>Version {version} · Last updated {lastUpdated}</p>
      <p>
        This registry governs how Shirajitsu classifies sources. It is published here for full
        transparency — our methodology is never hidden.
      </p>

      {Object.entries(tiers).map(([key, tier]) => (
        <section key={key}>
          <h2>{tier.label}</h2>
          <p>{tier.description}</p>
          {'domains' in tier && tier.domains.length > 0 && (
            <ul>
              {tier.domains.map((d) => <li key={d}>{d}</li>)}
            </ul>
          )}
        </section>
      ))}
    </main>
  )
}
