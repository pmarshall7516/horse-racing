
class Player:
    def __init__(self, num):
        self.num = num
        self.hand = []
        self.tokens = 1000

    def reset(self, full=False):
        self.hand = []
        if full:
            self.tokens = 100

    def pay(self, amount):
        bef = self.tokens
        self.tokens -= amount
        if self.tokens < 0:
            self.tokens = 0
        return bef - self.tokens
    
    def win_pot(self, amount):
        self.tokens += amount

    def discard_cards(self, value):
        """Remove all cards matching the provided value; return how many were discarded."""
        keep = []
        removed = 0
        for card in self.hand:
            if getattr(card, "value", None) == value:
                removed += 1
            else:
                keep.append(card)
        self.hand = keep
        return removed
