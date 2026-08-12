import { useEffect, useRef, useState } from 'react'
import './App.css'
import {
  type GameSnapshot,
  type Tile,
  analyzeHand,
  colors,
  createInitialSnapshot,
  getIndicatorTileImage,
  getOpeningStatusLabel,
  getTileImage,
  getTileLabel,
} from './lib/o101'

const rackPositions = ['bottom', 'left', 'top', 'right'] as const
const myRackSlotCount = 32
const computerTurnOrder = [3, 2, 1]
const computerTurnDelayMs = 5000

type TurnPhase = 'draw' | 'discard'

type TileGroup = {
  tiles: Tile[]
  total: number
}

type RoundState = {
  snapshot: GameSnapshot
  myRackSlots: Array<Tile | null>
  discardOwners: number[]
  temporaryTakenDiscard: {
    ownerIndex: number
    tile: Tile
  } | null
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
    temporaryTakenDiscard: null,
    turnPhase: 'discard',
    message: firstDiscarder
      ? `${firstDiscarder.name} cekmeden ilk tasi atti. Sira sende.`
      : 'Sira sende. Cekmeden ilk tasi at.',
  }

  return openingRound
}

function getFilledRackTiles(slots: Array<Tile | null>) {
  return slots.filter((tile): tile is Tile => Boolean(tile))
}

function sortRackTiles(tiles: Tile[]) {
  return [...tiles].sort((left, right) => {
    if (left.fakeJoker !== right.fakeJoker) {
      return left.fakeJoker ? 1 : -1
    }

    if (left.color === right.color) {
      return left.number - right.number
    }

    return colors.indexOf(left.color) - colors.indexOf(right.color)
  })
}

function createSlotsFromGroups(groups: TileGroup[], remainingTiles: Tile[]) {
  const arrangedTiles: Array<Tile | null> = []

  groups.forEach((group, index) => {
    arrangedTiles.push(...group.tiles)

    if (index < groups.length - 1) {
      arrangedTiles.push(null)
    }
  })

  if (groups.length > 0 && remainingTiles.length > 0) {
    arrangedTiles.push(null)
  }

  arrangedTiles.push(...sortRackTiles(remainingTiles))

  return [
    ...arrangedTiles,
    ...Array<Tile | null>(
      Math.max(myRackSlotCount - arrangedTiles.length, 0),
    ).fill(null),
  ]
}

function isOkeyTile(tile: Tile, okeyTile: Tile) {
  return !tile.fakeJoker && tile.color === okeyTile.color && tile.number === okeyTile.number
}

function getWildcardTiles(tiles: Tile[], okeyTile: Tile) {
  return tiles.filter((tile) => isOkeyTile(tile, okeyTile))
}

function findRunGroups(tiles: Tile[], okeyTile: Tile) {
  const groups: TileGroup[] = []
  const wildcardTiles = getWildcardTiles(tiles, okeyTile)
  const tilesByColor = new Map(
    colors.map((color) => [
      color,
      new Map<number, Tile[]>(),
    ]),
  )

  for (const tile of tiles) {
    if (tile.fakeJoker || isOkeyTile(tile, okeyTile)) {
      continue
    }

    const colorTiles = tilesByColor.get(tile.color)
    const numberTiles = colorTiles?.get(tile.number) ?? []
    numberTiles.push(tile)
    colorTiles?.set(tile.number, numberTiles)
  }

  for (const color of colors) {
    const colorTiles = tilesByColor.get(color)

    if (!colorTiles) {
      continue
    }

    for (let start = 1; start <= 13; start += 1) {
      for (let length = 3; start + length - 1 <= 13; length += 1) {
        const sequence = Array.from(
          { length },
          (_, index) => start + index,
        )
        const missingNumbers = sequence.filter(
          (number) => !(colorTiles.get(number)?.length),
        )

        if (missingNumbers.length > wildcardTiles.length) {
          continue
        }

        const groupTiles = sequence.map((number) => {
          const tile = colorTiles.get(number)?.[0]

          if (tile) {
            return tile
          }

          const wildcardOffset = missingNumbers.indexOf(number)
          return wildcardTiles[wildcardOffset]
        })

        if (groupTiles.some((tile) => !tile)) {
          continue
        }

        groups.push({
          tiles: groupTiles,
          total: sequence.reduce((sum, number) => sum + number, 0),
        })
      }
    }
  }

  return groups.sort((left, right) => right.total - left.total)
}

function findSetGroups(tiles: Tile[], okeyTile: Tile) {
  const groupedTiles = new Map<number, Tile[]>()
  const wildcardTiles = getWildcardTiles(tiles, okeyTile)

  for (const tile of sortRackTiles(tiles)) {
    if (tile.fakeJoker || isOkeyTile(tile, okeyTile)) {
      continue
    }

    const existing = groupedTiles.get(tile.number) ?? []
    const hasSameColor = existing.some((groupTile) => groupTile.color === tile.color)

    if (!hasSameColor) {
      existing.push(tile)
      groupedTiles.set(tile.number, existing)
    }
  }

  return [...groupedTiles.entries()]
    .flatMap(([number, group]) => {
      const groups: TileGroup[] = []

      if (group.length >= 3) {
        groups.push({ tiles: group, total: number * group.length })
      }

      if (group.length >= 2 && group.length < 4 && wildcardTiles.length > 0) {
        groups.push({
          tiles: [...group, wildcardTiles[0]],
          total: number * (group.length + 1),
        })
      }

      return groups
    })
    .sort((left, right) => right.total - left.total)
}

function getGroupTotal(group: TileGroup) {
  return group.total
}

function findSerialGroups(tiles: Tile[], okeyTile: Tile) {
  const possibleGroups = [
    ...findRunGroups(tiles, okeyTile),
    ...findSetGroups(tiles, okeyTile),
  ].sort(
    (left, right) => getGroupTotal(right) - getGroupTotal(left),
  )
  const selectedGroups: TileGroup[] = []
  const usedTileIds = new Set<string>()

  for (const group of possibleGroups) {
    const hasUsedTile = group.tiles.some((tile) => usedTileIds.has(tile.id))

    if (hasUsedTile) {
      continue
    }

    selectedGroups.push(group)
    group.tiles.forEach((tile) => usedTileIds.add(tile.id))
  }

  return selectedGroups
}

function findPairGroups(tiles: Tile[], okeyTile: Tile) {
  const groupedTiles = new Map<string, Tile[]>()
  const wildcardTiles = getWildcardTiles(tiles, okeyTile)
  let wildcardIndex = 0

  for (const tile of tiles) {
    if (tile.fakeJoker || isOkeyTile(tile, okeyTile)) {
      continue
    }

    const key = `${tile.color}-${tile.number}`
    const existing = groupedTiles.get(key) ?? []
    existing.push(tile)
    groupedTiles.set(key, existing)
  }

  const pairs = [...groupedTiles.values()]
    .flatMap((group) => {
      const groupPairs: TileGroup[] = []

      for (let index = 0; index + 1 < group.length; index += 2) {
        groupPairs.push({
          tiles: group.slice(index, index + 2),
          total: 1,
        })
      }

      if (group.length % 2 === 1 && wildcardIndex < wildcardTiles.length) {
        const wildcardTile = wildcardTiles[wildcardIndex]
        wildcardIndex += 1
        groupPairs.push({
          tiles: [group[group.length - 1], wildcardTile],
          total: 1,
        })
      }

      return groupPairs
    })
    .sort((left, right) => {
      const [leftTile] = left.tiles
      const [rightTile] = right.tiles

      if (!leftTile || !rightTile) {
        return 0
      }

      if (leftTile.number === rightTile.number) {
        return colors.indexOf(leftTile.color) - colors.indexOf(rightTile.color)
      }

      return leftTile.number - rightTile.number
    })

  return pairs
}

function getRackSegments(slots: Array<Tile | null>) {
  const segments: Tile[][] = []
  let currentSegment: Tile[] = []

  for (const slot of slots) {
    if (!slot) {
      if (currentSegment.length > 0) {
        segments.push(currentSegment)
        currentSegment = []
      }

      continue
    }

    currentSegment.push(slot)
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment)
  }

  return segments
}

function getRackRunGroup(segment: Tile[], okeyTile: Tile): TileGroup | null {
  if (segment.length < 3) {
    return null
  }

  const regularTiles = segment.filter((tile) => !isOkeyTile(tile, okeyTile))
  const firstRegularTile = regularTiles[0]

  if (!firstRegularTile) {
    return null
  }

  const sameColor = regularTiles.every(
    (tile) => tile.color === firstRegularTile.color && !tile.fakeJoker,
  )
  const numbers = regularTiles.map((tile) => tile.number)
  const hasDuplicateNumbers = new Set(numbers).size !== numbers.length

  if (!sameColor || hasDuplicateNumbers) {
    return null
  }

  for (let start = 1; start <= 14 - segment.length; start += 1) {
    const sequence = Array.from(
      { length: segment.length },
      (_, index) => start + index,
    )
    const containsAllNumbers = numbers.every((number) =>
      sequence.includes(number),
    )

    if (containsAllNumbers) {
      return {
        tiles: segment,
        total: sequence.reduce((sum, number) => sum + number, 0),
      }
    }
  }

  return null
}

function getRackSetGroup(segment: Tile[], okeyTile: Tile): TileGroup | null {
  if (segment.length < 3 || segment.length > 4) {
    return null
  }

  const regularTiles = segment.filter((tile) => !isOkeyTile(tile, okeyTile))
  const firstRegularTile = regularTiles[0]

  if (!firstRegularTile) {
    return null
  }

  const sameNumber = regularTiles.every(
    (tile) => tile.number === firstRegularTile.number && !tile.fakeJoker,
  )
  const colorsAreUnique =
    new Set(regularTiles.map((tile) => tile.color)).size === regularTiles.length

  if (!sameNumber || !colorsAreUnique) {
    return null
  }

  return {
    tiles: segment,
    total: firstRegularTile.number * segment.length,
  }
}

function findRackSerialGroups(slots: Array<Tile | null>, okeyTile: Tile) {
  return getRackSegments(slots).flatMap((segment) => {
    const runGroup = getRackRunGroup(segment, okeyTile)
    const setGroup = getRackSetGroup(segment, okeyTile)

    if (runGroup && setGroup) {
      return runGroup.total >= setGroup.total ? [runGroup] : [setGroup]
    }

    return runGroup ?? setGroup ?? []
  })
}

function findRackPairGroups(slots: Array<Tile | null>, okeyTile: Tile) {
  const groups: TileGroup[] = []

  for (const segment of getRackSegments(slots)) {
    for (let index = 0; index + 1 < segment.length; index += 2) {
      const left = segment[index]
      const right = segment[index + 1]
      const leftIsOkey = isOkeyTile(left, okeyTile)
      const rightIsOkey = isOkeyTile(right, okeyTile)
      const isPair =
        (leftIsOkey && !right.fakeJoker) ||
        (rightIsOkey && !left.fakeJoker) ||
        (left.color === right.color &&
          left.number === right.number &&
          !left.fakeJoker &&
          !right.fakeJoker)

      if (isPair) {
        groups.push({
          tiles: [left, right],
          total: 1,
        })
      }
    }
  }

  return groups
}

function getGroupsTotal(groups: TileGroup[]) {
  return groups.reduce((sum, group) => sum + getGroupTotal(group), 0)
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

function playComputerTurn(
  round: RoundState,
  playerIndex: number,
  nextActivePlayerIndex: number,
): RoundState {
  const player = round.snapshot.players[playerIndex]

  if (!player) {
    return round
  }

  const drawPile = [...round.snapshot.drawPile]
  const discardPile = [...round.snapshot.discardPile]
  const discardOwners = [...round.discardOwners]
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

  const nextPlayers = round.snapshot.players.map((currentPlayer, index) =>
    index === playerIndex
      ? {
          ...currentPlayer,
          tiles,
          analysis: analyzeHand(tiles),
        }
      : currentPlayer,
  )
  const nextActivePlayer =
    nextPlayers[nextActivePlayerIndex] ?? nextPlayers[0] ?? player

  return {
    ...round,
    snapshot: {
      ...round.snapshot,
      activePlayerId: nextActivePlayer.id,
      players: nextPlayers,
      drawPile,
      discardPile,
    },
    discardOwners,
    turnPhase: nextActivePlayerIndex === 0 ? 'draw' : round.turnPhase,
    message:
      nextActivePlayerIndex === 0
        ? 'Sira sende.'
        : `${nextActivePlayer.name} oynuyor.`,
  }
}

function App() {
  const [
    { snapshot, myRackSlots, discardOwners, temporaryTakenDiscard, turnPhase },
    setRoundState,
  ] = useState<RoundState>(() => createRoundState())
  const [draggedSlotIndex, setDraggedSlotIndex] = useState<number | null>(null)
  const [flippedOkeyIds, setFlippedOkeyIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [roundKey, setRoundKey] = useState(0)
  const [rackArrangeMode, setRackArrangeMode] = useState<
    'runs' | 'pairs' | null
  >(null)
  const computerTurnTimers = useRef<Array<ReturnType<typeof window.setTimeout>>>(
    [],
  )

  const isMyTurn = snapshot.activePlayerId === snapshot.players[0]?.id
  const canDraw = isMyTurn && turnPhase === 'draw'
  const canDiscard = isMyTurn && turnPhase === 'discard'
  const myTiles = getFilledRackTiles(myRackSlots)
  const serialHandGroups =
    rackArrangeMode === 'runs'
      ? findRackSerialGroups(myRackSlots, snapshot.okeyTile)
      : []
  const serialHandTotal = getGroupsTotal(serialHandGroups)
  const pairHandCount =
    rackArrangeMode === 'pairs'
      ? findRackPairGroups(myRackSlots, snapshot.okeyTile).length
      : 0
  const hasPassedSerialTarget = serialHandTotal >= 101
  const hasPassedPairTarget = pairHandCount >= 5
  const handValueLabel =
    rackArrangeMode === null
      ? '0/101'
      : rackArrangeMode === 'runs'
      ? hasPassedSerialTarget
        ? `${serialHandTotal}/101 gecti`
        : `${serialHandTotal}/101`
      : hasPassedPairTarget
      ? `${pairHandCount}/5 gecti`
      : `${pairHandCount}/5`
  const playerDiscardTiles = snapshot.players.map((_, playerIndex) => {
    const lastIndex = getLastIndex(discardOwners, (owner) => owner === playerIndex)

    return lastIndex >= 0 ? snapshot.discardPile[lastIndex] : null
  })

  function clearComputerTurnTimers() {
    computerTurnTimers.current.forEach((timer) => window.clearTimeout(timer))
    computerTurnTimers.current = []
  }

  function scheduleComputerTurns(turnIndex = 0) {
    if (turnIndex === 0 && computerTurnTimers.current.length > 0) {
      return
    }

    const playerIndex = computerTurnOrder[turnIndex]

    if (playerIndex === undefined) {
      computerTurnTimers.current = []
      return
    }

    const timer = window.setTimeout(() => {
      const nextPlayerIndex = computerTurnOrder[turnIndex + 1] ?? 0

      setRoundState((current) =>
        playComputerTurn(current, playerIndex, nextPlayerIndex),
      )

      scheduleComputerTurns(turnIndex + 1)
    }, computerTurnDelayMs)

    computerTurnTimers.current.push(timer)
  }

  useEffect(() => {
    return () => clearComputerTurnTimers()
  }, [])

  useEffect(() => {
    if (snapshot.activePlayerId === snapshot.players[3]?.id && turnPhase === 'draw') {
      scheduleComputerTurns()
    }
  }, [snapshot.activePlayerId, snapshot.players, turnPhase])

  function startNewGame() {
    clearComputerTurnTimers()
    setDraggedSlotIndex(null)
    setFlippedOkeyIds(new Set())
    setRackArrangeMode(null)
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

  function arrangeMyRack(mode: 'runs' | 'pairs') {
    setDraggedSlotIndex(null)
    setRackArrangeMode(mode)
    setRoundState((current) => {
      const myTiles = getFilledRackTiles(current.myRackSlots)
      const groups =
        mode === 'runs'
          ? findSerialGroups(myTiles, current.snapshot.okeyTile)
          : findPairGroups(myTiles, current.snapshot.okeyTile)
      const groupedTileIds = new Set(
        groups.flatMap((group) => group.tiles).map((tile) => tile.id),
      )
      const remainingTiles = myTiles.filter((tile) => !groupedTileIds.has(tile.id))

      return {
        ...current,
        myRackSlots: createSlotsFromGroups(groups, remainingTiles),
      }
    })
  }

  function drawFromPile() {
    setRoundState((current) => {
      const isCurrentMyTurn =
        current.snapshot.activePlayerId === current.snapshot.players[0]?.id

      if (
        !isCurrentMyTurn ||
        current.turnPhase !== 'draw' ||
        current.snapshot.drawPile.length === 0
      ) {
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
        temporaryTakenDiscard: null,
        turnPhase: 'discard',
        message: 'Tas cektin. Simdi elinden bir tas atmalisin.',
      }
    })
  }

  function takeDiscardedTile(ownerIndex: number) {
    setRoundState((current) => {
      const isCurrentMyTurn =
        current.snapshot.activePlayerId === current.snapshot.players[0]?.id

      if (!isCurrentMyTurn || current.turnPhase !== 'draw' || ownerIndex === 0) {
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
          activePlayerId:
            current.snapshot.players[0]?.id ?? current.snapshot.activePlayerId,
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
        temporaryTakenDiscard: {
          ownerIndex,
          tile: takenTile,
        },
        turnPhase: 'discard',
        message: `${current.snapshot.players[ownerIndex]?.name} attigi tasi gecici aldin. Istersen geri birakabilirsin.`,
      }
    })
  }

  function returnTemporaryDiscardedTile() {
    setRoundState((current) => {
      const temporaryTakenDiscard = current.temporaryTakenDiscard
      const temporaryTile = temporaryTakenDiscard?.tile

      if (!temporaryTile) {
        return current
      }

      const slotIndex = current.myRackSlots.findIndex(
        (tile) => tile?.id === temporaryTile.id,
      )

      if (slotIndex < 0) {
        return {
          ...current,
          temporaryTakenDiscard: null,
        }
      }

      const nextSlots = [...current.myRackSlots]
      nextSlots[slotIndex] = null

      const myTiles = getFilledRackTiles(nextSlots)
      const snapshot = updatePlayerTiles(
        {
          ...current.snapshot,
          activePlayerId:
            current.snapshot.players[0]?.id ?? current.snapshot.activePlayerId,
          discardPile: [...current.snapshot.discardPile, temporaryTile],
        },
        0,
        myTiles,
      )

      return {
        ...current,
        snapshot,
        discardOwners: [...current.discardOwners, temporaryTakenDiscard.ownerIndex],
        myRackSlots: nextSlots,
        temporaryTakenDiscard: null,
        turnPhase: 'draw',
        message: 'Tasi geri biraktin. Simdi ortadan tas cekebilirsin.',
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
        temporaryTakenDiscard: null,
        turnPhase: 'draw' as const,
        message: `${getTileLabel(discardedTile)} attin. Rakipler oynuyor.`,
      }

      return nextRound
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
            <strong>Sira sende.</strong>
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
              <span className="stack-card top">
                <span className="draw-pile-count">{snapshot.drawPile.length}</span>
              </span>
              <strong>Kapali cek</strong>
            </button>

            <div className="center-tile center-tile--small">
              <span>Gosterge</span>
              {getIndicatorTileImage() ? (
                <img
                  src={getIndicatorTileImage() ?? undefined}
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
            const canTakeThisDiscard =
              !isMyRack && isMyTurn && turnPhase === 'draw' && Boolean(playerDiscardTile)
            const playerTiles = isMyRack ? myTiles : player.tiles
            const openedGroups = isMyRack
              ? findRackSerialGroups(myRackSlots, snapshot.okeyTile)
              : findSerialGroups(playerTiles, snapshot.okeyTile)
            const openedTotal = getGroupsTotal(openedGroups)
            const canOpenToTable = openedTotal >= 101

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
                    <div className="rack-meta">
                      <p>
                        {isMyRack
                          ? myRackSlots.filter(Boolean).length
                          : player.tiles.length}{' '}
                        tas
                      </p>
                      {isMyRack ? (
                        <span
                          className={`hand-value-pill ${
                            rackArrangeMode === 'runs'
                              ? hasPassedSerialTarget
                                ? 'success'
                                : 'warning'
                              : hasPassedPairTarget
                              ? 'success'
                              : 'warning'
                          }`}
                        >
                          {handValueLabel}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span
                    className={`status-pill ${
                      isMyRack &&
                      (rackArrangeMode === 'runs'
                        ? hasPassedSerialTarget
                        : rackArrangeMode === 'pairs'
                          ? hasPassedPairTarget
                          : false)
                        ? 'success'
                        : 'warning'
                    }`}
                  >
                    {isMyRack
                      ? rackArrangeMode === null
                        ? 'Hesap yok'
                        : rackArrangeMode === 'runs'
                          ? getOpeningStatusLabel(hasPassedSerialTarget)
                          : hasPassedPairTarget
                            ? 'Cift tamam'
                            : 'Cift eksik'
                      : 'Kapali el'}
                  </span>
                </div>

                {isMyRack ? (
                  <div className="my-rack-area">
                    <div className="rack-sort-actions" aria-label="Istaka dizme">
                      <button
                        type="button"
                        onClick={() => arrangeMyRack('runs')}
                      >
                        Seri
                      </button>
                      <button
                        type="button"
                        onClick={() => arrangeMyRack('pairs')}
                      >
                        Çift
                      </button>
                    </div>

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
                              <>
                                <button
                                  className={`tile tile--draggable ${
                                    draggedSlotIndex === slotIndex ? 'is-dragging' : ''
                                  }`}
                                  draggable
                                  type="button"
                                  onDoubleClick={() => {
                                    if (!isOkeyTile(tile, snapshot.okeyTile)) {
                                      return
                                    }

                                    setFlippedOkeyIds((current) => {
                                      const next = new Set(current)

                                      if (next.has(tile.id)) {
                                        next.delete(tile.id)
                                      } else {
                                        next.add(tile.id)
                                      }

                                      return next
                                    })
                                  }}
                                  onClick={() => {
                                    if (canDiscard) {
                                      setDraggedSlotIndex((current) =>
                                        current === slotIndex ? null : slotIndex,
                                      )
                                    }
                                  }}
                                  onDragStart={() => setDraggedSlotIndex(slotIndex)}
                                  onDragEnd={() => setDraggedSlotIndex(null)}
                                >
                                  {flippedOkeyIds.has(tile.id) ? (
                                    <span className="okey-back" />
                                  ) : tileImage ? (
                                    <img src={tileImage} alt={getTileLabel(tile)} />
                                  ) : (
                                    <span>{getTileLabel(tile)}</span>
                                  )}
                                </button>

                                {tile.id === temporaryTakenDiscard?.tile.id ? (
                                  <button
                                    className="return-tile-button"
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      returnTemporaryDiscardedTile()
                                    }}
                                  >
                                    Geri birak
                                  </button>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="opponent-rack-line" aria-hidden="true" />
                )}

                {canOpenToTable ? (
                  <div
                    className={`opened-melds opened-melds--${position}`}
                    aria-label={`${player.name} acilan perleri`}
                  >
                    {openedGroups.map((group) => (
                      <div
                        className="opened-group"
                        key={group.tiles.map((tile) => tile.id).join('-')}
                      >
                        {group.tiles.map((tile) => {
                          const tileImage = getTileImage(tile)

                          return (
                            <div
                              className={`opened-tile ${
                                isOkeyTile(tile, snapshot.okeyTile)
                                  ? 'opened-tile--okey'
                                  : ''
                              }`}
                              key={tile.id}
                            >
                              {isOkeyTile(tile, snapshot.okeyTile) &&
                              flippedOkeyIds.has(tile.id) ? (
                                <span className="okey-back" />
                              ) : tileImage ? (
                                <img src={tileImage} alt={getTileLabel(tile)} />
                              ) : (
                                <span>{getTileLabel(tile)}</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                ) : null}

                <button
                  className={`player-discard player-discard--${position} player-discard--owner-${index} ${
                    playerDiscardTile ? 'has-tile' : ''
                  }`}
                  disabled={
                    isMyRack
                      ? !canDiscard
                      : !canTakeThisDiscard
                  }
                  type="button"
                  aria-label={
                    isMyRack
                      ? 'Tas atma alani'
                      : playerDiscardTile
                      ? `${player.name} attigi tasi al`
                      : `${player.name} atik tas alani`
                  }
                  onClick={() => {
                    if (isMyRack && canDiscard && draggedSlotIndex !== null) {
                      discardMyTile(draggedSlotIndex)
                      return
                    }

                    if (canTakeThisDiscard) {
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
