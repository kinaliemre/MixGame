import { useState } from 'react'
import './App.css'
import {
  type GameSnapshot,
  type Tile,
  createInitialSnapshot,
  getOpeningStatusLabel,
  getTileImage,
  getTileLabel,
} from './lib/o101'

const rackPositions = ['bottom', 'left', 'top', 'right'] as const
const myRackSlotCount = 32

type RoundState = {
  snapshot: GameSnapshot
  myRackSlots: Array<Tile | null>
}

function createRoundState(): RoundState {
  const snapshot = createInitialSnapshot()
  const myTiles = snapshot.players[0]?.tiles ?? []

  return {
    snapshot,
    myRackSlots: [
      ...myTiles,
      ...Array<Tile | null>(myRackSlotCount - myTiles.length).fill(null),
    ],
  }
}

function App() {
  const [{ snapshot, myRackSlots }, setRoundState] = useState<RoundState>(() =>
    createRoundState(),
  )
  const [draggedSlotIndex, setDraggedSlotIndex] = useState<number | null>(null)

  function moveMyTile(targetSlotIndex: number) {
    if (draggedSlotIndex === null || draggedSlotIndex === targetSlotIndex) {
      setDraggedSlotIndex(null)
      return
    }

    setRoundState((current) => {
      const draggedTile = current.myRackSlots[draggedSlotIndex]

      if (!draggedTile) {
        return current
      }

      const nextSlots = [...current.myRackSlots]

      nextSlots[draggedSlotIndex] = nextSlots[targetSlotIndex]
      nextSlots[targetSlotIndex] = draggedTile

      return {
        ...current,
        myRackSlots: nextSlots,
      }
    })

    setDraggedSlotIndex(null)
  }

  return (
    <main className="game-screen">
      <header className="table-header">
        <div>
          <p className="eyebrow">MixGame 101</p>
          <h1>Klasik 101 Masasi</h1>
        </div>

        <button
          className="new-round-button"
          type="button"
          onClick={() => setRoundState(createRoundState())}
        >
          Yeni tur
        </button>
      </header>

      <section className="table-wrap" aria-label="101 oyun masasi">
        <div className="table-felt">
          <div className="center-area">
            <div className="tile-stack">
              <span className="stack-card" />
              <span className="stack-card" />
              <span className="stack-card top" />
            </div>

            <div className="center-tile">
              <span>Gosterge</span>
              {getTileImage(snapshot.indicator) ? (
                <img
                  src={getTileImage(snapshot.indicator) ?? undefined}
                  alt={snapshot.indicatorLabel}
                />
              ) : null}
              <strong>{snapshot.indicatorLabel}</strong>
            </div>

            <div className="center-tile">
              <span>Okey</span>
              {getTileImage(snapshot.okeyTile) ? (
                <img
                  src={getTileImage(snapshot.okeyTile) ?? undefined}
                  alt={snapshot.okeyLabel}
                />
              ) : null}
              <strong>{snapshot.okeyLabel}</strong>
            </div>
          </div>

          {snapshot.players.map((player, index) => {
            const position = rackPositions[index]
            const isMyRack = index === 0
            const isActive = player.id === snapshot.activePlayerId

            return (
              <section
                className={`player-rack player-rack--${position} ${
                  isActive ? 'is-active' : ''
                }`}
                key={player.id}
              >
                <div className="rack-label">
                  <div>
                    <h2>{player.name}</h2>
                    <p>
                      {isMyRack
                        ? myRackSlots.filter(Boolean).length
                        : player.tiles.length}{' '}
                      tas
                    </p>
                  </div>
                  <span
                    className={`status-pill ${
                      isMyRack && player.analysis.canOpen ? 'success' : 'warning'
                    }`}
                  >
                    {isMyRack
                      ? getOpeningStatusLabel(player.analysis.canOpen)
                      : 'Kapali el'}
                  </span>
                </div>

                {isMyRack ? (
                  <div
                    className="rack-board"
                    onDragOver={(event) => event.preventDefault()}
                  >
                    {myRackSlots.map((tile, slotIndex) => {
                      const tileImage = tile ? getTileImage(tile) : null

                      return (
                        <div
                          className="rack-slot"
                          key={tile?.id ?? `empty-slot-${slotIndex}`}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.stopPropagation()
                            moveMyTile(slotIndex)
                          }}
                        >
                          {tile ? (
                            <button
                              className={`tile tile--draggable ${
                                draggedSlotIndex === slotIndex ? 'is-dragging' : ''
                              }`}
                              draggable
                              type="button"
                              onDragStart={() => setDraggedSlotIndex(slotIndex)}
                              onDragEnd={() => setDraggedSlotIndex(null)}
                            >
                              {tileImage ? (
                                <img src={tileImage} alt={getTileLabel(tile)} />
                              ) : (
                                <span>{getTileLabel(tile)}</span>
                              )}
                            </button>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="opponent-rack-line" aria-hidden="true" />
                )}
              </section>
            )
          })}
        </div>
      </section>
    </main>
  )
}

export default App
