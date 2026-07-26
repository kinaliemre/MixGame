import { useState } from 'react'
import './App.css'
import {
  type GameSnapshot,
  type Tile,
  analyzeHand,
  createInitialSnapshot,
  getOpeningStatusLabel,
  getTileImage,
  getTileLabel,
} from './lib/o101'

const rackPositions = ['bottom', 'left', 'top', 'right'] as const
const myRackSlotCount = 32
const computerTurnOrder = [3, 2, 1]
const openingFollowUpTurnOrder = [2, 1]

type TurnPhase = 'draw' | 'discard'

type RoundState = {
  snapshot: GameSnapshot
  myRackSlots: Array<Tile | null>
  discardOwners: number[]
  turnPhase: TurnPhase
  message: string
}

function createRoundState(): RoundState {
  const snapshot = createInitialSnapshot()
  const myTiles = snapshot.players[0]?.tiles ?? []
  const firstDiscarder =
    snapshot.initialDiscardOwnerIndex === null
      ? null
      : snapshot.players[snapshot.initialDiscardOwnerIndex]

  const openingRound: RoundState = {
    snapshot,
    myRackSlots: [
      ...myTiles,
      ...Array<Tile | null>(myRackSlotCount - myTiles.length).fill(null),
    ],
    discardOwners:
      snapshot.initialDiscardOwnerIndex === null
        ? []
        : [snapshot.initialDiscardOwnerIndex],
    turnPhase: 'draw',
    message: firstDiscarder
      ? `${firstDiscarder.name} cekmeden ilk tasi atti. Sira sende.`
      : 'Sira sende. Kapali desteden tas cek veya atilan tasi al.',
  }

  if (!firstDiscarder) {
    return openingRound
  }

  return {
    ...playComputerTurns(openingRound, openingFollowUpTurnOrder),
    message:
      'Bilgisayar 3 cekmeden atti. Bilgisayar 2 ve Bilgisayar 1 oynadi. Sira sende.',
  }
}

function getFilledRackTiles(slots: Array<Tile | null>) {
  return slots.filter((tile): tile is Tile => Boolean(tile))
}

function addTileToRack(slots: Array<Tile | null>, tile: Tile) {
  const nextSlots = [...slots]
  const emptySlotIndex = nextSlots.findIndex((slot) => !slot)

  if (emptySlotIndex >= 0) {
    nextSlots[emptySlotIndex] = tile
    return nextSlots
  }

  return [...nextSlots, tile]
}

function getLastIndex<T>(items: T[], predicate: (item: T) => boolean) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) {
      return index
    }
  }

  return -1
}

function updatePlayerTiles(
  snapshot: GameSnapshot,
  playerIndex: number,
  tiles: Tile[],
) {
  return {
    ...snapshot,
    players: snapshot.players.map((player, index) =>
      index === playerIndex
        ? {
            ...player,
            tiles,
            analysis: analyzeHand(tiles),
          }
        : player,
    ),
  }
}

function playComputerTurns(
  round: RoundState,
  playerOrder = computerTurnOrder,
): RoundState {
  let snapshot = round.snapshot
  const drawPile = [...snapshot.drawPile]
  const discardPile = [...snapshot.discardPile]
  const discardOwners = [...round.discardOwners]
  const nextPlayers = [...snapshot.players]

  for (const playerIndex of playerOrder) {
    const player = nextPlayers[playerIndex]

    if (!player) {
      continue
    }

    const tiles = [...player.tiles]
    const drawnTile = drawPile.pop()

    if (drawnTile) {
      tiles.push(drawnTile)
    }

    const discardIndex =
      tiles.length > 0 ? Math.floor(Math.random() * tiles.length) : -1

    if (discardIndex >= 0) {
      const [discardedTile] = tiles.splice(discardIndex, 1)
      discardPile.push(discardedTile)
      discardOwners.push(playerIndex)
    }

    nextPlayers[playerIndex] = {
      ...player,
      tiles,
      analysis: analyzeHand(tiles),
    }
  }

  snapshot = {
    ...snapshot,
    activePlayerId: nextPlayers[0].id,
    players: nextPlayers,
    drawPile,
    discardPile,
  }

  return {
    ...round,
    snapshot,
    discardOwners,
    turnPhase: 'draw',
    message: 'Bilgisayar 3, Bilgisayar 2 ve Bilgisayar 1 oynadi. Sira sende.',
  }
}

function App() {
  const [{ snapshot, myRackSlots, discardOwners, turnPhase, message }, setRoundState] =
    useState<RoundState>(() => createRoundState())
  const [draggedSlotIndex, setDraggedSlotIndex] = useState<number | null>(null)
  const [roundKey, setRoundKey] = useState(0)

  const isMyTurn = snapshot.activePlayerId === snapshot.players[0]?.id
  const canDraw = isMyTurn && turnPhase === 'draw'
  const canDiscard = isMyTurn && turnPhase === 'discard'
  const playerDiscardTiles = snapshot.players.map((_, playerIndex) => {
    const lastIndex = getLastIndex(discardOwners, (owner) => owner === playerIndex)

    return lastIndex >= 0 ? snapshot.discardPile[lastIndex] : null
  })

  function startNewGame() {
    setDraggedSlotIndex(null)
    setRoundState(createRoundState())
    setRoundKey((current) => current + 1)
  }

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

  function drawFromPile() {
    setRoundState((current) => {
      if (current.turnPhase !== 'draw' || current.snapshot.drawPile.length === 0) {
        return current
      }

      const drawPile = [...current.snapshot.drawPile]
      const drawnTile = drawPile.pop()

      if (!drawnTile) {
        return current
      }

      const nextSlots = addTileToRack(current.myRackSlots, drawnTile)
      const myTiles = getFilledRackTiles(nextSlots)
      const snapshot = updatePlayerTiles(
        {
          ...current.snapshot,
          drawPile,
        },
        0,
        myTiles,
      )

      return {
        ...current,
        snapshot,
        myRackSlots: nextSlots,
        turnPhase: 'discard',
        message: 'Tas cektin. Simdi elinden bir tas atmalisin.',
      }
    })
  }

  function takeDiscardedTile(ownerIndex: number) {
    setRoundState((current) => {
      if (current.turnPhase !== 'draw') {
        return current
      }

      const discardPile = [...current.snapshot.discardPile]
      const discardOwners = [...current.discardOwners]
      const discardIndex = getLastIndex(discardOwners, (owner) => owner === ownerIndex)

      if (discardIndex < 0) {
        return current
      }

      const [takenTile] = discardPile.splice(discardIndex, 1)
      discardOwners.splice(discardIndex, 1)
      const nextSlots = addTileToRack(current.myRackSlots, takenTile)
      const myTiles = getFilledRackTiles(nextSlots)
      const snapshot = updatePlayerTiles(
        {
          ...current.snapshot,
          discardPile,
        },
        0,
        myTiles,
      )

      return {
        ...current,
        snapshot,
        discardOwners,
        myRackSlots: nextSlots,
        turnPhase: 'discard',
        message: `${current.snapshot.players[ownerIndex]?.name} attigi tasi aldin. Simdi elinden bir tas atmalisin.`,
      }
    })
  }

  function discardMyTile(slotIndex: number) {
    setRoundState((current) => {
      if (current.turnPhase !== 'discard') {
        return {
          ...current,
          message: 'Once tas cekmelisin veya atilan tasi almalisin.',
        }
      }

      const discardedTile = current.myRackSlots[slotIndex]

      if (!discardedTile) {
        return current
      }

      const nextSlots = [...current.myRackSlots]
      nextSlots[slotIndex] = null

      const myTiles = getFilledRackTiles(nextSlots)
      const snapshotWithMyDiscard = updatePlayerTiles(
        {
          ...current.snapshot,
          activePlayerId: current.snapshot.players[3]?.id ?? current.snapshot.players[0].id,
          discardPile: [...current.snapshot.discardPile, discardedTile],
        },
        0,
        myTiles,
      )

      const nextRound = {
        ...current,
        snapshot: snapshotWithMyDiscard,
        discardOwners: [...current.discardOwners, 0],
        myRackSlots: nextSlots,
        turnPhase: 'draw' as const,
        message: `${getTileLabel(discardedTile)} attin. Rakipler oynuyor.`,
      }

      return playComputerTurns(nextRound)
    })
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
          onClick={startNewGame}
        >
          Yeni oyun
        </button>
      </header>

      <section className="table-wrap" aria-label="101 oyun masasi">
        <div className="table-felt" key={roundKey}>
          <div className="guide-panel">
            <strong>{message}</strong>
            <span>
              Tas al: kapali desteye veya oyuncunun attigi tasa tikla. Tas at:
              elindeki tasi sagindaki atma alanina surukle.
            </span>
          </div>

          <div className="center-area">
            <button
              className="pile-button tile-stack"
              disabled={!canDraw || snapshot.drawPile.length === 0}
              type="button"
              onClick={drawFromPile}
            >
              <span className="stack-card" />
              <span className="stack-card" />
              <span className="stack-card top" />
              <strong>Kapali cek</strong>
            </button>

            <div className="center-tile center-tile--small">
              <span>Gosterge</span>
              {getTileImage(snapshot.indicator) ? (
                <img
                  src={getTileImage(snapshot.indicator) ?? undefined}
                  alt={snapshot.indicatorLabel}
                />
              ) : null}
              <strong>{snapshot.indicatorLabel}</strong>
            </div>

            <div className="center-tile center-tile--small">
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
            const playerDiscardTile = playerDiscardTiles[index]

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
                          key={`slot-${slotIndex}`}
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

                <button
                  className={`player-discard player-discard--${position} ${
                    playerDiscardTile ? 'has-tile' : ''
                  }`}
                  disabled={!canDraw && !(isMyRack && canDiscard)}
                  type="button"
                  aria-label={
                    isMyRack
                      ? 'Tas atma alani'
                      : playerDiscardTile
                      ? `${player.name} attigi tasi al`
                      : `${player.name} atik tas alani`
                  }
                  onClick={() => {
                    if (canDraw && playerDiscardTile) {
                      takeDiscardedTile(index)
                    }
                  }}
                  onDragOver={(event) => {
                    if (isMyRack && canDiscard) {
                      event.preventDefault()
                    }
                  }}
                  onDrop={(event) => {
                    if (isMyRack && canDiscard && draggedSlotIndex !== null) {
                      event.preventDefault()
                      discardMyTile(draggedSlotIndex)
                    }
                  }}
                >
                  {playerDiscardTile ? (
                    getTileImage(playerDiscardTile) ? (
                      <img
                        src={getTileImage(playerDiscardTile) ?? undefined}
                        alt={`${player.name} attigi ${getTileLabel(playerDiscardTile)}`}
                      />
                    ) : (
                      <span>{getTileLabel(playerDiscardTile)}</span>
                    )
                  ) : null}
                </button>
              </section>
            )
          })}
        </div>
      </section>
    </main>
  )
}

export default App
