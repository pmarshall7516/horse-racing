import random

class Dice:
    def __init__(self, sides=6):
        self.sides = sides

    def roll(self):
        return random.randint(1, self.sides)
    
class Card:
    def __init__(self, rank, suit):
        self.rank = rank
        self.suit = suit
        self.value = self.assign_value()

    def assign_value(self):
        if self.rank == 'J':
            return 11
        elif self.rank == 'Q':
            return 12
        else:
            return int(self.rank)
        
class Deck:
    def __init__(self):
        self.cards = self.create_deck()
        self.shuffle()

    def create_deck(self):
        suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades']
        ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q']
        return [Card(rank, suit) for suit in suits for rank in ranks]

    def shuffle(self):
        random.shuffle(self.cards)

    def deal_card(self):
        return self.cards.pop() if self.cards else None

    def deal_evenly(self, players):
        """Deal remaining cards round-robin to the provided players."""
        if not players:
            return
        idx = 0
        while self.cards:
            players[idx % len(players)].hand.append(self.deal_card())
            idx += 1
