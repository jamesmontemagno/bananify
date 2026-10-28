"""Public, anonymous GitHub profile refresh without blocking animation."""

import json

USERNAME = "jamesmontemagno"
FIELDS = ("public_repos", "followers", "following", "public_gists")
TEMP_FILE = "/state/bananify_profile.tmp"


def valid_profile(value):
    return (
        isinstance(value, dict)
        and isinstance(value.get("login"), str)
        and value["login"].lower() == USERNAME.lower()
        and all(type(value.get(key)) is int and value[key] >= 0 for key in FIELDS)
    )


class Profile:
    def __init__(self, cached):
        self.username = USERNAME
        with open("profile_seed.json") as handle:
            seed = json.load(handle)
        if not valid_profile(seed):
            raise ValueError("Invalid Bananify profile_seed.json")
        self.data = cached if valid_profile(cached) else seed
        self.source = "SAVED COPY" if valid_profile(cached) else "SNAPSHOT " + seed["snapshot_date"]
        self.status = "PUBLIC COUNTS - NOT CONTRIBUTIONS"
        self.request = None
        self.started = None
        self.last_attempt = None
        self.timed_out = False

    def fail(self, message):
        self.status = message
        print("Bananify GitHub:", message)
        self.request = None
        self.started = None

    def refresh(self, now):
        if self.request is not None:
            if self.timed_out:
                self.status = "FETCH STILL ACTIVE - KEPT COPY"
            return
        if self.last_attempt is not None and now - self.last_attempt < 60000:
            self.status = "WAIT 60S BETWEEN REFRESHES"
            return
        self.last_attempt = now
        try:
            import fetch
            import wifi  # Firmware starts Wi-Fi when this module is loaded.

            self.request = fetch.url(
                "https://api.github.com/users/" + self.username,
                headers={"User-Agent": "Bananify-Universe-2026", "Accept": "application/vnd.github+json"},
            ).to(TEMP_FILE)
            self.started = now
            self.timed_out = False
            self.status = "FETCHING GITHUB..."
        except (ImportError, OSError, RuntimeError) as error:
            self.fail("NETWORK UNAVAILABLE - KEPT COPY")
            print("Bananify GitHub:", error)

    def poll(self, now):
        if self.request is None:
            return False
        if self.request.error:
            print("Bananify GitHub:", self.request.error)
            self.fail("FETCH FAILED - KEPT COPY")
        elif self.request:
            try:
                with open(TEMP_FILE) as handle:
                    data = json.load(handle)
                if not valid_profile(data):
                    raise ValueError("GitHub response did not contain valid public profile counts")
                self.data = {key: data[key] for key in FIELDS}
                self.data["login"] = data["login"]
                self.source = "REFRESHED THIS SESSION"
                self.status = "PUBLIC COUNTS - NOT CONTRIBUTIONS"
                self.request = None
                self.started = None
                return True
            except (OSError, ValueError, TypeError) as error:
                self.fail("INVALID RESPONSE - KEPT COPY")
                print("Bananify GitHub:", error)
        elif not self.timed_out and now - self.started >= 20000:
            # Keep ownership until fetch settles; it may still be writing TEMP_FILE.
            self.timed_out = True
            self.status = "TIMED OUT - KEPT COPY"
            print("Bananify GitHub:", self.status)
        return False
