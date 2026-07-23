"""Per-email login brute-force protection.

After `max_failures` failed attempts within `failure_window`, the email
is locked out for `lockout` seconds. Counters live in process memory —
see the note in rate_limit.py about multi-worker deployments.
"""
from __future__ import annotations

import threading
import time
from collections import deque
from dataclasses import dataclass, field

from app.config import settings


@dataclass
class _EmailState:
    failures: deque[float] = field(default_factory=deque)
    locked_until: float = 0.0


class LoginBruteforceGuard:
    def __init__(self, max_failures: int, failure_window: float, lockout: float) -> None:
        self.max_failures = max_failures
        self.failure_window = failure_window
        self.lockout = lockout
        self._states: dict[str, _EmailState] = {}
        self._lock = threading.Lock()

    @staticmethod
    def _key(email: str) -> str:
        return email.strip().lower()

    def seconds_locked(self, email: str) -> float:
        """0.0 if login may proceed, otherwise seconds until unlock."""
        now = time.monotonic()
        with self._lock:
            st = self._states.get(self._key(email))
            if st is None:
                return 0.0
            return max(0.0, st.locked_until - now)

    def register_failure(self, email: str) -> None:
        now = time.monotonic()
        with self._lock:
            st = self._states.setdefault(self._key(email), _EmailState())
            cutoff = now - self.failure_window
            while st.failures and st.failures[0] <= cutoff:
                st.failures.popleft()
            st.failures.append(now)
            if len(st.failures) >= self.max_failures:
                st.locked_until = now + self.lockout
                st.failures.clear()
            self._maybe_sweep(now)

    def reset(self, email: str) -> None:
        with self._lock:
            self._states.pop(self._key(email), None)

    def _maybe_sweep(self, now: float) -> None:
        if len(self._states) < 10_000:
            return
        cutoff = now - self.failure_window
        stale = [
            k for k, st in self._states.items()
            if st.locked_until <= now and (not st.failures or st.failures[-1] <= cutoff)
        ]
        for k in stale:
            del self._states[k]


login_guard = LoginBruteforceGuard(
    max_failures=settings.login_max_failures,
    failure_window=settings.login_failure_window_minutes * 60,
    lockout=settings.login_lockout_minutes * 60,
)
