# MailLab Health Endpoint — Implementation Spec

**Date:** 2026-05-26
**Status:** Design approved, ready for implementation
**Audience:** MailLab developer(s)
**Purpose:** Add a deliberately-flaky `GET /api/health` endpoint as the substrate for the AQA Course "TestResults analyzation" task. Students write a happy-path test against this endpoint and, by running it many times, see a mix of timeouts and intermittent 503s — real flaky-test material they then analyze and respond to.

> ⚠️ **The flakiness is intentional.** Unlike a normal health endpoint, this one is deliberately unreliable. A separate doc / inline comment in the codebase should make this obvious so future MailLab devs do not "fix" it.

---

## 1. Feature overview

A single new endpoint that returns a synthetic server status, with non-deterministic timing and a small probability of failure. The endpoint:

- Has no auth requirement (it is a health endpoint, accessible publicly).
- Has no DB or other I/O dependency — the response is constructed in code.
- Is otherwise unused by other course tasks. Only the TestResults analyzation task targets it.

## 2. API

### `GET /api/health`

#### Probabilistic behavior

On each invocation, the server picks a behavior at random:

| Probability | Behavior |
|---|---|
| 80% | Respond `200` quickly (~50ms) |
| 15% | Respond `200` slowly (random delay between 4000ms and 6000ms) |
| 5%  | Respond `503` quickly (~50ms) |

The random pick is independent per request — no per-client memory.

#### `200` response body

```json
{
  "status": "ok",
  "uptime": <integer milliseconds since server start>,
  "version": "<string, e.g. '1.0.0'>"
}
```

#### `503` response body

```json
{
  "error": "Service unavailable"
}
```

Headers: standard `Content-Type: application/json`.

## 3. Implementation notes

- **Use a pseudo-random source seeded per request**, not a fixed sequence. The test must see real variability across runs. `Math.random()` is fine.
- **The slow-200 delay is random within the range**, not always 5000ms. E.g. `4000 + Math.random() * 2000`.
- **The constants (80 / 15 / 5, 4–6s delay) should be easy to tune** later — extract them as named constants at the top of the file so Pavel can adjust the difficulty if it turns out too easy or too noisy.
- **Leave a comment in the handler** explaining that the flakiness is intentional for the AQA course. Without it, the next developer will think it's a bug and fix it. Something like:
  ```ts
  // INTENTIONAL FLAKY BEHAVIOR — this endpoint is the substrate for the
  // AQA Course "TestResults analyzation" task. Do not "fix" it.
  ```

## 4. Out of scope

- Authentication / authorization (the endpoint is public).
- Rate limiting.
- Real health checks (DB connectivity, external services). The endpoint is a teaching artifact, not a real ops health check.
- Per-client behavior modulation.
- Adding a non-flaky `/api/health-real` variant for genuine ops use — if MailLab needs a real health endpoint later, give it a different path.

## 5. Test acceptance for the MailLab dev

Run `curl http://localhost:<port>/api/health` 20 times in a tight loop. You should see:
- The majority (~16) return `200` quickly.
- A few (~3) take 4–6 seconds and then return `200`.
- A rare one (~1) returns `503`.

(Sampling 20 is noisy — exact counts will vary, but the rough distribution should be visible.)

## 6. Related course artifacts

- **Course task:** "TestResults analyzation" (template id `cmos7t3tf001h5zhnoxhmcc5g`). The task description tells the student to write a happy-path test against `/api/health`, run it 10–20 times, and analyze the failure patterns alongside their existing failing tests from DDT and the other tasks.
- **Combined substrate for TestResults:**
  - **Deterministic bugs** from the Profile feature (whitespace trim, phone `+` lost, signature off-by-one) — surface via the student's existing DDT tests, always fail the same way.
  - **Flaky behavior** from this `/api/health` endpoint — surfaces via the dedicated test, fails intermittently.
  - Together they give the student examples of both *consistent* and *intermittent* failures to analyze.
