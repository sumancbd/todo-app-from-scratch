/**
 * A todo list with a free limit and a paid upgrade.
 *
 * Small on purpose: this app exists to be TESTED, so every rule it has is one
 * a person can see happen. No database — a sandbox starts fresh every time,
 * and a test that depends on yesterday's data is a test that fails on Monday.
 */
const path = require('path');
const express = require('express');

const app = express();
const PORT = Number(process.env.PORT || 3000);

/** How many todos the free plan allows. Small so the limit is easy to reach. */
const FREE_LIMIT = Number(process.env.FREE_LIMIT || 5);

const PRICE_PENCE = 500;
const CURRENCY = 'gbp';

// --- Stripe, when it is configured ----------------------------------------
//
// The app runs perfectly well without it: the upgrade button says it is not
// configured rather than throwing. That matters because the todo half of the
// app should be testable on a machine that has no keys.
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const stripe = STRIPE_SECRET_KEY ? require('stripe')(STRIPE_SECRET_KEY) : null;

// --- the whole state of the world -----------------------------------------
let nextId = 1;
const todos = [];
const account = { pro: false, upgradedAt: null };

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

app.get('/api/todos', (_req, res) => {
  res.json({
    todos,
    left: todos.filter((t) => !t.done).length,
    pro: account.pro,
    freeLimit: FREE_LIMIT,
    stripeReady: Boolean(stripe),
  });
});

app.post('/api/todos', (req, res) => {
  const title = String((req.body && req.body.title) || '').trim();
  if (!title) {
    return res.status(400).json({ error: 'A todo needs a title.' });
  }
  if (title.length > 200) {
    return res.status(400).json({ error: 'That title is too long — 200 characters at most.' });
  }
  if (!account.pro && todos.length >= FREE_LIMIT) {
    return res.status(402).json({
      error: `The free plan stops at ${FREE_LIMIT} todos. Upgrade to add more.`,
      needsUpgrade: true,
    });
  }
  const todo = { id: nextId++, title, done: false };
  todos.push(todo);
  res.status(201).json(todo);
});

app.patch('/api/todos/:id', (req, res) => {
  const todo = todos.find((t) => t.id === Number(req.params.id));
  if (!todo) return res.status(404).json({ error: 'No such todo.' });
  if (typeof (req.body || {}).done === 'boolean') todo.done = req.body.done;
  res.json(todo);
});

app.delete('/api/todos/:id', (req, res) => {
  const at = todos.findIndex((t) => t.id === Number(req.params.id));
  if (at < 0) return res.status(404).json({ error: 'No such todo.' });
  todos.splice(at, 1);
  res.status(204).end();
});

app.post('/api/todos/clear-completed', (_req, res) => {
  for (let i = todos.length - 1; i >= 0; i -= 1) {
    if (todos[i].done) todos.splice(i, 1);
  }
  res.json({ todos, left: todos.filter((t) => !t.done).length });
});

// --- paying for Pro -------------------------------------------------------

app.post('/api/checkout', async (req, res) => {
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
    // session Stripe agrees was paid turns the account Pro.
    if (session.payment_status === 'paid') {
      account.pro = true;
      account.upgradedAt = Date.now();
      return res.redirect('/?upgrade=done');
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
