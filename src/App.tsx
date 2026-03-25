import { useMemo, useState } from 'react'
import './App.css'
import {
  type GameSnapshot,
  createInitialSnapshot,
  getOpeningStatusLabel,
  getTileImage,
  getTileLabel,
  ruleHighlights,
  upcomingGames,
} from './lib/o101'

function App() {
  const [snapshot, setSnapshot] = useState<GameSnapshot>(() =>
    createInitialSnapshot(),
  )

  const activePlayer = useMemo(
    () => snapshot.players.find((player) => player.id === snapshot.activePlayerId),
    [snapshot],
  )

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">MixGame</p>
          <h1>Cok oyunlu bir masa oyunlari merkezi</h1>
          <p className="sidebar-copy">
            Bu yapi ilk olarak klasik 101 icin hazirlandi. Ayni klasore ileride
            Sudoku, Batak veya baska oyunlar eklenebilir.
          </p>
        </div>

        <section className="sidebar-panel">
          <div className="panel-heading">
            <h2>Oyun Kutuphanesi</h2>
            <span className="pill active">Hazir</span>
          </div>

          <button className="game-card selected" type="button">
            <span className="game-card__title">101</span>
            <span className="game-card__meta">
              Klasik kurallar, tur baslatma ve el analizi
            </span>
          </button>

          {upcomingGames.map((game) => (
            <div className="game-card muted" key={game.name}>
              <span className="game-card__title">{game.name}</span>
              <span className="game-card__meta">{game.description}</span>
            </div>
          ))}
        </section>

        <section className="sidebar-panel">
          <div className="panel-heading">
            <h2>Ne nereye eklendi?</h2>
          </div>
          <ul className="plain-list">
            <li>
              <code>src/App.tsx</code>: ana ekran ve 101 masasi
            </li>
            <li>
              <code>src/lib/o101.ts</code>: taslar, dagitim ve puan mantigi
            </li>
            <li>
              <code>src/App.css</code>: arayuz stili
            </li>
            <li>
              <code>README.md</code>: kurulum, dosya haritasi ve sonraki adimlar
            </li>
          </ul>
        </section>
      </aside>

      <main className="main-content">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Ilk oyun: 101</p>
            <h2 className="hero-title">Yerelde calisan, deploy edilmeye hazir bir temel</h2>
            <p className="hero-copy">
              Asagidaki ekran klasik 101 kurallarini referans alan bir masa
              prototipi sunar. Yeni tur baslatabilir, dagitilan elleri gorebilir
              ve acilis icin yeterli seri puani olup olmadigini izleyebilirsin.
            </p>
          </div>

          <div className="hero-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => setSnapshot(createInitialSnapshot())}
            >
              Yeni tur baslat
            </button>
            <div className="hero-stat">
              <span>Gosterge</span>
              {getTileImage(snapshot.indicator) ? (
                <img
                  className="hero-stat__tile"
                  src={getTileImage(snapshot.indicator) ?? undefined}
                  alt={snapshot.indicatorLabel}
                />
              ) : null}
              <strong>{snapshot.indicatorLabel}</strong>
            </div>
            <div className="hero-stat">
              <span>Okey</span>
              {getTileImage(snapshot.okeyTile) ? (
                <img
                  className="hero-stat__tile"
                  src={getTileImage(snapshot.okeyTile) ?? undefined}
                  alt={snapshot.okeyLabel}
                />
              ) : null}
              <strong>{snapshot.okeyLabel}</strong>
            </div>
          </div>
        </section>

        <section className="content-grid">
          <article className="panel board-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Tur ozeti</p>
                <h3>Oyuncular ve dagitim</h3>
              </div>
              <span className="pill">
                Sira: {activePlayer ? activePlayer.name : 'Belirsiz'}
              </span>
            </div>

            <div className="players-grid">
              {snapshot.players.map((player) => (
                <section
                  className={`player-card ${
                    player.id === snapshot.activePlayerId ? 'highlighted' : ''
                  }`}
                  key={player.id}
                >
                  <div className="player-card__header">
                    <div>
                      <h4>{player.name}</h4>
                      <p>{player.isDealer ? 'Dagitan oyuncu' : 'Normal dagitim'}</p>
                    </div>
                    <div className="score-chip">
                      <span>Acilis</span>
                      <strong>{player.analysis.total}</strong>
                    </div>
                  </div>

                  <div className="status-row">
                    <span
                      className={`pill ${
                        player.analysis.canOpen ? 'success' : 'warning'
                      }`}
                    >
                      {getOpeningStatusLabel(player.analysis.canOpen)}
                    </span>
                    <span className="muted-copy">
                      {player.tiles.length} tas
                    </span>
                  </div>

                  <div className="tile-rack">
                    {player.tiles.map((tile) => {
                      const tileImage = getTileImage(tile)

                      return (
                        <div className="tile" key={tile.id}>
                          {tileImage ? (
                            <img
                              className="tile-image"
                              src={tileImage}
                              alt={getTileLabel(tile)}
                            />
                          ) : (
                            <span className="tile-fallback">{getTileLabel(tile)}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div className="combo-list">
                    {player.analysis.combos.length > 0 ? (
                      player.analysis.combos.map((combo, index) => (
                        <div className="combo-card" key={`${player.id}-${index}`}>
                          <strong>{combo.type === 'run' ? 'Seri' : 'Ayni sayi'}</strong>
                          <span>{combo.total} puan</span>
                          <p>{combo.tiles.map((tile) => getTileLabel(tile)).join(' - ')}</p>
                        </div>
                      ))
                    ) : (
                      <div className="combo-card empty">
                        <strong>Hazir seri yok</strong>
                        <p>Bu elde otomatik tespit edilen bir acilis kombosu bulunamadi.</p>
                      </div>
                    )}
                  </div>
                </section>
              ))}
            </div>
          </article>

          <aside className="stack">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Kural ozeti</p>
                  <h3>Klasik 101 mantigi</h3>
                </div>
              </div>

              <div className="rules-list">
                {ruleHighlights.map((rule) => (
                  <article className="rule-card" key={rule.title}>
                    <h4>{rule.title}</h4>
                    <p>{rule.description}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Teknik notlar</p>
                  <h3>Bu temel neleri hazir birakiyor?</h3>
                </div>
              </div>

              <ul className="plain-list">
                <li>Vite + React + TypeScript ile hizli gelistirme ortami</li>
                <li>Tek klasorde birden fazla oyun tutabilecek katalog yapisi</li>
                <li>101 icin tas destesi, dagitim ve acilis puani simulasyonu</li>
                <li>Sonradan Firebase, Supabase veya kendi API katmanina acik mimari</li>
              </ul>
            </section>
          </aside>
        </section>
      </main>
    </div>
  )
}

export default App
