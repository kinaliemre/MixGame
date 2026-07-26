export type TileColor = 'Kirmizi' | 'Mavi' | 'Siyah' | 'Sari'

export type Tile = {
  id: string
  number: number
  color: TileColor
  fakeJoker?: boolean
}

export type Combo = {
  type: 'run' | 'set'
  tiles: Tile[]
  total: number
}

export type Player = {
  id: string
  name: string
  isDealer: boolean
  tiles: Tile[]
  analysis: {
    total: number
    canOpen: boolean
    combos: Combo[]
  }
}

export type GameSnapshot = {
  indicator: Tile
  indicatorLabel: string
  okeyTile: Tile
  okeyLabel: string
  activePlayerId: string
  players: Player[]
  drawPile: Tile[]
  discardPile: Tile[]
  initialDiscardOwnerIndex: number | null
}

export const colors: TileColor[] = ['Kirmizi', 'Mavi', 'Siyah', 'Sari']

export const upcomingGames = [
  {
    name: 'Sudoku',
    description: 'Ileride ayni panel icinde acilabilecek mantik oyunu.',
  },
  {
    name: 'Batak',
    description: 'Kart tabanli ikinci cok oyunculu masa oyunu icin alan.',
  },
]

export const ruleHighlights = [
  {
    title: 'Acilis esigi',
    description:
      'Oyuncu masaya ilk kez inerken gecerli seri ve ayni sayi gruplariyla en az 101 puan acmalidir.',
  },
  {
    title: 'Seri mantigi',
    description:
      'Ayni renk icinde ardısık en az uc tas seri sayilir. Ornek: Kirmizi 7-8-9.',
  },
  {
    title: 'Ayni sayi grubu',
    description:
      'Farkli renklerde ayni sayiya sahip en az uc tas grup olusturur. Ornek: 10-10-10.',
  },
  {
    title: 'Okey kullanimi',
    description:
      'Gostergeye gore belirlenen okey eksik tasi tamamlamak icin joker gibi kullanilabilir.',
  },
]

const playerNames = ['Sen', 'Bilgisayar 1', 'Bilgisayar 2', 'Bilgisayar 3']

const tileImages = import.meta.glob('../assets/tiles/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>

function shuffle<T>(items: T[]) {
  const copy = [...items]

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }

  return copy
}

function buildDeck() {
  const deck: Tile[] = []

  for (let setIndex = 1; setIndex <= 2; setIndex += 1) {
    for (const color of colors) {
      for (let number = 1; number <= 13; number += 1) {
        deck.push({
          id: `${color}-${number}-${setIndex}`,
          number,
          color,
        })
      }
    }
  }

  deck.push({
    id: 'fake-joker-1',
    number: 0,
    color: 'Sari',
    fakeJoker: true,
  })
  deck.push({
    id: 'fake-joker-2',
    number: 0,
    color: 'Sari',
    fakeJoker: true,
  })

  return shuffle(deck)
}

function getNextTile(tile: Tile) {
  if (tile.fakeJoker) {
    return {
      color: 'Sari' as TileColor,
      number: 1,
    }
  }

  return {
    color: tile.color,
    number: tile.number === 13 ? 1 : tile.number + 1,
  }
}

export function getTileLabel(tile: Tile) {
  if (tile.fakeJoker) {
    return 'Sahte Okey'
  }

  return `${tile.color} ${tile.number}`
}

export function getTileStyle(tile: Tile) {
  const palette: Record<TileColor, { background: string; color: string }> = {
    Kirmizi: { background: '#fde2df', color: '#9f2f1c' },
    Mavi: { background: '#ddeafe', color: '#1f4fa7' },
    Siyah: { background: '#e5e7eb', color: '#111827' },
    Sari: { background: '#fff2c7', color: '#8a6400' },
  }

  return palette[tile.color]
}

export function getTileImage(tile: Tile) {
  if (tile.fakeJoker) {
    const jokerVariant = tile.id.endsWith('2') ? '2' : '1'
    return tileImages[`../assets/tiles/title_joker_${jokerVariant}.png`] ?? null
  }

  const colorMap: Record<TileColor, string> = {
    Kirmizi: 'red',
    Mavi: 'blue',
    Siyah: 'black',
    Sari: 'green',
  }

  return tileImages[
    `../assets/tiles/title_${colorMap[tile.color]}_${tile.number}.png`
  ] ?? null
}

function sortTiles(tiles: Tile[]) {
  return [...tiles].sort((left, right) => {
    if (left.color === right.color) {
      return left.number - right.number
    }

    return colors.indexOf(left.color) - colors.indexOf(right.color)
  })
}

function findRunCombos(tiles: Tile[]) {
  const combos: Combo[] = []

  for (const color of colors) {
    const colorTiles = sortTiles(
      tiles.filter((tile) => !tile.fakeJoker && tile.color === color),
    )

    let run: Tile[] = []

    for (const tile of colorTiles) {
      const previous = run.at(-1)

      if (!previous || tile.number === previous.number + 1) {
        run.push(tile)
      } else if (tile.number !== previous.number) {
        if (run.length >= 3) {
          combos.push({
            type: 'run',
            tiles: [...run],
            total: run.reduce((sum, current) => sum + current.number, 0),
          })
        }

        run = [tile]
      }
    }

    if (run.length >= 3) {
      combos.push({
        type: 'run',
        tiles: [...run],
        total: run.reduce((sum, current) => sum + current.number, 0),
      })
    }
  }

  return combos
}

function findSetCombos(tiles: Tile[]) {
  const grouped = new Map<number, Tile[]>()

  for (const tile of tiles) {
    if (tile.fakeJoker) {
      continue
    }

    const existing = grouped.get(tile.number) ?? []
    const duplicateColor = existing.some((item) => item.color === tile.color)

    if (!duplicateColor) {
      existing.push(tile)
      grouped.set(tile.number, existing)
    }
  }

  return [...grouped.entries()]
    .filter(([, groupTiles]) => groupTiles.length >= 3)
    .map(([number, groupTiles]) => ({
      type: 'set' as const,
      tiles: groupTiles,
      total: number * groupTiles.length,
    }))
}

export function analyzeHand(tiles: Tile[]) {
  const combos = [...findRunCombos(tiles), ...findSetCombos(tiles)].sort(
    (left, right) => right.total - left.total,
  )

  const selected: Combo[] = []
  const usedTileIds = new Set<string>()

  for (const combo of combos) {
    const hasUsedTile = combo.tiles.some((tile) => usedTileIds.has(tile.id))

    if (hasUsedTile) {
      continue
    }

    selected.push(combo)
    combo.tiles.forEach((tile) => usedTileIds.add(tile.id))
  }

  const total = selected.reduce((sum, combo) => sum + combo.total, 0)

  return {
    combos: selected,
    total,
    canOpen: total >= 101,
  }
}

export function getOpeningStatusLabel(canOpen: boolean) {
  return canOpen ? 'Acilisa hazir' : '101 altinda'
}

export function createInitialSnapshot(): GameSnapshot {
  const deck = buildDeck()
  const indicator = deck.pop()
  const dealerIndex = 0
  const firstDiscarderIndex = playerNames.length - 1

  if (!indicator) {
    throw new Error('Gosterge tasi olusturulamadi.')
  }

  const okey = getNextTile(indicator)

  const players = playerNames.map((name, index) => {
    const tileCount = index === firstDiscarderIndex ? 22 : 21
    const tiles = sortTiles(deck.splice(0, tileCount))

    return {
      id: `player-${index + 1}`,
      name,
      isDealer: index === dealerIndex,
      tiles,
      analysis: analyzeHand(tiles),
    }
  })

  const firstDiscarder = players[firstDiscarderIndex]
  const firstDiscardIndex =
    firstDiscarder.tiles.length > 0
      ? Math.floor(Math.random() * firstDiscarder.tiles.length)
      : -1
  const firstDiscard =
    firstDiscardIndex >= 0 ? firstDiscarder.tiles.splice(firstDiscardIndex, 1)[0] : null

  if (firstDiscard) {
    firstDiscarder.tiles = sortTiles(firstDiscarder.tiles)
    firstDiscarder.analysis = analyzeHand(firstDiscarder.tiles)
  }

  return {
    indicator,
    indicatorLabel: getTileLabel(indicator),
    okeyTile: {
      id: `okey-${okey.color}-${okey.number}`,
      number: okey.number,
      color: okey.color,
    },
    okeyLabel: `${okey.color} ${okey.number}`,
    activePlayerId: players[0].id,
    players,
    drawPile: deck,
    discardPile: firstDiscard ? [firstDiscard] : [],
    initialDiscardOwnerIndex: firstDiscard ? firstDiscarderIndex : null,
  }
}
