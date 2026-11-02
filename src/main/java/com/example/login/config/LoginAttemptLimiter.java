package com.example.login.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Locks a key (user name + computer address, or the reset-code form) for a while after too many wrong tries,
 * so passwords and the reset code cannot be guessed by trying again and again.
 * Kept in memory: a restart of the application clears all locks.
 */
@Component
public class LoginAttemptLimiter {

    private static final int PRUNE_ABOVE = 5000;

    private final int maxAttempts;
    private final Duration lockFor;
    private final Clock clock;
    private final Map<String, Entry> entries = new HashMap<>();

    @Autowired
    public LoginAttemptLimiter(@Value("${app.login.max-attempts:5}") int maxAttempts,
                               @Value("${app.login.lock-minutes:15}") int lockMinutes) {
        this(maxAttempts, Duration.ofMinutes(lockMinutes), Clock.systemUTC());
    }

    LoginAttemptLimiter(int maxAttempts, Duration lockFor, Clock clock) {
        this.maxAttempts = Math.max(1, maxAttempts);
        this.lockFor = lockFor;
        this.clock = clock;
    }

    /** Seconds the key is still locked, or 0 when it may try. */
    public synchronized long secondsLocked(String key) {
        Entry e = entries.get(key);
        if (e == null || e.lockedUntil == null) {
            return 0;
        }
        long left = Duration.between(clock.instant(), e.lockedUntil).getSeconds();
        if (left <= 0) {
            entries.remove(key); // lock is over: start again with a clean count
            return 0;
        }
        return left;
    }

    /** Counts one wrong try. Returns true when this try locked the key. */
    public synchronized boolean recordFailure(String key) {
        Instant now = clock.instant();
        if (entries.size() > PRUNE_ABOVE) {
            entries.values().removeIf(e -> e.isStale(now, lockFor));
        }

        Entry e = entries.computeIfAbsent(key, k -> new Entry());
        if (e.isStale(now, lockFor)) {
            e.failures = 0; // old wrong tries do not count any more
            e.lockedUntil = null;
        }
        e.failures++;
        e.lastFailure = now;
        if (e.failures >= maxAttempts) {
            e.failures = 0;
            e.lockedUntil = now.plus(lockFor);
            return true;
        }
        return false;
    }

    /** A correct try clears the count. */
    public synchronized void recordSuccess(String key) {
        entries.remove(key);
    }

    private static final class Entry {
        int failures;
        Instant lastFailure;
        Instant lockedUntil;

        boolean isStale(Instant now, Duration window) {
            Instant end = lockedUntil != null ? lockedUntil : (lastFailure == null ? null : lastFailure.plus(window));
            return end != null && !end.isAfter(now);
        }
    }
}
