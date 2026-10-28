"""Host-side behavior checks; the real graphics runtime is tested separately."""

import importlib.util
import json
from pathlib import Path
import struct
import sys
import types
import unittest
from unittest.mock import Mock, patch


APP = Path(__file__).resolve().parents[1] / "bananify"
SPEC = importlib.util.spec_from_file_location("bananify_profile", APP / "profile.py")
PROFILE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PROFILE)
SEED = json.loads((APP / "profile_seed.json").read_text())
GAME_SPEC = importlib.util.spec_from_file_location("catch_game", APP / "catch_game.py")
GAME = importlib.util.module_from_spec(GAME_SPEC)
GAME_SPEC.loader.exec_module(GAME)


class FixedRandom:
    """Deterministic spawns: always mid-range, bonus enters from the left."""

    def uniform(self, low, high):
        return (low + high) / 2

    def random(self):
        return 0.1

    def choice(self, values):
        return values[0]


class Request:
    def __init__(self, complete=False, error=None):
        self.complete = complete
        self.error = error

    def __bool__(self):
        return self.complete


class ProfileTests(unittest.TestCase):
    def setUp(self):
        self.request = Request()
        self.fetch = Mock()
        self.fetch.url.return_value.to.return_value = self.request
        self.modules = patch.dict(sys.modules, {"fetch": self.fetch, "wifi": types.ModuleType("wifi")})
        self.modules.start()
        self.cwd = patch.object(PROFILE, "open", create=True)
        self.open = self.cwd.start()
        self.open.return_value.__enter__.return_value.read.return_value = json.dumps(SEED)
        self.profile = PROFILE.Profile(None)

    def tearDown(self):
        self.cwd.stop()
        self.modules.stop()

    def test_seed_is_explicitly_a_snapshot(self):
        self.assertEqual(self.profile.source, "SNAPSHOT " + SEED["snapshot_date"])
        self.assertIsNone(self.profile.request)

    def test_invalid_cached_types_and_other_accounts_are_ignored(self):
        for value in (None, [], {}, dict(SEED, login=12), dict(SEED, login="someone"),
                      dict(SEED, followers=True), dict(SEED, followers=-1),
                      dict(SEED, followers="100")):
            self.assertFalse(PROFILE.valid_profile(value))
            self.assertEqual(PROFILE.Profile(value).data, SEED)

    def test_saved_copy_is_not_mislabeled_live(self):
        self.assertEqual(PROFILE.Profile(dict(SEED, followers=123)).source, "SAVED COPY")

    def test_refresh_is_async_and_does_not_read_credentials(self):
        self.profile.refresh(100)
        self.assertEqual(self.profile.status, "FETCHING GITHUB...")
        self.assertFalse(self.profile.poll(120))
        headers = self.fetch.url.call_args.kwargs["headers"]
        self.assertNotIn("Authorization", headers)
        self.assertEqual(self.profile.data, SEED)

    def test_success_and_rate_limit(self):
        self.profile.refresh(100)
        self.request.complete = True
        self.open.return_value.__enter__.return_value.read.return_value = json.dumps(dict(SEED, followers=9000))
        self.assertTrue(self.profile.poll(200))
        self.assertEqual(self.profile.data["followers"], 9000)
        self.assertEqual(self.profile.source, "REFRESHED THIS SESSION")
        self.profile.refresh(1000)
        self.assertIn("WAIT 60S", self.profile.status)
        self.assertEqual(self.fetch.url.call_count, 1)

    def test_inflight_request_is_not_duplicated(self):
        self.profile.refresh(100)
        self.profile.refresh(62000)
        self.assertEqual(self.fetch.url.call_count, 1)

    def test_timeout_does_not_start_a_second_writer_to_the_same_file(self):
        self.profile.refresh(100)
        self.profile.poll(20200)
        self.profile.refresh(62000)
        self.assertEqual(self.fetch.url.call_count, 1)
        self.assertIn("FETCH STILL ACTIVE", self.profile.status)
        self.request.error = "connection closed"
        self.profile.poll(63000)
        self.profile.refresh(64000)
        self.assertEqual(self.fetch.url.call_count, 2)

    def test_error_timeout_and_malformed_response_keep_counts(self):
        for failure in ("error", "timeout", "json", "rate_limit"):
            with self.subTest(failure=failure):
                self.request = Request()
                self.fetch.url.return_value.to.return_value = self.request
                self.profile = PROFILE.Profile(None)
                self.profile.refresh(100)
                if failure == "error":
                    self.request.error = "No Wi-Fi"
                elif failure in ("json", "rate_limit"):
                    self.request.complete = True
                    body = "not json" if failure == "json" else '{"message": "API rate limit exceeded"}'
                    self.open.return_value.__enter__.return_value.read.return_value = body
                self.assertFalse(self.profile.poll(20200))
                self.assertEqual(self.profile.data, SEED)
                self.assertIn("KEPT COPY", self.profile.status)
                self.open.return_value.__enter__.return_value.read.return_value = json.dumps(SEED)

    def test_fetch_start_failure_is_visible(self):
        self.fetch.url.side_effect = OSError("offline")
        self.profile.refresh(100)
        self.assertIn("NETWORK UNAVAILABLE", self.profile.status)
        self.assertEqual(self.profile.data, SEED)


class AppHarness(unittest.TestCase):
    def setUp(self):
        self.keys = set()
        self.held = set()
        self.state = Mock()
        self.screen = Mock(width=320, height=240)
        self.screen.measure_text.side_effect = lambda value: (len(value) * 6, 8)
        self.badge = Mock(ticks=0, ticks_delta=16)
        self.badge.pressed.side_effect = lambda button: button in self.keys
        self.badge.held.side_effect = lambda button: button in self.held
        self.badge.upside_down.return_value = False
        self.ns = {
            "badge": self.badge, "screen": self.screen, "image": Mock(),
            "font": Mock(), "color": Mock(), "shape": Mock(), "rect": Mock(),
            "HIRES": 1, "VSYNC": 2, "run": Mock(),
        }
        for name in ("LEFT", "RIGHT", "UP", "DOWN", "SELECT", "MENU", "BACK", "HOME"):
            self.ns["BUTTON_" + name] = name
        self.modules = patch.dict(sys.modules, {
            "badgeware": types.SimpleNamespace(State=self.state), "profile": PROFILE,
            "catch_game": GAME,
        })
        self.modules.start()
        with patch("os.chdir"), patch.object(PROFILE, "open", create=True) as opened:
            opened.return_value.__enter__.return_value.read.return_value = json.dumps(SEED)
            exec(compile((APP / "__init__.py").read_text(), str(APP / "__init__.py"), "exec"), self.ns)

    def tearDown(self):
        self.modules.stop()
        if str(APP) not in sys.path:
            return
        sys.path.remove(str(APP))

    def press(self, button):
        self.keys = {button}
        self.ns["update"]()
        self.keys.clear()
        self.ns["update"]()


class PlaygroundTests(AppHarness):
    def test_long_press_is_one_action(self):
        self.keys = {"SELECT"}
        for _ in range(30):
            self.ns["update"]()
        self.assertEqual(self.ns["saved"]["snacks"], 1)
        self.keys.clear()
        self.ns["update"]()
        self.press("SELECT")
        self.assertEqual(self.ns["saved"]["snacks"], 2)

    def test_all_monkeys_and_modes_cycle_and_save(self):
        for expected in (1, 2, 0):
            self.press("UP")
            self.assertEqual(self.ns["saved"]["monkey"], expected)
        for expected in (1, 2, 3, 0):
            self.press("DOWN")
            self.assertEqual(self.ns["saved"]["mode"], expected)
        self.assertEqual(self.state.save.call_count, 7)

    def test_feed_nap_and_wake(self):
        for _ in range(3):
            self.press("SELECT")
        self.assertEqual(self.ns["saved"]["snacks"], 3)
        self.assertGreater(self.ns["nap_time"], 0)
        self.press("SELECT")
        self.assertEqual(self.ns["nap_time"], 0)
        self.assertEqual(self.ns["saved"]["snacks"], 3)

    def test_movement_is_time_based_and_bounded(self):
        self.held = {"RIGHT"}
        self.ns["animate"](0.5)
        self.assertAlmostEqual(self.ns["monkey_x"], 212.5)
        self.ns["animate"](10)
        self.assertEqual(self.ns["monkey_x"], 262)
        self.held = {"LEFT"}
        self.ns["animate"](10)
        self.assertEqual(self.ns["monkey_x"], 58)

    def test_pause_freezes_animation_and_ignores_feeding(self):
        self.press("BACK")
        before = self.ns["clock"]
        self.held = {"RIGHT"}
        self.press("SELECT")
        self.assertEqual(self.ns["clock"], before)
        self.assertEqual(self.ns["saved"]["snacks"], 0)
        self.assertEqual(self.ns["monkey_x"], 160)

    def test_stats_navigation_and_no_hidden_playground_input(self):
        self.press("MENU")
        self.assertEqual(self.ns["view"], "hub")
        self.press("DOWN")
        self.press("DOWN")
        self.press("SELECT")
        self.assertEqual(self.ns["view"], "stats")
        self.press("UP")
        self.assertEqual(self.ns["saved"]["monkey"], 0)
        self.held = {"RIGHT"}
        self.ns["animate"](1)
        self.assertEqual(self.ns["monkey_x"], 160)
        self.press("BACK")
        self.assertEqual(self.ns["view"], "hub")
        self.press("BACK")
        self.assertEqual(self.ns["view"], "play")

    def test_zen_has_no_shower_bob_or_jump(self):
        self.ns["saved"]["mode"] = 3
        self.ns["animate"](0.5)
        self.assertFalse(self.ns["rain"])
        self.press("SELECT")
        self.assertEqual(self.ns["jump"], 0)

    def test_particles_are_bounded(self):
        for _ in range(20):
            self.ns["burst"](100, 100)
        self.assertLessEqual(len(self.ns["confetti"]), 56)
        self.ns["saved"]["mode"] = 2
        for _ in range(500):
            self.ns["animate"](0.1)
        self.assertLessEqual(len(self.ns["rain"]), 32)

    def test_save_failure_is_visible(self):
        self.state.save.side_effect = OSError("disk full")
        self.press("SELECT")
        self.assertTrue(self.ns["save_error"])

    def test_home_is_launcher_owned(self):
        self.press("HOME")
        self.assertEqual(self.ns["view"], "play")
        self.state.save.assert_not_called()

    def test_icon_and_sprite_dimensions(self):
        for filename, dimensions in (
            ("icon.png", (24, 24)), ("assets/banana.png", (24, 24)),
            ("assets/monkey_brown.png", (336, 112)),
            ("assets/monkey_black-and-white.png", (336, 112)),
            ("assets/monkey_golden.png", (336, 112)),
        ):
            data = (APP / filename).read_bytes()
            self.assertEqual(data[:8], b"\x89PNG\r\n\x1a\n")
            self.assertEqual(struct.unpack(">II", data[16:24]), dimensions)


class CatchModelTests(unittest.TestCase):
    def setUp(self):
        self.round = GAME.Round(FixedRandom())
        self.round.spawn_timer = 999
        self.round.bonus_timer = 999

    def drop(self, x, speed=60):
        self.round.bananas.append([float(x), float(GAME.SPAWN_Y), float(speed)])

    def run_for(self, seconds, step=1 / 60, **controls):
        events = []
        elapsed = 0
        while elapsed < seconds - 1e-9:
            events += self.round.update(step, **controls)
            elapsed += step
        return events

    def test_ground_catch_only_under_monkey(self):
        self.drop(160)
        self.drop(40)
        events = self.run_for(4)
        kinds = [event[0] for event in events]
        self.assertEqual(kinds.count("catch"), 1)
        self.assertEqual(kinds.count("miss"), 1)
        self.assertEqual((self.round.score, self.round.caught, self.round.missed), (10, 1, 1))
        self.assertEqual(self.round.streak, 0)

    def test_slow_frames_do_not_tunnel_or_double_award(self):
        self.drop(160, speed=400)
        events = self.round.update(0.5) + self.round.update(0.5)
        self.assertEqual([event[0] for event in events], ["catch"])
        self.assertEqual(self.round.score, 10)

    def test_bonus_needs_a_jump(self):
        self.round.bonus_timer = 0
        self.run_for(1 / 60)
        self.assertIsNotNone(self.round.bonus)
        events = self.run_for(8)
        self.assertNotIn("bonus", [event[0] for event in events])
        self.assertIn("bonus_gone", [event[0] for event in events])

        self.round = GAME.Round(FixedRandom())
        self.round.spawn_timer = 999
        self.round.bonus = {"x": 100.0, "y": float(GAME.BONUS_Y), "dir": 1, "warning": 0}
        self.round.bonus_timer = 999
        events = self.run_for(0.4)
        self.assertEqual(events, [])
        self.round.update(1 / 60, jump=True)
        events = self.run_for(0.5)
        self.assertEqual([event[0] for event in events], ["bonus"])
        self.assertEqual((self.round.score, self.round.caught), (30, 3))

    def test_jump_is_single_and_fixed_height(self):
        self.assertTrue(self.round.jump())
        self.assertFalse(self.round.jump())
        peak = 0
        for _ in range(120):
            self.round.update(1 / 60)
            peak = max(peak, self.round.height)
        self.assertAlmostEqual(peak, GAME.JUMP_HEIGHT, delta=4)
        self.assertEqual((self.round.height, self.round.vy), (0, 0))
        self.assertTrue(self.round.jump())

    def test_dash_direction_cooldown_and_airborne(self):
        self.round.update(1 / 60, direction=-1)
        start = self.round.x
        self.round.update(1 / 60, dash=True)
        self.run_for(0.3)
        self.assertLess(self.round.x, start - 50)
        self.assertFalse(self.round.dash(1))
        self.run_for(GAME.DASH_COOLDOWN)
        self.round.update(1 / 60, jump=True)
        vy = self.round.vy
        self.round.update(1 / 60, direction=1, dash=True)
        self.assertGreater(self.round.dash_time, 0)
        self.assertAlmostEqual(self.round.vy, vy - GAME.GRAVITY / 60, places=5)
        self.run_for(3, direction=1)
        self.assertEqual(self.round.x, GAME.RIGHT_EDGE)

    def test_combo_thresholds_and_cap(self):
        expected = [1] * 5 + [2] * 5 + [3] * 5 + [4] * 5 + [5] * 10
        for streak, value in enumerate(expected, 1):
            self.assertEqual(GAME.multiplier(streak), value)
        for _ in range(6):
            self.round._catch(0, 0, False, [])
        self.assertEqual(self.round.score, 5 * 10 + 20)
        self.assertEqual(self.round.best_combo, 6)

    def test_round_ends_exactly_once_at_sixty_seconds(self):
        round_ = GAME.Round(FixedRandom())
        for _ in range(200):
            round_.update(0.5, direction=1)
        self.assertTrue(round_.finished)
        self.assertEqual(round_.elapsed, GAME.ROUND_SECONDS)
        score = round_.score
        self.assertEqual(round_.update(1), [])
        self.assertEqual(round_.score, score)
        self.assertLessEqual(len(round_.bananas), GAME.MAX_BANANAS)

    def test_stall_does_not_release_spawn_backlog(self):
        self.round.spawn_timer = 0.1
        self.round.update(10)
        self.assertLessEqual(len(self.round.bananas), 1)
        self.assertAlmostEqual(self.round.elapsed, GAME.MAX_FRAME)


class BananaCatchAppTests(AppHarness):
    def start_round(self):
        self.press("MENU")
        self.press("SELECT")
        self.assertEqual(self.ns["view"], "intro")
        self.press("SELECT")
        self.assertEqual(self.ns["view"], "countdown")
        self.ns["game"].rng = FixedRandom()
        for _ in range(200):
            self.ns["update"]()
        self.assertEqual(self.ns["view"], "game")
        self.assertAlmostEqual(self.ns["game"].elapsed, 200 * 0.016 - 3, delta=0.05)
        return self.ns["game"]

    def test_full_round_records_once(self):
        game = self.start_round()
        game.bananas.append([game.x, float(GAME.SPAWN_Y), 400.0])
        self.badge.ticks_delta = 400
        for _ in range(200):
            self.ns["update"]()
        self.assertEqual(self.ns["view"], "results")
        saved = self.ns["saved"]
        self.assertEqual(saved["rounds"], 1)
        self.assertGreaterEqual(saved["best_score"], 10)
        self.assertEqual(saved["game_bananas"], game.caught)
        self.assertTrue(self.ns["new_best"])
        saves = self.state.save.call_count
        self.ns["finish_round"]()
        self.ns["update"]()
        self.assertEqual(saved["rounds"], 1)
        self.assertEqual(self.state.save.call_count, saves)
        self.assertEqual(saved["snacks"], 0)

    def test_select_jumps_and_back_dashes_once_per_press(self):
        game = self.start_round()
        self.keys = {"SELECT"}
        self.ns["update"]()
        self.assertGreater(game.vy, 0)
        for _ in range(80):
            self.ns["update"]()
        self.assertEqual(game.height, 0)
        self.keys = {"BACK"}
        self.ns["update"]()
        self.assertEqual(self.ns["view"], "game")
        self.assertGreater(game.cooldown, 0)
        game.cooldown = 0
        self.ns["update"]()
        self.assertEqual(game.cooldown, 0)

    def test_pause_freezes_and_quit_discards(self):
        game = self.start_round()
        self.press("MENU")
        self.assertEqual(self.ns["view"], "pause")
        elapsed = game.elapsed
        for _ in range(50):
            self.ns["update"]()
        self.assertEqual(game.elapsed, elapsed)
        self.press("BACK")
        self.assertEqual(self.ns["view"], "game")
        self.assertEqual(game.cooldown, 0)
        self.press("MENU")
        self.press("DOWN")
        self.press("SELECT")
        self.assertEqual(self.ns["view"], "intro")
        self.assertEqual(self.ns["saved"]["rounds"], 0)

    def test_turning_the_badge_pauses_safely(self):
        game = self.start_round()
        self.badge.upside_down.return_value = True
        self.keys = {"SELECT"}
        self.ns["update"]()
        self.assertEqual(self.ns["view"], "pause")
        self.assertEqual(game.vy, 0)
        self.ns["update"]()
        self.assertEqual(self.ns["view"], "pause")

    def test_old_saves_get_game_defaults(self):
        for key in ("best_score", "best_combo", "rounds", "game_bananas"):
            self.assertEqual(self.ns["saved"][key], 0)

    def test_failed_record_save_is_visible(self):
        game = self.start_round()
        self.state.save.side_effect = OSError("disk full")
        game.elapsed = GAME.ROUND_SECONDS - 0.01
        self.ns["update"]()
        self.assertEqual(self.ns["view"], "results")
        self.assertTrue(self.ns["save_error"])


if __name__ == "__main__":
    unittest.main()
