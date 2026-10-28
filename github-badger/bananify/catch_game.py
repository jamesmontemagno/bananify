"""Banana Catch: a firmware-free model of one 60-second round."""

import math
import random

ROUND_SECONDS = 60.0
STEP = 1 / 60
MAX_FRAME = 0.5

LEFT_EDGE = 24
RIGHT_EDGE = 296
GROUND = 204
SPAWN_Y = 46

RUN_SPEED = 135
DASH_SPEED = 390
DASH_TIME = 0.17
DASH_COOLDOWN = 1.2
GRAVITY = 900
JUMP_HEIGHT = 66
JUMP_SPEED = math.sqrt(2 * GRAVITY * JUMP_HEIGHT)

# Catch box: hands and head of the in-game sprite, relative to the feet.
CATCH_HALF = 22
CATCH_TOP = 64
CATCH_BOTTOM = 30
BANANA_RADIUS = 8

BONUS_SPEED = 72
BONUS_WARNING = 1.0
BONUS_Y = 100
BONUS_RADIUS = 12
BONUS_INTERVAL = (9.0, 13.0)
MAX_BANANAS = 5

# (seconds elapsed at stage start, spawn interval, fall speed)
STAGES = ((0, 1.25, 58), (20, 0.95, 74), (40, 0.75, 92))

ORDINARY_POINTS = 10
BONUS_POINTS = 30
BONUS_BANANAS = 3


def multiplier(streak):
    return min(5, 1 + max(0, streak - 1) // 5)


class Round:
    def __init__(self, rng=None):
        self.rng = rng or random
        self.x = 160.0
        self.height = 0.0
        self.vy = 0.0
        self.facing = 1
        self.dash_time = 0.0
        self.dash_dir = 1
        self.cooldown = 0.0
        self.elapsed = 0.0
        self.score = 0
        self.caught = 0
        self.missed = 0
        self.streak = 0
        self.best_combo = 0
        self.bananas = []
        self.bonus = None
        self.spawn_timer = 0.6
        self.bonus_timer = 7.0
        self.last_x = 160.0
        self.finished = False

    @property
    def time_left(self):
        return max(0.0, ROUND_SECONDS - self.elapsed)

    @property
    def stage(self):
        index = 0
        for i, (start, _, _) in enumerate(STAGES):
            if self.elapsed >= start:
                index = i
        return index

    @property
    def multiplier(self):
        return multiplier(self.streak)

    @property
    def dash_ready(self):
        return 1.0 - self.cooldown / DASH_COOLDOWN

    @property
    def airborne(self):
        return self.height > 0 or self.vy != 0

    def catch_box(self):
        feet = GROUND - self.height
        return (self.x - CATCH_HALF, feet - CATCH_TOP, self.x + CATCH_HALF, feet - CATCH_BOTTOM)

    def jump(self):
        if self.finished or self.airborne:
            return False
        self.vy = JUMP_SPEED
        return True

    def dash(self, direction):
        if self.finished or self.cooldown > 0:
            return False
        self.dash_dir = direction or self.facing
        self.facing = self.dash_dir
        self.dash_time = DASH_TIME
        self.cooldown = DASH_COOLDOWN
        return True

    def update(self, dt, direction=0, jump=False, dash=False):
        """Advance the round; direction is -1, 0 or 1. Returns catch/miss events."""
        events = []
        if self.finished:
            return events
        if direction:
            self.facing = direction
        if jump:
            self.jump()
        if dash:
            self.dash(direction)
        remaining = min(max(0.0, dt), MAX_FRAME)
        while remaining > 1e-9 and not self.finished:
            step = min(STEP, remaining, ROUND_SECONDS - self.elapsed)
            remaining -= step
            self._step(step, direction, events)
            if self.elapsed >= ROUND_SECONDS - 1e-9:
                self.elapsed = ROUND_SECONDS
                self.finished = True
        return events

    def _step(self, dt, direction, events):
        self.elapsed += dt
        self.cooldown = max(0.0, self.cooldown - dt)
        if self.dash_time > 0:
            self.dash_time = max(0.0, self.dash_time - dt)
            speed = DASH_SPEED * self.dash_dir
        else:
            speed = RUN_SPEED * direction
        self.x = max(LEFT_EDGE, min(RIGHT_EDGE, self.x + speed * dt))
        if self.airborne:
            self.height += self.vy * dt
            self.vy -= GRAVITY * dt
            if self.height <= 0:
                self.height = 0.0
                self.vy = 0.0

        left, top, right, bottom = self.catch_box()
        for banana in self.bananas[:]:
            previous = banana[1]
            banana[1] += banana[2] * dt
            inside_x = left - BANANA_RADIUS <= banana[0] <= right + BANANA_RADIUS
            # Swept vertical test so long steps cannot tunnel through the box.
            if inside_x and banana[1] + BANANA_RADIUS >= top and previous - BANANA_RADIUS <= bottom:
                self.bananas.remove(banana)
                self._catch(banana[0], banana[1], False, events)
            elif banana[1] - BANANA_RADIUS >= GROUND:
                self.bananas.remove(banana)
                self.missed += 1
                self.streak = 0
                events.append(("miss", banana[0], GROUND, 0))

        bonus = self.bonus
        if bonus is not None:
            if bonus["warning"] > 0:
                bonus["warning"] = max(0.0, bonus["warning"] - dt)
            else:
                bonus["x"] += bonus["dir"] * BONUS_SPEED * dt
                span = (bonus["x"] - LEFT_EDGE) / (RIGHT_EDGE - LEFT_EDGE)
                bonus["y"] = BONUS_Y - math.sin(max(0.0, min(1.0, span)) * math.pi) * 14
                if (left - BONUS_RADIUS <= bonus["x"] <= right + BONUS_RADIUS
                        and top - BONUS_RADIUS <= bonus["y"] <= bottom + BONUS_RADIUS):
                    self.bonus = None
                    self._catch(bonus["x"], bonus["y"], True, events)
                elif bonus["x"] < -20 or bonus["x"] > 340:
                    self.bonus = None
                    events.append(("bonus_gone", bonus["x"], bonus["y"], 0))
        else:
            self.bonus_timer -= dt
            if self.bonus_timer <= 0 and self.time_left > 6:
                self._spawn_bonus()

        _, interval, fall = STAGES[self.stage]
        self.spawn_timer -= dt
        if self.spawn_timer <= 0:
            # Reset rather than accumulate, so a stall never releases a backlog.
            self.spawn_timer = interval
            if len(self.bananas) < MAX_BANANAS:
                self._spawn_banana(interval, fall)

    def _spawn_banana(self, interval, fall):
        reach = RUN_SPEED * (interval + (GROUND - CATCH_BOTTOM - SPAWN_Y) / fall) * 0.7
        low = max(LEFT_EDGE + 8, self.last_x - reach)
        high = min(RIGHT_EDGE - 8, self.last_x + reach)
        x = self.rng.uniform(low, high)
        self.last_x = x
        self.bananas.append([x, float(SPAWN_Y), float(fall)])

    def _spawn_bonus(self):
        direction = 1 if self.rng.random() < 0.5 else -1
        self.bonus = {"x": -16.0 if direction > 0 else 336.0, "y": float(BONUS_Y),
                      "dir": direction, "warning": BONUS_WARNING}
        self.bonus_timer = self.rng.uniform(*BONUS_INTERVAL)

    def _catch(self, x, y, bonus, events):
        self.streak += 1
        self.best_combo = max(self.best_combo, self.streak)
        points = (BONUS_POINTS if bonus else ORDINARY_POINTS) * self.multiplier
        self.score += points
        self.caught += BONUS_BANANAS if bonus else 1
        events.append(("bonus" if bonus else "catch", x, y, points))
