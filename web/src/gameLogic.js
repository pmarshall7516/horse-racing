export const BOARD = {
  2: 3,
  3: 6,
  4: 8,
  5: 11,
  6: 14,
  7: 17,
  8: 14,
  9: 11,
  10: 8,
  11: 6,
  12: 3,
};

const SUITS = ["Hearts", "Diamonds", "Clubs", "Spades"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q"];

const DEFAULTS = {
  players: 4,
  startingTokens: 100,
  rounds: 100,
  decks: 1,
  feeMultiplier: 1,
  noCap: false,
  seed: null,
};

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildDeck(deckCount = 1) {
  const deck = [];
  for (let d = 0; d < deckCount; d += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        const value = rank === "J" ? 11 : rank === "Q" ? 12 : Number(rank);
        deck.push({ suit, rank, value });
      }
    }
  }
  return deck;
}

function shuffle(deck, rand) {
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function dealEvenly(deck, players) {
  let idx = 0;
  while (deck.length) {
    const card = deck.pop();
    players[idx % players.length].hand.push(card);
    idx += 1;
  }
}

function discardCards(hand, value) {
  const keep = [];
  let removed = 0;
  for (const card of hand) {
    if (card.value === value) {
      removed += 1;
    } else {
      keep.push(card);
    }
  }
  return { hand: keep, removed };
}

function countCards(hand, value) {
  return hand.reduce((acc, c) => (c.value === value ? acc + 1 : acc), 0);
}

function stablingFee(horse, stabled) {
  const idx = stabled.indexOf(horse);
  return idx >= 0 ? idx + 1 : null;
}

function distributePot(pot, winnersWithCounts) {
  const totalCards = winnersWithCounts.reduce((acc, [, count]) => acc + count, 0);
  if (totalCards === 0 || pot === 0) return { payouts: [], leftover: pot };
  const sharePer = Math.floor(pot / totalCards);
  const payouts = winnersWithCounts.map(([player, count]) => [player, sharePer * count]);
  const distributed = payouts.reduce((acc, [, amt]) => acc + amt, 0);
  const leftover = pot - distributed;
  return { payouts, leftover };
}

function rollDice(rand) {
  const d1 = Math.floor(rand() * 6) + 1;
  const d2 = Math.floor(rand() * 6) + 1;
  return { d1, d2, sum: d1 + d2 };
}

export class GameEngine {
  constructor(config = {}) {
    this.config = { ...DEFAULTS, ...config };
    this.rand = typeof this.config.seed === "number" ? mulberry32(this.config.seed) : Math.random;
    this.resetGame();
  }

  resetGame() {
    this.players = Array.from({ length: this.config.players }, (_, idx) => ({
      id: idx + 1,
      tokens: this.config.startingTokens,
      hand: [],
      eliminated: false,
    }));
    this.round = 1;
    this.stage = "idle"; // idle | stabling | race | done
    this.pot = 0;
    this.currentIdx = 0;
    this.stabled = [];
    this.state = { ...BOARD };
    this.progress = {};
    this.deck = [];
    this.history = Object.fromEntries(this.players.map((p) => [p.id, [p.tokens]]));
    this.lastEvent = "Ready to start.";
    this.lastRoll = null;
  }

  activePlayers() {
    return this.players.filter((p) => !p.eliminated);
  }

  startRound() {
    const alive = this.activePlayers();
    if (alive.length < 2) {
      this.stage = "done";
      this.lastEvent = "Simulation ended: fewer than two players.";
      return;
    }
    this.deck = buildDeck(this.config.decks);
    shuffle(this.deck, this.rand);
    this.players.forEach((p) => {
      p.hand = [];
    });
    dealEvenly(this.deck, alive);
    this.stabled = [];
    this.pot = 0;
    this.state = { ...BOARD };
    this.progress = Object.fromEntries(Object.keys(BOARD).map((k) => [Number(k), 0]));
    this.stage = "stabling";
    this.lastEvent = `Round ${this.round} started.`;
    this.currentIdx = this.currentIdx % alive.length;
  }

  eliminateBroke() {
    this.players.forEach((p) => {
      if (!p.eliminated && p.tokens <= 0) {
        p.tokens = 0;
        p.eliminated = true;
      }
    });
  }

  recordCurrentTokensIfChanged() {
    const changed = this.players.some((p) => {
      const arr = this.history[p.id];
      return !arr || arr[arr.length - 1] !== p.tokens;
    });
    if (changed) {
      this.players.forEach((p) => {
        this.history[p.id].push(p.tokens);
      });
    }
  }

  pay(player, amount) {
    const before = player.tokens;
    player.tokens = Math.max(0, player.tokens - amount);
    return before - player.tokens;
  }

  recordHistory() {
    this.players.forEach((p) => {
      this.history[p.id].push(p.tokens);
    });
  }

  stepStabling() {
    const alive = this.activePlayers();
    if (alive.length === 0) {
      this.stage = "done";
      return;
    }
    const roller = alive[this.currentIdx];
    const roll = rollDice(this.rand);
    const horse = roll.sum;
    this.lastRoll = roll;
    if (this.stabled.includes(horse)) {
      const fee = (stablingFee(horse, this.stabled) || 0) * this.config.feeMultiplier;
      this.pot += this.pay(roller, fee);
      this.lastEvent = `P${roller.id} rolled ${horse} (stabled) and paid ${fee} to pot.`;
    } else {
      this.stabled.push(horse);
      this.progress[horse] = -1;
      const fee = (stablingFee(horse, this.stabled) || 0) * this.config.feeMultiplier;
      let total = 0;
      this.players.forEach((player) => {
        if (player.eliminated) return;
        const { hand, removed } = discardCards(player.hand, horse);
        player.hand = hand;
        if (removed > 0) {
          total += this.pay(player, removed * fee);
        }
      });
      this.pot += total;
      this.lastEvent = `P${roller.id} rolled ${horse}. Horse stabled #${this.stabled.length}; everyone paid ${fee} per card (${total} to pot).`;
      if (this.stabled.length >= 4) {
        this.stage = "race";
        this.lastEvent += " Race begins.";
      }
    }
    this.eliminateBroke();
    const aliveAfter = this.activePlayers();
    if (aliveAfter.length < 2) {
      this.recordCurrentTokensIfChanged();
      this.stage = "done";
      this.lastEvent = "Simulation ended: fewer than two players.";
      return;
    }
    this.currentIdx = (this.currentIdx + 1) % aliveAfter.length;
  }

  stepRace() {
    const alive = this.activePlayers();
    if (alive.length < 2) {
      this.stage = "done";
      this.lastEvent = "Simulation ended: fewer than two players.";
      return;
    }
    const roller = alive[this.currentIdx];
    const roll = rollDice(this.rand);
    const horse = roll.sum;
    this.lastRoll = roll;
    if (this.stabled.includes(horse)) {
      const fee = (stablingFee(horse, this.stabled) || 0) * this.config.feeMultiplier;
      this.pot += this.pay(roller, fee);
      this.lastEvent = `P${roller.id} hit stabled ${horse} and paid ${fee}.`;
    } else {
      this.progress[horse] += 1;
      const needed = this.state[horse];
      if (this.progress[horse] >= needed) {
        // winner found
        const winners = [];
        this.players.forEach((player) => {
          if (player.eliminated) return;
          const count = countCards(player.hand, horse);
          if (count > 0) {
            winners.push([player, count]);
            const { hand } = discardCards(player.hand, horse);
            player.hand = hand;
          }
        });
        const { payouts } = distributePot(this.pot, winners);
        payouts.forEach(([player, amount]) => {
          player.tokens += amount;
        });
        const winnerIds = payouts.map(([p]) => `P${p.id}`).join(", ") || "no one";
        this.lastEvent = `Horse ${horse} wins! Pot paid to ${winnerIds}.`;
        this.pot = 0;
        this.stage = "round-complete";
        this.recordHistory();
        this.round += 1;
        this.eliminateBroke();
        return;
      } else {
        this.lastEvent = `P${roller.id} rolled ${horse}; progress ${this.progress[horse]}/${needed}.`;
      }
    }
    this.eliminateBroke();
    const aliveAfter = this.activePlayers();
    if (aliveAfter.length < 2) {
      this.recordCurrentTokensIfChanged();
      this.stage = "done";
      this.lastEvent = "Simulation ended: fewer than two players.";
      return;
    }
    this.currentIdx = (this.currentIdx + 1) % aliveAfter.length;
  }

  maybeStartNextRound() {
    const capReached = !this.config.noCap && this.round > this.config.rounds;
    if (capReached || this.activePlayers().length < 2) {
      this.recordCurrentTokensIfChanged();
      this.stage = "done";
      this.lastEvent = capReached ? "Round cap reached." : "Simulation ended: fewer than two players.";
      return;
    }
    this.startRound();
  }

  tick() {
    if (this.stage === "done") {
      return this.snapshot();
    }
    if (this.stage === "idle" || this.stage === "round-complete") {
      this.maybeStartNextRound();
      return this.snapshot();
    }
    if (this.stage === "stabling") {
      this.stepStabling();
    } else if (this.stage === "race") {
      this.stepRace();
      if (this.stage === "round-complete") {
        // auto proceed check
        this.maybeStartNextRound();
      }
    }
    return this.snapshot();
  }

  snapshot() {
    return {
      round: this.stage === "round-complete" ? this.round - 1 : this.round,
      stage: this.stage,
      players: this.players.map((p) => ({
        id: p.id,
        tokens: p.tokens,
        eliminated: p.eliminated,
        hand: p.hand.map((c) => ({ rank: c.rank, suit: c.suit, value: c.value })),
      })),
      board: { ...this.state },
      progress: { ...this.progress },
      stabled: [...this.stabled],
      pot: this.pot,
      lastEvent: this.lastEvent,
      history: this.history,
      lastRoll: this.lastRoll,
    };
  }
}

export const defaults = DEFAULTS;
