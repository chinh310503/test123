const express = require('express');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const alasql = require('alasql');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

alasql('CREATE TABLE users (id INT, username STRING, password STRING, email STRING)');
alasql('CREATE TABLE notes (id INT, author STRING, title STRING, body STRING)');
[[1, 'admin', 'admin123', 'admin@demo.local'],
 [2, 'alice', 'alice123', 'alice@demo.local']].forEach(u => {
  alasql('INSERT INTO users VALUES (?,?,?,?)', [u[0], u[1], bcrypt.hashSync(u[2], 10), u[3]]);
});
alasql('INSERT INTO notes VALUES (?,?,?,?)', [1, 'admin', 'Welcome', 'Welcome to NoteApp! Create and search your notes.']);
alasql('INSERT INTO notes VALUES (?,?,?,?)', [2, 'alice', 'Shopping list', 'Milk, eggs, coffee']);
let noteSeq = 2;

function getToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  const match = /(?:^|;\s*)token=([^;]+)/.exec(req.headers.cookie || '');
  return match ? decodeURIComponent(match[1]) : '';
}

function currentUser(req) {
  try {
    return jwt.verify(getToken(req), JWT_SECRET);
  } catch (e) {
    return null;
  }
}

function auth(req, res, next) {
  const user = currentUser(req);
  if (!user) {
    return res.status(401).send(layout('Unauthorized', '<h2>401 — please sign in</h2><a href="/login">Login</a>', null));
  }
  req.user = user;
  next();
}

function layout(title, body, user) {
  const account = user
    ? `<span class="user">Hi, ${esc(user.username)}</span><a href="/logout">Logout</a>`
    : `<a href="/login">Login</a>`;
  const profileLink = user ? '/profile/' + user.id : '/login';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · NoteApp</title>
<style>
 :root{--bg:#f8fafc;--fg:#0f172a;--muted:#64748b;--brand:#4f46e5;--border:#e2e8f0}
 *{box-sizing:border-box}
 body{font-family:system-ui,Segoe UI,Arial,sans-serif;margin:0;background:var(--bg);color:var(--fg);line-height:1.55}
 .wrap{max-width:720px;margin:0 auto;padding:0 16px}
 header.top{background:#fff;border-bottom:1px solid var(--border)}
 header.top .wrap{display:flex;align-items:center;justify-content:space-between;min-height:60px;flex-wrap:wrap;gap:8px}
 .brand{font-weight:700;font-size:18px;color:var(--brand);text-decoration:none}
 nav a{margin-left:16px;color:var(--fg);text-decoration:none;font-weight:500}
 nav a:hover{color:var(--brand)}
 .user{margin-left:16px;color:var(--muted);font-size:14px}
 main{padding:28px 0}
 h1,h2{margin-top:0}
 .card{background:#fff;border:1px solid var(--border);border-radius:10px;padding:18px;margin:14px 0}
 label{display:block;font-size:14px;color:var(--muted);margin-top:10px}
 input,textarea{width:100%;padding:10px;margin-top:4px;border:1px solid var(--border);border-radius:8px;font:inherit}
 button{margin-top:14px;padding:10px 18px;background:var(--brand);color:#fff;border:0;border-radius:8px;font-weight:600;cursor:pointer}
 button:hover{opacity:.92}
 code{background:#f1f5f9;padding:2px 6px;border-radius:5px;word-break:break-all}
 .muted{color:var(--muted);font-size:14px}
 .ok{color:#16a34a}.bad{color:#dc2626}
 footer{color:var(--muted);font-size:13px;text-align:center;padding:24px 0}
</style>
</head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="/">📝 NoteApp</a>
  <nav>
    <a href="/">Home</a>
    <a href="/search">Search</a>
    <a href="/notes">Notes</a>
    <a href="${profileLink}">Profile</a>
    ${account}
  </nav>
</div></header>
<main><div class="wrap">
${body}
</div></main>
<footer>NoteApp — capture your ideas.</footer>
</body>
</html>`;
}

app.get('/', (req, res) => {
  const user = currentUser(req);
  const hello = user ? `<p>You are signed in as <b>${esc(user.username)}</b>.</p>` : '';
  res.send(layout('Home', `
    <h1>Welcome to NoteApp</h1>
    <p class="muted">Write notes and search them.</p>
    ${hello}`, user));
});

app.get('/login', (req, res) => {
  res.send(layout('Login', `
    <h2>Login</h2>
    <form method="post" action="/login">
      <label>Username<input name="username" autofocus></label>
      <label>Password<input name="password" type="password"></label>
      <button>Sign in</button>
    </form>`, currentUser(req)));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const rows = alasql('SELECT * FROM users WHERE username = ?', [username]);
  const u = rows[0];
  if (u && bcrypt.compareSync(password || '', u.password)) {
    const token = jwt.sign({ id: u.id, username: u.username }, JWT_SECRET, { expiresIn: '1h' });
    res.setHeader('Set-Cookie', 'token=' + token + '; Path=/; HttpOnly; SameSite=Lax');
    return res.send(layout('Login successful', `
      <h2 class="ok">Login successful</h2>
      <p>Welcome, <b>${esc(u.username)}</b>.</p>
      <p><a href="/logout">Logout</a></p>`, u));
  }
  res.status(401).send(layout('Login failed', `
    <h2 class="bad">Invalid username or password</h2>
    <a href="/login">Try again</a>`, null));
});

app.get('/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
  res.redirect('/');
});

app.get('/search', (req, res) => {
  const q = req.query.q || '';
  const notes = q ? alasql('SELECT * FROM notes WHERE title LIKE ? OR body LIKE ?', ['%' + q + '%', '%' + q + '%']) : [];
  const list = notes.map(n => `<div class="card"><b>${esc(n.title)}</b><br>${esc(n.body)}</div>`).join('');
  res.send(layout('Search', `
    <h2>Search notes</h2>
    <form method="get" action="/search">
      <input name="q" value="${esc(q)}" placeholder="Search your notes">
      <button>Search</button>
    </form>
    ${q ? `<p>Results for: ${esc(q)}</p>${list || '<div class="card">No notes found.</div>'}` : ''}`, currentUser(req)));
});

app.get('/notes', (req, res) => {
  const notes = alasql('SELECT * FROM notes');
  const list = notes.map(n => `<div class="card"><b>${esc(n.title)}</b> <span class="muted">by ${esc(n.author)}</span><br>${esc(n.body)}</div>`).join('');
  res.send(layout('Notes', `
    <h2>Notes</h2>
    <form method="post" action="/notes">
      <label>Title<input name="title"></label>
      <label>Content<textarea name="body" rows="3"></textarea></label>
      <button>Add note</button>
    </form>
    <h3>All notes</h3>
    ${list}`, currentUser(req)));
});

app.post('/notes', (req, res) => {
  const { title, body } = req.body || {};
  const author = (currentUser(req) || {}).username || 'anon';
  alasql('INSERT INTO notes VALUES (?,?,?,?)', [++noteSeq, author, title || '', body || '']);
  res.redirect('/notes');
});

app.get('/profile/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  if (req.user.id !== id) {
    return res.status(403).send(layout('Forbidden', '<h2>403 — you cannot view this profile</h2>', req.user));
  }
  const rows = alasql('SELECT id, username, email FROM users WHERE id = ?', [id]);
  const u = rows[0];
  if (!u) return res.status(404).send(layout('Not found', '<h2>No such profile.</h2>', req.user));
  res.send(layout('Profile', `
    <h2>User profile</h2>
    <div class="card">
      <b>ID:</b> ${esc(u.id)}<br>
      <b>Username:</b> ${esc(u.username)}<br>
      <b>Email:</b> ${esc(u.email)}
    </div>`, req.user));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send(layout('Error', '<h2>Server error</h2>', null));
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log('NoteApp listening on http://localhost:' + PORT));
}
module.exports = app;
