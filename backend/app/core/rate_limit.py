"""In-memory sliding-window rate limiter.

Single-instance deployment — counters are per uvicorn worker process
(no cross-worker sync), so effective limits are up to N_workers times
the configured value. Good enough for this project; swap the storage
for Redis/Valkey if the API is ever scaled horizontally.
"""
from __future__ import annotations

import threading
import time
from collections import deque


def client_ip(request) -> str:
    """Real client IP: nginx sets X-Real-IP; fall back to the socket peer."""
    ip = request.headers.get("x-real-ip")
    if ip:
        return ip.strip()
    return request.client.host if request.client else "unknown"


def retry_after_seconds(retry: float) -> int:
    return max(1, int(retry + 0.999))


class SlidingWindowLimiter:
    """Allows at most `limit` hits per `window_seconds` for each key."""

    def __init__(self, limit: int, window_seconds: float) -> None:
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()
        self._ops_since_sweep = 0

    def check(self, key: str) -> float:
        """Register a hit for `key`.

        Returns 0.0 if allowed, otherwise the number of seconds until
        the oldest hit leaves the window (i.e. Retry-After).
        """
        now = time.monotonic()
        with self._lock:
            self._maybe_sweep(now)
            dq = self._hits.get(key)
            if dq is None:
                dq = deque()
                self._hits[key] = dq
            cutoff = now - self.window
            while dq and dq[0] <= cutoff:
                dq.popleft()
            if len(dq) >= self.limit:
                return dq[0] + self.window - now
            dq.append(now)
            return 0.0

    def _maybe_sweep(self, now: float) -> None:
        # Drop keys whose hits have all expired so the dict can't grow forever.
        self._ops_since_sweep += 1
        if self._ops_since_sweep < 4096:
            return
        self._ops_since_sweep = 0
        cutoff = now - self.window
        stale = [k for k, dq in self._hits.items() if not dq or dq[-1] <= cutoff]
        for k in stale:
            del self._hits[k]
