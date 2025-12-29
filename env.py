from dice import Dice

class HorseRacingEnv():
    def __init__(self):
        self.board = {2: 3, 
                      3: 6, 
                      4: 8, 
                      5: 11, 
                      6: 14,
                      7: 17,
                      8: 14,
                      9: 11,
                      10: 8,
                      11: 6,
                      12: 3}
        
        self.state = {2: 0, 
                      3: 0, 
                      4: 0, 
                      5: 0, 
                      6: 0,
                      7: 0,
                      8: 0,
                      9: 0,
                      10: 0,
                      11: 0,
                      12: 0}
        
        self.stabled_count = 0
        self.stabled_horses = {}

        self.d1 = Dice(sides=6)
        self.d2 = Dice(sides=6)

    def reset(self):
        self.board = {2: 3,3: 6,4: 8,5: 11,6: 14,7: 17,8: 14,9: 11,10: 8,11: 6,12: 3}
        self.state = {2: 0,3: 0,4: 0,5: 0,6: 0,7: 0,8: 0,9: 0,10: 0,11: 0,12: 0}
        self.stabled_count = 0
        self.stabled_horses = {}

    def roll(self):
        return self.d1.roll() + self.d2.roll()

    def stable(self, horse):
        if self.is_stabled(horse):
            return
        self.stabled_count += 1
        self.stabled_horses[self.stabled_count] = horse
        self.state[horse] = -1

    def is_stabled(self, horse):
        return self.state.get(horse, 0) == -1

    def stabling_fee(self, horse):
        for order, h in self.stabled_horses.items():
            if h == horse:
                return order
        return None

    def advance(self, horse):
        if self.is_stabled(horse):
            return
        self.state[horse] += 1

    def has_won(self, horse):
        if self.is_stabled(horse):
            return False
        return self.state[horse] >= self.board[horse]
