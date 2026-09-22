# todo-app-from-scratch

A small todo list with a free limit and a paid upgrade. It exists to be
**tested**: every rule it has is one a person can watch happen in a browser.

## What it does

- Add todos, tick them off, delete them, clear the completed ones.
- Filter by All / Active / Completed, with a count of what is left.
- The free plan stops at **5 todos**. The sixth is refused, with a message
  saying so.
- Upgrading through Stripe removes the limit.

## Running it

```bash
npm install
npm start          # http://localhost:3000
```

It runs without Stripe. The upgrade button simply says payments are not set
up, so the todo half of the app is testable on a machine with no keys.

## Turning payments on

Stripe needs one variable. **Use a test key** — one that starts `sk_test_`:

```bash
export STRIPE_SECRET_KEY=sk_test_...
npm start
```

In a sandbox, add `STRIPE_SECRET_KEY` under Environments → Apps & variables.

Stripe's own test cards work: `4242 4242 4242 4242`, any future expiry, any
CVC, any postcode.

### No webhook, on purpose

Checkout returns to `/upgrade/success?session_id=...` and the app asks Stripe
whether that session was actually paid. So there is nothing to receive a
webhook, which means no public address and no tunnel: a sandbox on a laptop
can take a payment end to end.

It trusts Stripe rather than the URL — visiting `/upgrade/success` by hand
proves nothing, because only a session Stripe agrees was paid turns the
account Pro.

## Data

There is no database. State lives in memory and starts empty every time the
app boots, which is what a sandbox wants: a test that depends on yesterday's
data is a test that fails on Monday.
