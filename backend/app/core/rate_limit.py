"""
In-process sliding-window rate limiter for the login endpoint.

Design notes
------------
* Uses a simple in-memory dict keyed by client IP (or email if IP is
  unavailable).  This is appropriate for single-process development and CI.
* In a multi-process / multi-instance deployment this MUST be replaced with
  a Redis-backed implementation (e.g. slowapi + redis-py).
* Window: 60 seconds.  Max attempts: 10 per window.
"""
import time
from collections import defaultdict, deque
from threading import Lock

_WINDOW_SECONDS = 60
_MAX_ATTEMPTS = 10

_buckets: dict[str, deque[float]] = defaultdict(deque)
_lock = Lock()


def check_rate_limit(key: str) -> bool:
    """
    Return True when the *key* is within the allowed rate.
    Return False when the key has exceeded MAX_ATTEMPTS in the last WINDOW_SECONDS.

    Thread-safe (sync lock is acceptable here since this is a very fast O(n)
    operation on a small deque bounded by MAX_ATTEMPTS).
    """
    now = time.monotonic()
    cutoff = now - _WINDOW_SECONDS

    with _lock:
        bucket = _buckets[key]
        # Purge expired timestamps
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= _MAX_ATTEMPTS:
            return False
        bucket.append(now)
        return True


def reset_rate_limit(key: str | None = None) -> None:
    """Clear the bucket for *key*, or all buckets if key is None (useful in tests)."""
    with _lock:
        if key is None:
            _buckets.clear()
        else:
            _buckets.pop(key, None)
