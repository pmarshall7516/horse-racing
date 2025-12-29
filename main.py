import random
from collections import defaultdict

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from dice import Deck
from env import HorseRacingEnv
from player import Player

USERIN = False


def count_cards(player, value):
    return sum(1 for card in player.hand if getattr(card, "value", None) == value)


def purge_broke_players(players, current_idx):
    alive = [p for p in players if p.tokens > 0]
    if not alive:
        return [], 0
    current_player = players[current_idx] if players and current_idx < len(players) else None
    if current_player and current_player in alive:
        new_idx = alive.index(current_player)
    else:
        new_idx = current_idx % len(alive)
    return alive, new_idx


def distribute_pot(pot, winners_with_counts):
    """Split pot proportionally by card counts; return payouts dict and leftover."""
    total_cards = sum(count for _, count in winners_with_counts)
    if total_cards == 0 or pot == 0:
        return {}, pot
    share_per_card = pot // total_cards
    remainder = pot % total_cards
    payouts = {}
    for player, count in winners_with_counts:
        payout = share_per_card * count
        if remainder > 0:
            extra = min(count, remainder)
            payout += extra
            remainder -= extra
        payouts[player] = payout
    leftover = pot - sum(payouts.values())
    return payouts, leftover


def play_round(env, active_players, starting_idx=0):
    """Plays a full round, mutating players and env. Returns (winner_horse, next_start_idx, active_players)."""
    env.reset()
    deck = Deck()
    deck.deal_evenly(active_players)
    pot = 0
    current_idx = starting_idx % len(active_players) if active_players else 0

    # Stabling phase: first 4 unique horses
    while env.stabled_count < 4 and active_players:
        roller = active_players[current_idx]
        horse = env.roll()
        if env.is_stabled(horse):
            fee = env.stabling_fee(horse) or 0
            pot += roller.pay(fee)
        else:
            env.stable(horse)
            fee = env.stabling_fee(horse) or 0
            for player in list(active_players):
                discarded = player.discard_cards(horse)
                if discarded:
                    pot += player.pay(discarded * fee)
        active_players, current_idx = purge_broke_players(active_players, current_idx)
        if not active_players:
            return None, 0, active_players
        current_idx = (current_idx + 1) % len(active_players)

    # Race phase
    winner_horse = None
    while active_players:
        roller = active_players[current_idx]
        horse = env.roll()
        if env.is_stabled(horse):
            fee = env.stabling_fee(horse) or 0
            pot += roller.pay(fee)
        else:
            env.advance(horse)
            if env.has_won(horse):
                winner_horse = horse
                winners_with_counts = []
                for player in active_players:
                    cnt = count_cards(player, horse)
                    if cnt:
                        winners_with_counts.append((player, cnt))
                        player.discard_cards(horse)
                payouts, leftover = distribute_pot(pot, winners_with_counts)
                for player, amount in payouts.items():
                    player.win_pot(amount)
                pot = 0  # pot resets after award
                break

        active_players, current_idx = purge_broke_players(active_players, current_idx)
        if not active_players:
            return winner_horse, 0, active_players
        current_idx = (current_idx + 1) % len(active_players)

    active_players, current_idx = purge_broke_players(active_players, current_idx)
    return winner_horse, current_idx, active_players


def plot_history(token_history, rounds_played, path="token_history.png"):
    if rounds_played == 0:
        return None
    plt.figure(figsize=(10, 6))
    xs = list(range(1, rounds_played + 1))
    for player_num, totals in token_history.items():
        if len(totals) < rounds_played:
            totals = totals + [totals[-1]] * (rounds_played - len(totals))
        plt.plot(xs, totals, label=f"Player {player_num}")
    plt.xlabel("Round")
    plt.ylabel("Tokens")
    plt.title("Horse Racing Token Totals")
    plt.legend()
    plt.tight_layout()
    plt.savefig(path)
    return path


def main(players=4, rounds=100, seed=None):
    if seed is not None:
        random.seed(seed)
    all_players = [Player(idx + 1) for idx in range(players)]
    token_history = defaultdict(list)
    env = HorseRacingEnv()
    active_players = list(all_players)
    start_idx = 0
    rounds_played = 0

    for round_num in range(1, rounds + 1):
        if len(active_players) < 2:
            break
        for player in active_players:
            player.reset(full=False)
        winner, next_start, active_players = play_round(env, active_players, start_idx)
        start_idx = next_start if active_players else 0
        for player in all_players:
            token_history[player.num].append(player.tokens)
        active_players = [p for p in active_players if p.tokens > 0]
        rounds_played += 1
        # optional verbose summary could go here

    chart_path = plot_history(token_history, rounds_played)
    return {
        "rounds_played": rounds_played,
        "token_history": token_history,
        "chart_path": chart_path,
        "remaining_players": [p.num for p in active_players],
    }


if __name__ == "__main__":
    if USERIN:
        players = int(input("Enter number of players: "))
        rounds = int(input("Enter number of rounds: "))
    else:
        players = 4
        rounds = 100

    results = main(players=players, rounds=rounds)
    print(f"Rounds played: {results['rounds_played']}")
    print(f"Remaining players: {results['remaining_players']}")
    print(f"Chart saved to: {results['chart_path']}")
