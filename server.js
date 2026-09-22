/**
 * A todo list with a free limit and a paid upgrade.
 *
 * Small on purpose: this app exists to be TESTED, so every rule it has is one
 * a person can see happen.
 */
const crypto = require('crypto');
const path = require('path');
const express = require('express');

const app = express();
const PORT = Number(process.env.PORT || 3000);

/** How many todos the free plan allows. Small so the limit is easy to reach. */
const FREE_LIMIT = Number(process.env.FREE_LIMIT || 5);

/** Whether /api/test/reset works. Off unless a test environment asks for it. */
const ALLOW_RESET = String(process.env.ALLOW_TEST_RESET || '1') !== '0';

const PRICE_PENCE = 500;
const CURRENCY = 'gbp';
const COOKIE = 'todo_account';

// --- Stripe, when it is configured ----------------------------------------
//
// The app runs perfectly well without it: the upgrade button says it is not
// configured rather than throwing. That matters because the todo half of the
// app should be testable on a machine that has no keys.
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const stripe = STRIPE_SECRET_KEY ? require('stripe')(STRIPE_SECRET_KEY) : null;

// --- one account per browser ----------------------------------------------
//
// NOT one account for the whole process. That is how this app was written
// first, and it made the app untestable: a single payment turned the ONE
// account Pro for ever, so every later test of "the free plan stops at five
// todos" watched a sixth todo save happily. An agent looped four times over
// add-delete-add before giving up, and it was right to be confused
// (2026-09-22).
//
// A browser gets an id in a cookie, and its own todos and plan. Two browsers
// on one sandbox cannot see or spoil each other, which is exactly what the
// test agent needs when it opens a fresh browser per situation.
const accounts = new Map();

const blankAccount = () => ({ todos: [], nextId: 1, pro: false, upgradedAt: null });

const readCookie = (req, name) => {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return '';
};

/** The account for this browser, made on first sight. */
const accountFor = (req, res) => {
  let id = readCookie(req, COOKIE);
  if (!id || !accounts.has(id)) {
    id = crypto.randomUUID();
    accounts.set(id, blankAccount());
    // No expiry: the process forgets everything when it stops anyway, and a
    // session cookie keeps a browser's todos for as long as that browser is
    // open, which is what a test needs.
    res.setHeader('Set-Cookie', `${COOKIE}=${id}; Path=/; SameSite=Lax`);
  }
  return { id, account: accounts.get(id) };
};

const publicUrl = (req) => {
  // Behind the sandbox proxy the app is reached on a host it cannot guess, so
  // the return URL is built from the request rather than from a constant.
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
};

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- todos ----------------------------------------------------------------

app.get('/api/todos', (req, res) => {
  const { account } = accountFor(req, res);
  res.json({
    todos: account.todos,
    left: account.todos.filter((t) => !t.done).length,
    pro: account.pro,
    freeLimit: FREE_LIMIT,
    stripeReady: Boolean(stripe),
  });
});

app.post('/api/todos', (req, res) => {
  const { account } = accountFor(req, res);
  const title = String((req.body && req.body.title) || '').trim();
  if (!title) {
    return res.status(400).json({ error: 'A todo needs a title.' });
  }
  if (title.length > 200) {
    return res.status(400).json({ error: 'That title is too long — 200 characters at most.' });
  }
  if (!account.pro && account.todos.length >= FREE_LIMIT) {
    return res.status(402).json({
      error: `The free plan stops at ${FREE_LIMIT} todos. Upgrade to add more.`,
      needsUpgrade: true,
    });
  }
  const todo = { id: account.nextId++, title, done: false };
  account.todos.push(todo);
  res.status(201).json(todo);
});

app.patch('/api/todos/:id', (req, res) => {
  const { account } = accountFor(req, res);
  const todo = account.todos.find((t) => t.id === Number(req.params.id));
  if (!todo) return res.status(404).json({ error: 'No such todo.' });
  if (typeof (req.body || {}).done === 'boolean') todo.done = req.body.done;
  res.json(todo);
});

app.delete('/api/todos/:id', (req, res) => {
  const { account } = accountFor(req, res);
  const at = account.todos.findIndex((t) => t.id === Number(req.params.id));
  if (at < 0) return res.status(404).json({ error: 'No such todo.' });
  account.todos.splice(at, 1);
  res.status(204).end();
});

app.post('/api/todos/clear-completed', (req, res) => {
  const { account } = accountFor(req, res);
  account.todos = account.todos.filter((t) => !t.done);
  res.json({ todos: account.todos, left: account.todos.filter((t) => !t.done).length });
});

// --- putting the account back to the start --------------------------------
//
// A test needs to SET UP its starting state, not click its way toward one. A
// story that begins "a free account with five todos" cannot be proved by an
// agent that has no way back from Pro.
app.post('/api/test/reset', (req, res) => {
  if (!ALLOW_RESET) {
    return res.status(403).json({ error: 'Resetting is switched off here.' });
  }
  const { id } = accountFor(req, res);
  const fresh = blankAccount();
  const count = Number((req.body || {}).todos || 0);
  if ((req.body || {}).pro === true) fresh.pro = true;
  for (let i = 0; i < count; i += 1) {
    fresh.todos.push({ id: fresh.nextId++, title: `Todo ${i + 1}`, done: false });
  }
  accounts.set(id, fresh);
  res.json({
    ok: true,
    todos: fresh.todos,
    left: fresh.todos.filter((t) => !t.done).length,
    pro: fresh.pro,
    freeLimit: FREE_LIMIT,
  });
});

// --- paying for Pro -------------------------------------------------------

app.post('/api/checkout', async (req, res) => {
  const { id, account } = accountFor(req, res);
  if (!stripe) {
    return res.status(503).json({
      error: 'Payments are not set up on this copy of the app. Set STRIPE_SECRET_KEY to enable them.',
    });
  }
  if (account.pro) {
    return res.status(409).json({ error: 'This account is already on Pro.' });
  }
  try {
    const base = publicUrl(req);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: CURRENCY,
            unit_amount: PRICE_PENCE,
            product_data: { name: 'Todo Pro', description: 'Unlimited todos, for ever.' },
          },
        },
      ],
      // WHICH account paid. Stripe hands this back with the session, so the
      // right browser is upgraded even though the cookie does not travel to
      // Stripe and back.
      metadata: { account: id },
      // The session id comes back on the URL, so the app can confirm the
      // payment by ASKING Stripe. No webhook, which means no public address
      // and no tunnel — a sandbox on a laptop can take a payment end to end.
      success_url: `${base}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/upgrade/cancelled`,
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(502).json({ error: `Stripe would not start a checkout: ${err.message}` });
  }
});

app.get('/upgrade/success', async (req, res) => {
  const sessionId = String(req.query.session_id || '');
  if (!stripe || !sessionId) return res.redirect('/?upgrade=unknown');
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    // Trust Stripe, not the URL. Anyone can type /upgrade/success; only a
    // session Stripe agrees was paid turns an account Pro — and only the
    // account that started that checkout.
    if (session.payment_status === 'paid') {
      const paidFor = (session.metadata || {}).account || '';
      const account = accounts.get(paidFor);
      if (account) {
        account.pro = true;
        account.upgradedAt = Date.now();
        return res.redirect('/?upgrade=done');
      }
      // Paid, but that browser has gone (the app restarted, or the cookie was
      // cleared). Say so rather than silently upgrading nobody.
      return res.redirect('/?upgrade=lost');
    }
    return res.redirect('/?upgrade=unpaid');
  } catch (err) {
    return res.redirect('/?upgrade=unknown');
  }
});

app.get('/upgrade/cancelled', (_req, res) => res.redirect('/?upgrade=cancelled'));

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`todo app listening on ${PORT} (stripe ${stripe ? 'on' : 'off'})`);
});
