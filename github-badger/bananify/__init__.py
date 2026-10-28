"""A little more banana, a little less ordinary."""

import math
import os
import random
import sys

from badgeware import State

APP_DIR = "/system/apps/bananify"
os.chdir(APP_DIR)
sys.path.insert(0, APP_DIR)

from profile import Profile
import catch_game

badge.mode(HIRES | VSYNC)
screen.antialias = image.X2
screen.fill_rule = image.EVEN_ODD
screen.font = font.nope
W, H = screen.width, screen.height

CREAM = color.rgb(255, 246, 212)
YELLOW = color.rgb(255, 218, 53)
INK = color.rgb(62, 42, 30)
MUTED = color.rgb(142, 122, 91)
GREEN = color.rgb(40, 86, 55)
WHITE = color.rgb(255, 252, 237)
PINK = color.rgb(240, 128, 160)
NIGHT = color.rgb(25, 28, 48)
NAMES = ("Sebastian", "Mooch", "Henry")
SPECIES = ("BROWN CAPUCHIN", "BLACK & WHITE", "GOLDEN MONKEY")
MODES = ("GROVE", "DISCO", "BANANA RAIN", "ZEN")
HUB_ITEMS = ("BANANA CATCH", "PLAYGROUND", "GITHUB STATS")
CHEERS = (
    ("SMOOTH!", "SEBASTIAN SNAGS!", "STYLISH!"),
    ("NOM!", "MOOCH MUNCH!", "SNACK ATTACK!"),
    ("GOLDEN!", "HENRY HAS IT!", "SHINY SNACK!"),
)
COUNTERS = ("snacks", "best_score", "best_combo", "rounds", "game_bananas")

saved = {
    "monkey": 0, "mode": 0, "snacks": 0, "profile": None,
    "best_score": 0, "best_combo": 0, "rounds": 0, "game_bananas": 0,
}
State.load("bananify", saved)
for key, limit in (("monkey", 3), ("mode", 4)):
    if type(saved.get(key)) is not int or not 0 <= saved[key] < limit:
        saved[key] = 0
for key in COUNTERS:
    if type(saved.get(key)) is not int or not 0 <= saved[key] <= 999999:
        saved[key] = 0

sheets = [
    image.load("assets/monkey_" + variant + ".png").spritesheet(3, 1)
    for variant in ("brown", "black-and-white", "golden")
]
banana = image.load("assets/banana.png")
profile = Profile(saved["profile"])
view = "play"
paused = False
clock = 0.0
monkey_x = W * 0.5
jump = 0.0
jump_speed = 0.0
reaction = ""
reaction_time = 0.0
nap_time = 0.0
snack_streak = 0
spawn_time = 0.0
rain = []
confetti = []
save_error = False
last_buttons = set()
hub_choice = 0
pause_choice = 0
pause_reason = ""
countdown = 0.0
go_time = 0.0
game = None
round_saved = False
new_best = False
popups = []


def orientation():
    upside_down = getattr(badge, "upside_down", None)
    try:
        return bool(upside_down()) if upside_down else False
    except (OSError, RuntimeError):
        return False


last_orientation = orientation()


def persist():
    global save_error
    try:
        State.save("bananify", saved)
        save_error = False
    except OSError as error:
        save_error = True
        print("Bananify: could not save progress:", error)
    return not save_error


def box(x, y, width, height, radius, pen):
    screen.pen = pen
    screen.shape(shape.rounded_rectangle(x, y, width, height, radius))


def text(label, x, y, pen=INK, face=None):
    screen.font = face or font.nope
    screen.pen = pen
    screen.text(label, x, y)


def centered(label, y, pen=INK, face=None):
    screen.font = face or font.nope
    width, _ = screen.measure_text(label)
    text(label, (W - width) / 2, y, pen, face)


def burst(x, y, count=14):
    for _ in range(count):
        if len(confetti) < 56:
            confetti.append([
                x, y, random.uniform(-65, 65), random.uniform(-100, -35),
                random.uniform(0.6, 1.2), random.randrange(3),
            ])


def feed():
    global jump_speed, reaction, reaction_time, nap_time, snack_streak
    if nap_time > 0:
        nap_time = 0
        snack_streak = 0
        reaction = "BACK TO MONKEY BUSINESS!"
    else:
        saved["snacks"] = min(999999, saved["snacks"] + 1)
        snack_streak += 1
        reaction = ("BANANA? FOR ME?", "YOU'RE MY FAVORITE!", "SNACK. NAP. REPEAT.")[
            min(2, snack_streak - 1)
        ]
        if snack_streak >= 3:
            nap_time = 4.0
            snack_streak = 0
    reaction_time = 2.0
    jump_speed = 105 if saved["mode"] != 3 else 0
    burst(monkey_x, H - 91)
    persist()


def held_direction():
    return int(bool(badge.held(BUTTON_RIGHT))) - int(bool(badge.held(BUTTON_LEFT)))


def start_countdown():
    global view, countdown, game, round_saved, new_best
    game = catch_game.Round()
    round_saved = False
    new_best = False
    popups.clear()
    confetti.clear()
    countdown = 3.0
    view = "countdown"


def pause_game(reason=""):
    global view, pause_choice, pause_reason
    view = "pause"
    pause_choice = 0
    pause_reason = reason


def finish_round():
    """Record a completed round exactly once."""
    global view, round_saved, new_best
    view = "results"
    if round_saved:
        return
    round_saved = True
    new_best = game.score > saved["best_score"]
    saved["best_score"] = max(saved["best_score"], min(999999, game.score))
    saved["best_combo"] = max(saved["best_combo"], min(999999, game.best_combo))
    saved["rounds"] = min(999999, saved["rounds"] + 1)
    saved["game_bananas"] = min(999999, saved["game_bananas"] + game.caught)
    persist()


def cycle_monkey():
    saved["monkey"] = (saved["monkey"] + 1) % len(NAMES)
    persist()


def cycle_mode():
    saved["mode"] = (saved["mode"] + 1) % len(MODES)
    rain.clear()
    confetti.clear()
    persist()


def play_controls(pressed):
    global view, paused, nap_time, reaction, reaction_time, snack_streak, hub_choice
    if BUTTON_MENU in pressed:
        view = "hub"
        hub_choice = 0
        return
    if BUTTON_BACK in pressed:
        paused = not paused
    if BUTTON_UP in pressed:
        cycle_monkey()
        nap_time = 0
        snack_streak = 0
        reaction = "HELLO, " + NAMES[saved["monkey"]].upper() + "!"
        reaction_time = 2
    if BUTTON_DOWN in pressed:
        cycle_mode()
    if BUTTON_SELECT in pressed and not paused:
        feed()


def hub_controls(pressed):
    global view, hub_choice
    if BUTTON_UP in pressed:
        hub_choice = (hub_choice - 1) % len(HUB_ITEMS)
    if BUTTON_DOWN in pressed:
        hub_choice = (hub_choice + 1) % len(HUB_ITEMS)
    if BUTTON_SELECT in pressed:
        view = ("intro", "play", "stats")[hub_choice]
    elif BUTTON_BACK in pressed or BUTTON_MENU in pressed:
        view = "play"


def stats_controls(pressed):
    global view
    if BUTTON_BACK in pressed or BUTTON_MENU in pressed:
        view = "hub"
    elif BUTTON_SELECT in pressed:
        profile.refresh(badge.ticks)


def intro_controls(pressed):
    global view
    if BUTTON_UP in pressed:
        cycle_monkey()
    if BUTTON_DOWN in pressed:
        cycle_mode()
    if BUTTON_SELECT in pressed:
        start_countdown()
    elif BUTTON_BACK in pressed or BUTTON_MENU in pressed:
        view = "hub"


def countdown_controls(pressed):
    global view
    if BUTTON_BACK in pressed or BUTTON_MENU in pressed:
        view = "intro"


def game_controls(pressed):
    if BUTTON_MENU in pressed:
        pause_game()
        return
    jumped = BUTTON_SELECT in pressed
    dashed = BUTTON_BACK in pressed
    return held_direction(), jumped, dashed


def pause_controls(pressed):
    global view, pause_choice
    if BUTTON_UP in pressed or BUTTON_DOWN in pressed:
        pause_choice = 1 - pause_choice
    if BUTTON_MENU in pressed or BUTTON_BACK in pressed:
        view = "game"
    elif BUTTON_SELECT in pressed:
        view = "game" if pause_choice == 0 else "intro"


def results_controls(pressed):
    global view
    if BUTTON_SELECT in pressed:
        start_countdown()
    elif BUTTON_BACK in pressed or BUTTON_MENU in pressed:
        view = "hub"


HANDLERS = {
    "play": play_controls, "hub": hub_controls, "stats": stats_controls,
    "intro": intro_controls, "countdown": countdown_controls, "game": game_controls,
    "pause": pause_controls, "results": results_controls,
}


def controls():
    global last_buttons
    active = {
        button for button in (BUTTON_MENU, BUTTON_BACK, BUTTON_UP, BUTTON_DOWN, BUTTON_SELECT)
        if badge.pressed(button) or badge.held(button)
    }
    pressed = active - last_buttons
    last_buttons = active
    return HANDLERS[view](pressed)


def play_round(dt, actions):
    global go_time
    direction, jumped, dashed = actions
    go_time = max(0, go_time - dt)
    for popup in popups[:]:
        popup[2] -= 24 * dt
        popup[3] -= dt
        if popup[3] <= 0:
            popups.remove(popup)
    for kind, x, y, points in game.update(dt, direction, jumped, dashed):
        if kind == "miss":
            add_popup("oops", x, y - 14, MUTED)
        elif kind != "bonus_gone":
            add_popup("+%d" % points, x, y - 10, GREEN)
            if game.streak % 5 == 0 and game.multiplier > 1:
                add_popup("COMBO x%d" % game.multiplier, game.x, 128, PINK)
            elif kind == "bonus" or game.rng.random() < 0.25:
                add_popup(game.rng.choice(CHEERS[saved["monkey"]]), game.x, 118, INK)
            burst(x, y, 12 if kind == "bonus" else 4)
    if game.finished:
        finish_round()


def add_popup(label, x, y, pen):
    if len(popups) >= 8:
        popups.pop(0)
    popups.append([label, x, y, 0.9, pen])


def animate(dt):
    global clock, monkey_x, jump, jump_speed, reaction_time, nap_time, spawn_time
    if paused and view == "play":
        return
    clock += dt
    reaction_time = max(0, reaction_time - dt)
    nap_time = max(0, nap_time - dt)
    direction = int(bool(badge.held(BUTTON_RIGHT))) - int(bool(badge.held(BUTTON_LEFT)))
    if view == "play" and nap_time <= 0:
        monkey_x = max(58, min(W - 58, monkey_x + direction * 105 * dt))
    jump_speed -= 280 * dt
    jump = max(0, jump + jump_speed * dt)
    if jump == 0:
        jump_speed = 0
    mode = saved["mode"]
    spawn_time -= dt
    if mode != 3 and spawn_time <= 0 and view in ("play", "hub", "stats"):
        spawn_time = (0.65, 0.3, 0.09, 1)[mode]
        if len(rain) < 32:
            rain.append([random.uniform(4, W - 25), -25, random.uniform(22, 56)])
    for item in rain[:]:
        item[1] += item[2] * dt
        item[0] += math.sin(clock * 2 + item[2]) * 12 * dt
        if item[1] > H - 30:
            rain.remove(item)
    for item in confetti[:]:
        item[0] += item[2] * dt
        item[1] += item[3] * dt
        item[3] += 150 * dt
        item[4] -= dt
        if item[4] <= 0:
            confetti.remove(item)


def backdrop(header=True):
    mode = saved["mode"]
    disco = mode == 1
    screen.pen = NIGHT if disco else CREAM
    screen.clear()
    if disco:
        for i in range(7):
            x = i * W / 6
            y = 110 + math.sin(clock * 1.6 + i) * 34
            screen.pen = color.rgb(51 + i * 7, 42, 82 + i * 8)
            screen.shape(shape.circle(x, y, 34))
        for i in range(9):
            screen.pen = PINK if i % 2 else YELLOW
            screen.shape(shape.circle((i * 43 + 9) % W, 56 + (i * 31) % 115, 1.5))
    else:
        screen.pen = color.rgb(238, 230, 186)
        screen.shape(shape.circle(W - 27, 90, 43))
        screen.shape(shape.circle(17, 146, 34))
        for x, y in ((12, 72), (W - 19, 130), (32, 132)):
            screen.pen = color.rgb(174, 193, 124)
            screen.shape(shape.circle(x, y, 9))
            screen.pen = color.rgb(202, 212, 151)
            screen.shape(shape.circle(x + 7, y - 10, 8))
    if not header:
        return
    for x, y, _ in rain:
        screen.blit(banana, rect(x, y, 21, 21))
    box(0, H - 56, W, 56, 0, color.rgb(36, 57, 57) if disco else color.rgb(223, 229, 174))
    box(0, 0, W, 39, 0, YELLOW)
    screen.blit(banana, rect(10, 5, 28, 28))
    text("BANANIFY", 43, 10, INK, font.futile)
    text("A LITTLE LESS ORDINARY", 44, 27, INK)
    menu_label = "MENU: MORE" if view == "play" else "BACK: " + ("HUB" if view == "stats" else "PLAY")
    screen.font = font.nope
    menu_width, _ = screen.measure_text(menu_label)
    box(W - menu_width - 22, 10, menu_width + 12, 18, 8, INK)
    text(menu_label, W - menu_width - 16, 16, YELLOW)


def draw_play():
    disco = saved["mode"] == 1
    fg = CREAM if disco else INK
    name = NAMES[saved["monkey"]]
    text(name.upper(), 12, 44, fg, font.futile)
    text(SPECIES[saved["monkey"]], 12, 73, PINK if disco else MUTED)
    label = MODES[saved["mode"]]
    screen.font = font.nope
    tw, _ = screen.measure_text(label)
    box(W - tw - 23, 45, tw + 13, 17, 7, GREEN if not disco else PINK)
    text(label, W - tw - 17, 51, CREAM if not disco else INK)
    text("%d SNACKS" % saved["snacks"], W - 85, 69, fg)
    box(monkey_x - 37, H - 63, 74, 6, 3, color.rgb(24, 40, 42) if disco else color.rgb(190, 201, 140))
    dancing = saved["mode"] != 3 and nap_time <= 0 and not paused
    bob = math.sin(clock * (7 if disco else 3)) * (3 if dancing else 0)
    pose = 2 if nap_time > 0 else (int(clock * (5 if disco else 2)) % 2 if dancing else 0)
    screen.blit(sheets[saved["monkey"]].sprite(pose, 0),
                rect(monkey_x - 60, H - 177 - jump + bob, 120, 120))
    if nap_time > 0:
        text("z z Z", monkey_x + 30, H - 153 - jump, fg, font.futile)
    if reaction_time > 0:
        screen.font = font.nope
        width, _ = screen.measure_text(reaction)
        box((W - width) / 2 - 9, H - 89, width + 18, 19, 8, WHITE)
        centered(reaction, H - 83)
    for x, y, _, _, _, palette in confetti:
        box(x, y, 4, 6, 1, (YELLOW, PINK, GREEN)[palette])
    if paused:
        box(W / 2 - 42, 101, 84, 25, 8, INK)
        centered("PAUSED", 109, YELLOW)
    text("L/R MOVE   SELECT FEED   UP FRIEND", 12, H - 42, fg)
    text("DOWN PARTY   BACK PAUSE   MENU GAME/STATS", 12, H - 27, fg)
    for i in range(len(MODES)):
        box(W / 2 - 26 + i * 15, H - 10, 8, 3, 1, GREEN if i == saved["mode"] else MUTED)
    if save_error:
        centered("SAVE FAILED - PROGRESS NOT SAVED", 88, PINK if disco else INK)


def draw_stats():
    box(8, 44, W - 16, H - 52, 12, WHITE)
    text("GITHUB, BUT BANANAS.", 20, 54, INK, font.futile)
    text("@" + profile.username, 20, 73, GREEN)
    values = profile.data
    for i, (key, label) in enumerate((
        ("public_repos", "PUBLIC REPOS"), ("followers", "FOLLOWERS"),
        ("following", "FOLLOWING"), ("public_gists", "PUBLIC GISTS"),
    )):
        x = 20 + i % 2 * (W / 2 - 12)
        y = 93 + i // 2 * 43
        box(x - 1, y - 2, W / 2 - 22, 38, 6, CREAM)
        text(str(values[key]), x + 7, y + 3, INK, font.futile)
        text(label, x + 7, y + 22, MUTED)
    text(profile.source, 20, H - 60, GREEN)
    text(profile.status, 20, H - 45, INK)
    text("SELECT REFRESH   BACK HUB", 20, H - 25, INK)


def panel(title, y=46, height=None):
    box(10, y, W - 20, height or H - y - 10, 12, WHITE)
    centered(title, y + 9, INK, font.futile)


def draw_hub():
    panel("WHAT'S THE PLAN?")
    for i, label in enumerate(HUB_ITEMS):
        y = 78 + i * 36
        chosen = i == hub_choice
        box(30, y, W - 60, 30, 10, YELLOW if chosen else CREAM)
        screen.blit(banana, rect(40, y + 4, 22, 22))
        text(label, 72, y + 7, INK, font.futile)
    detail = ("60 SECOND SCORE CHASE", "FEED & DANCE", "@" + profile.username)[hub_choice]
    centered(detail, 190, MUTED)
    centered("UP/DOWN CHOOSE  SELECT OPEN  BACK PLAY", 208, INK)


def draw_pad(x, y):
    box(x - 7, y - 21, 14, 42, 4, INK)
    box(x - 21, y - 7, 42, 14, 4, INK)
    centered_at("MOVE", x, y + 27, INK)


def draw_action(x, y, button, action):
    screen.pen = YELLOW
    screen.shape(shape.circle(x, y, 18))
    screen.pen = INK
    screen.shape(shape.circle(x, y, 18).stroke(2))
    centered_at(action, x, y - 4, INK)
    centered_at(button, x, y + 23, MUTED)


def draw_intro():
    panel("BANANA CATCH", 8, 224)
    screen.blit(sheets[saved["monkey"]].sprite(1, 0), rect(14, 40, 104, 104))
    centered_at(NAMES[saved["monkey"]].upper(), 66, 146, INK, font.futile)
    centered_at(MODES[saved["mode"]] + " PARTY", 66, 166, MUTED)
    text("BEST %d" % saved["best_score"], 132, 42, GREEN, font.futile)
    text("BEST COMBO %d  ROUNDS %d" % (saved["best_combo"], saved["rounds"]), 132, 64, MUTED)
    text("FLIP BADGE FOR GAMEPAD!", 132, 80, PINK)
    draw_pad(158, 126)
    draw_action(224, 120, "SELECT", "JUMP")
    draw_action(278, 132, "BACK", "DASH")
    text("JUMP FOR SPARKLY BUNCHES!", 132, 178, INK)
    centered("UP FRIEND  DOWN PARTY  SELECT GO  BACK HUB", 206, INK)


def draw_monkey():
    x, lift = game.x, game.height
    box(x - 20 + lift * 0.1, catch_game.GROUND - 4, 40 - lift * 0.2, 6, 3, color.rgb(120, 110, 70))
    zen = saved["mode"] == 3
    pose = 1 if lift > 0 else (0 if zen else int(clock * 4) % 2)
    width = -76 if game.facing < 0 else 76
    screen.blit(sheets[saved["monkey"]].sprite(pose, 0),
                rect(x - 38, catch_game.GROUND - lift - 76, width, 76))


def draw_bonus():
    bonus = game.bonus
    if bonus is None:
        return
    if bonus["warning"] > 0:
        edge = 16 if bonus["dir"] > 0 else W - 16
        if int(bonus["warning"] * 8) % 2:
            box(edge - 12, catch_game.BONUS_Y - 22, 24, 24, 8, PINK)
            centered_at("!", edge, catch_game.BONUS_Y - 15, WHITE)
        text("JUMP!", edge - 14, catch_game.BONUS_Y + 6, PINK)
        return
    x, y = bonus["x"], bonus["y"]
    screen.pen = color.rgb(255, 236, 140)
    screen.shape(shape.circle(x, y, 16 + math.sin(clock * 9) * 2))
    for dx, dy in ((-8, -2), (0, -7), (8, -2)):
        screen.blit(banana, rect(x + dx - 9, y + dy - 7, 18, 18))
    screen.pen = WHITE
    for i in range(3):
        angle = clock * 4 + i * 2.1
        screen.shape(shape.circle(x + math.cos(angle) * 17, y + math.sin(angle) * 17, 1.8))


def centered_at(label, x, y, pen=INK, face=None):
    screen.font = face or font.nope
    width, _ = screen.measure_text(label)
    text(label, x - width / 2, y, pen, face)


def draw_hud():
    box(0, 0, W, 34, 0, YELLOW)
    seconds = int(math.ceil(game.time_left))
    text("%d:%02d" % (seconds // 60, seconds % 60), 10, 8, INK, font.futile)
    centered_at("%d" % game.score, W / 2 - 20, 8, INK, font.futile)
    combo = "x%d" % game.multiplier
    box(174, 8, 30, 18, 6, PINK if game.multiplier > 1 else CREAM)
    centered_at(combo, 189, 13, INK)
    for i in range(5):
        filled = game.streak and (game.streak - 1) % 5 >= i or game.multiplier == 5
        box(208 + i * 6, 14, 4, 8, 1, GREEN if filled else MUTED)
    text("DASH", 244, 13, INK)
    box(276, 14, 36, 8, 4, CREAM)
    ready = game.dash_ready
    box(276, 14, max(6, 36 * ready), 8, 4, GREEN if ready >= 1 else MUTED)


def draw_game_scene():
    disco = saved["mode"] == 1
    backdrop(False)
    box(0, catch_game.GROUND, W, H - catch_game.GROUND, 0,
        color.rgb(36, 57, 57) if disco else color.rgb(198, 210, 140))
    for x, y, _ in game.bananas:
        screen.blit(banana, rect(x - 11, y - 11, 22, 22))
    draw_bonus()
    draw_monkey()
    for x, y, _, _, _, palette in confetti:
        box(x, y, 4, 6, 1, (YELLOW, PINK, GREEN)[palette])
    for label, x, y, _, pen in popups:
        centered_at(label, x, y, CREAM if disco and pen is INK else pen)
    draw_hud()
    hint = CREAM if disco else INK
    text("L/R MOVE  SELECT JUMP  BACK DASH  MENU PAUSE", 10, catch_game.GROUND + 14, hint)


def draw_countdown():
    draw_game_scene()
    number = str(int(math.ceil(countdown)))
    box(W / 2 - 44, 82, 88, 64, 16, WHITE)
    centered(number, 98, INK, font.futile)
    centered("GET READY", 122, MUTED)


def draw_game():
    draw_game_scene()
    if go_time > 0:
        box(W / 2 - 40, 90, 80, 34, 12, WHITE)
        centered("GO!", 99, GREEN, font.futile)


def draw_pause():
    draw_game_scene()
    box(W / 2 - 90, 62, 180, 120, 14, WHITE)
    centered("PAUSED", 72, INK, font.futile)
    if pause_reason:
        centered(pause_reason, 94, PINK)
    for i, label in enumerate(("RESUME", "QUIT ROUND")):
        y = 110 + i * 28
        box(W / 2 - 66, y, 132, 22, 8, YELLOW if i == pause_choice else CREAM)
        centered(label, y + 7, INK)
    centered("UP/DOWN  SELECT  MENU RESUME", 188, INK)


def draw_results():
    backdrop(False)
    panel("NEW BEST!" if new_best else "ROUND COMPLETE")
    centered("%d" % game.score, 78, GREEN, font.futile)
    centered("POINTS", 100, MUTED)
    rows = (
        ("BANANAS CAUGHT", game.caught), ("MISSED", game.missed),
        ("BEST COMBO", game.best_combo), ("PERSONAL BEST", saved["best_score"]),
    )
    for i, (label, value) in enumerate(rows):
        y = 118 + i * 18
        text(label, 60, y, INK)
        screen.font = font.nope
        width, _ = screen.measure_text(str(value))
        text(str(value), W - 60 - width, y, INK)
    if save_error:
        centered("SAVE FAILED - RECORD NOT SAVED", 192, PINK)
    elif new_best:
        centered("A LITTLE MORE BANANA!", 192, PINK)
    centered("SELECT RETRY   BACK HUB", 212, INK)
    for x, y, _, _, _, palette in confetti:
        box(x, y, 4, 6, 1, (YELLOW, PINK, GREEN)[palette])


def update():
    global countdown, go_time, last_orientation, new_best
    upside_down = orientation()
    turned = upside_down != last_orientation
    last_orientation = upside_down
    actions = controls()
    raw_dt = max(0, badge.ticks_delta / 1000)
    dt = min(raw_dt, 0.1)
    animate(dt)
    if view == "countdown":
        countdown -= dt
        if countdown <= 0:
            go_time = 0.8
            view_to("game")
    elif view == "game":
        if turned:
            pause_game("BADGE TURNED")
        elif actions:
            play_round(raw_dt, actions)
            if view == "results" and new_best:
                burst(W / 2, 80, 24)
    if profile.poll(badge.ticks):
        saved["profile"] = profile.data
        persist()
    if view == "stats":
        backdrop()
        draw_stats()
    elif view == "hub":
        backdrop()
        draw_hub()
    elif view == "intro":
        backdrop(False)
        draw_intro()
    elif view == "countdown":
        draw_countdown()
    elif view == "game":
        draw_game()
    elif view == "pause":
        draw_pause()
    elif view == "results":
        draw_results()
    else:
        backdrop()
        draw_play()


def view_to(name):
    global view
    view = name


run(update)
