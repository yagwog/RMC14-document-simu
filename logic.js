// ─── Colour palette ───────────────────────────────────────────────────────────
// Only names the game understands are offered. Anything else renders black in game.
const PALETTE = [
  "Black", "DimGray", "Gray", "DarkGray", "Silver", "Gainsboro", "WhiteSmoke", "White",
  "DarkRed", "FireBrick", "IndianRed", "Crimson", "Red", "Tomato", "OrangeRed", "DarkOrange",
  "Coral", "LightCoral", "Chocolate", "SaddleBrown", "Sienna", "Brown", "RosyBrown", "Peru",
  "SandyBrown", "GoldenRod", "DarkGoldenRod", "Gold", "Yellow", "Khaki", "DarkKhaki", "PaleGoldenRod",
  "LightGoldenRodYellow", "LemonChiffon", "LightYellow", "Olive", "DarkOliveGreen", "OliveDrab", "DarkGreen", "Green",
  "ForestGreen", "SeaGreen", "MediumSeaGreen", "LightSeaGreen", "SpringGreen", "LawnGreen", "Chartreuse", "GreenYellow",
  "LimeGreen", "Lime", "PaleGreen", "LightGreen", "MediumSpringGreen", "Teal", "DarkCyan", "MediumTurquoise",
  "Turquoise", "DarkTurquoise", "Aqua", "Aquamarine", "PaleTurquoise", "PowderBlue", "LightBlue", "SkyBlue",
  "DeepSkyBlue", "DodgerBlue", "CornflowerBlue", "SteelBlue", "RoyalBlue", "Blue", "MediumBlue", "DarkBlue",
  "Navy", "MidnightBlue", "Indigo", "DarkSlateBlue", "SlateBlue", "MediumSlateBlue", "MediumPurple", "BlueViolet",
  "DarkViolet", "DarkOrchid", "MediumOrchid", "Purple", "Fuchsia", "Magenta", "Orchid", "Violet",
  "Plum", "Thistle", "Lavender", "PeachPuff", "Moccasin", "NavajoWhite", "Bisque", "BlanchedAlmond",
  "Cornsilk", "PapayaWhip", "AntiqueWhite", "FloralWhite", "Ivory", "Beige", "Linen", "OldLace",
  "GhostWhite", "AliceBlue",
].filter(name => ROBUST_NAMED_COLORS[name.toLowerCase()]);

const $ = id => document.getElementById(id);
const px = n => `${n}px`;

// Paper and business cards each have their own editor, so each keeps its own text,
// caret and undo history while you switch between them.
const MODES = ['paper', 'card'];
const editors = { paper: $('editor'), card: $('card-editor') };
let mode = 'paper';
let editor = editors.paper;

const canvas = $('paper');
const controlsLayer = $('paper-controls');
const paperWindow = $('game-window');
const cardWindow = $('card-window');
const cardCanvas = $('card-canvas');

let currentModel = null;
const loadedTemplates = { paper: null, card: null }; // { path, text } for each editor

// ─── Small storage helpers (per-browser conveniences only) ───────────────────
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  },
};

// ─── Editing helpers ──────────────────────────────────────────────────────────
// Edits go through execCommand so the browser's own Ctrl+Z / Ctrl+Y keep working.
function editRange(start, end, text, { select = 'end' } = {}) {
  text = text.replace(/\r\n?/g, '\n'); // textareas only ever hold \n
  editor.focus();
  editor.setSelectionRange(start, end);
  let ok = false;
  try { ok = document.execCommand('insertText', false, text); } catch { ok = false; }
  if (!ok || editor.value.slice(start, start + text.length) !== text) {
    editor.setRangeText(text, start, end, select);
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function replaceAll(text) {
  editRange(0, editor.value.length, text);
  editor.setSelectionRange(0, 0);
  editor.scrollTop = 0;
}

function insertTag(tag) {
  const s = editor.selectionStart, e = editor.selectionEnd;
  const sel = editor.value.slice(s, e);
  const open = `[${tag}]`;
  const close = `[/${tag.split('=')[0]}]`;
  editRange(s, e, open + sel + close);
  const caret = sel.length ? s + open.length + sel.length + close.length : s + open.length;
  editor.setSelectionRange(caret, caret);
}

function insertText(text) {
  const s = editor.selectionStart, e = editor.selectionEnd;
  editRange(s, e, text);
}

// Centre lines using the game's real character widths and the current wrap width.
function centerText() {
  if (!RobustFonts.ready) return;
  const v = editor.value;
  const s = v.lastIndexOf('\n', editor.selectionStart - 1) + 1;
  let e = v.indexOf('\n', Math.max(editor.selectionEnd - (editor.selectionEnd > editor.selectionStart ? 1 : 0), s));
  if (e === -1) e = v.length;
  const width = currentModel ? currentModel.wrapWidth : PAPER.windowWidth - PAPER.border * 2;
  const space = RobustFonts.defaultFont().charAdvance(0x20) || 4;
  const centred = v.slice(s, e).split('\n').map(line => {
    const trimmed = line.replace(/^[ \t]+/, '').replace(/[ \t]+$/, '');
    if (!trimmed) return trimmed;
    const w = PaperRenderer.measureLine(trimmed, mode, { round: getRound() });
    const pad = Math.max(0, Math.floor((width - w) / 2 / space));
    return ' '.repeat(pad) + trimmed;
  }).join('\n');
  editRange(s, e, centred);
  editor.setSelectionRange(s, s + centred.length);
}

// ─── Rendering ────────────────────────────────────────────────────────────────
let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; render(); });
}

function render() {
  if (!RobustFonts.ready) return;
  const opts = { round: getRound() };
  const card = mode === 'card';
  const model = card ? PaperRenderer.layoutCard(editor.value, opts) : PaperRenderer.layoutPaper(editor.value, undefined, opts);
  currentModel = model;
  const target = card ? cardCanvas : canvas;
  PaperRenderer.paint(target, model, window.devicePixelRatio || 1);
  target.style.width = px(model.width);
  target.style.height = px(model.height);
  if (!card) layoutWindow(model); // the card window never changes size
  renderControls(model);
  renderStatus(model);
  renderDiagnostics(model);
}

// ─── In-game paper window ─────────────────────────────────────────────────────
// The preview is a copy of the game's PaperWindow at its default 520×660 size: a 54px
// close-button row, then a scroll area. When the paper is taller than that area the
// game shows a 10px scrollbar on the right and the paper gets 10px narrower, so the
// text re-wraps.
const scroller = $('paper-scroller');
const paperFrame = $('paper-frame');
const gameScrollbar = $('game-scrollbar');
const grabber = $('game-grabber');

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function layoutWindow(model) {
  scroller.style.width = px(model.contentWidth);
  paperFrame.style.marginLeft = px(model.paperX);
  paperFrame.style.width = px(model.width);
  paperFrame.style.height = px(model.height);
  gameScrollbar.hidden = !model.scrolls;
  if (!model.scrolls) scroller.scrollTop = 0;
  updateGrabber();
}

// Grabber maths from Robust's ScrollBar: the track is the bar's height minus the
// 10px minimum grabber size, and the grabber spans Page/Max of it plus that 10px.
function updateGrabber() {
  const m = currentModel;
  if (!m || m.kind !== 'paper' || !m.scrolls) return;
  const track = Math.max(0, m.viewportHeight - PAPER.scrollbarWidth);
  const max = m.height;
  const value = clamp(scroller.scrollTop, 0, m.scrollMax);
  const start = value / max * track;
  const end = (value + m.viewportHeight) / max * track + PAPER.scrollbarWidth;
  grabber.style.top = px(start);
  grabber.style.height = px(end - start);
}

scroller.addEventListener('scroll', () => {
  updateGrabber();
  if (!fieldPopover.hidden) closeFieldPopover();
});

// Dragging the grabber scrolls the paper, using the same ratio the game uses.
grabber.addEventListener('pointerdown', ev => {
  const m = currentModel;
  if (!m || m.kind !== 'paper' || !m.scrolls) return;
  ev.preventDefault();
  try { grabber.setPointerCapture(ev.pointerId); } catch { /* pointer already gone */ }
  grabber.classList.add('grabbed');
  const startY = ev.clientY, startValue = scroller.scrollTop;
  const track = Math.max(1, m.viewportHeight - PAPER.scrollbarWidth);
  const move = e => { scroller.scrollTop = startValue + (e.clientY - startY) * m.height / track; };
  const up = () => {
    grabber.classList.remove('grabbed');
    grabber.removeEventListener('pointermove', move);
    grabber.removeEventListener('pointerup', up);
    grabber.removeEventListener('pointercancel', up);
  };
  grabber.addEventListener('pointermove', move);
  grabber.addEventListener('pointerup', up);
  grabber.addEventListener('pointercancel', up);
});

// Mouse wheel over the scrollbar strip still scrolls the paper, like in game.
gameScrollbar.addEventListener('wheel', ev => {
  scroller.scrollTop += ev.deltaY;
  ev.preventDefault();
}, { passive: false });

// ─── Inline controls ──────────────────────────────────────────────────────────
const BUTTON_TITLES = {
  form: 'Fill in this field',
  signature: 'Sign here',
  check: 'Tick or cross this box',
  date: 'Write the in-game date here',
  time: 'Write the in-game time here',
};

// Only paper has buttons: business cards don't allow the tags that make them.
function renderControls(model) {
  controlsLayer.textContent = '';
  for (const c of model.controls) {
    const b = document.createElement('button');
    b.className = 'paper-btn';
    b.textContent = c.label;
    b.dataset.kind = c.kind;
    b.dataset.index = c.index;
    b.title = BUTTON_TITLES[c.kind];
    b.style.left = px(model.origin.x + c.x);
    b.style.top = px(model.origin.y + c.y);
    b.style.width = px(c.w);
    b.style.height = px(c.h);
    b.style.paddingLeft = px(PaperRenderer.buttonLabelX(c.w, c.label, model.defaultFont));
    controlsLayer.appendChild(b);
  }
}

function renderStatus(model) {
  const status = $('paper-status');
  status.textContent = '';
  if (model.kind === 'card') {
    const count = document.createElement('span');
    count.className = model.length > model.maxLength ? 'count over' : 'count';
    count.textContent = `${model.length}/${model.maxLength}`;
    status.append(count, ` characters, the count the game shows while you write. The card is ${model.window.width}×${model.surface.h}px, text wraps at ${model.wrapWidth}px, and business cards never scroll.`);
  } else {
    status.textContent = model.scrolls
      ? `Scrollbar showing, like in game. The paper is ${model.width}px wide and text wraps at ${model.wrapWidth}px, 10px narrower than without it.`
      : `No scrollbar at this window size. The paper is ${model.width}px wide and text wraps at ${model.wrapWidth}px.`;
  }
}

function renderDiagnostics(model) {
  const list = $('diagnostics');
  list.textContent = '';
  for (const d of model.diagnostics) {
    const li = document.createElement('li');
    li.className = d.level;
    const line = document.createElement('span');
    line.className = 'line';
    line.textContent = d.line ? `Line ${d.line}` : '';
    const msg = document.createElement('span');
    msg.textContent = d.msg;
    li.append(line, msg);
    if (d.line) li.addEventListener('click', () => goToLine(d.line));
    list.appendChild(li);
  }
}

function goToLine(n) {
  const lines = editor.value.split('\n');
  let pos = 0;
  for (let i = 0; i < n - 1 && i < lines.length; i++) pos += lines[i].length + 1;
  editor.focus();
  editor.setSelectionRange(pos, pos + (lines[n - 1] || '').length);
  const lineHeight = parseFloat(getComputedStyle(editor).lineHeight) || 20;
  editor.scrollTop = Math.max(0, (n - 5) * lineHeight);
}

// ─── Fill / Sign / Check / Date / Time buttons ───────────────────────────────
const fieldPopover = $('field-popover');
let selectedButton = null;

function closeFieldPopover() {
  fieldPopover.hidden = true;
  fieldPopover.textContent = '';
  if (selectedButton) selectedButton.classList.remove('selected');
  selectedButton = null;
}

function openPopoverAt(pop, anchor) {
  pop.hidden = false;
  const r = anchor.getBoundingClientRect();
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let left = Math.min(r.left, window.innerWidth - pw - 8);
  let top = r.bottom + 6;
  if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);
  pop.style.left = px(Math.max(8, left));
  pop.style.top = px(top);
}

function popoverRow(...buttons) {
  const row = document.createElement('div');
  row.className = 'row';
  row.append(...buttons);
  return row;
}

function popoverButton(text, onClick) {
  const b = document.createElement('button');
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

function popoverHint(text) {
  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = text;
  return hint;
}

// A labelled text box per [key, label, placeholder], all saved together with Enter.
function popoverFields(prefix, specs, values, submit) {
  const fields = {};
  for (const [key, label, ph] of specs) {
    const l = document.createElement('label');
    l.textContent = label;
    const i = document.createElement('input');
    i.type = 'text';
    i.className = 'field-input';
    i.placeholder = ph;
    i.value = values[key] || '';
    l.htmlFor = i.id = `${prefix}-${key}`;
    i.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); submit(); } });
    fields[key] = i;
    fieldPopover.append(l, i);
  }
  return fields;
}

// The nth button of a kind replaces the nth literal tag, exactly like the game.
function replaceNthTag(tag, index, replacement) {
  const pos = PaperRenderer.findNthTag(editor.value, tag, index);
  if (pos < 0) return;
  const scroll = scroller.scrollTop;
  editRange(pos, pos + tag.length, replacement);
  requestAnimationFrame(() => requestAnimationFrame(() => { scroller.scrollTop = scroll; }));
}

function openFormDialog(btn, index) {
  closeFieldPopover();
  selectedButton = btn;
  btn.classList.add('selected');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'field-input';
  input.placeholder = 'Type and press Enter';
  const submit = () => {
    const value = input.value;
    closeFieldPopover();
    if (value) replaceNthTag('[form]', index, value);
  };
  fieldPopover.append(input, popoverRow(popoverButton('OK', submit), popoverButton('Cancel', closeFieldPopover)));
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); submit(); }
    if (ev.key === 'Escape') closeFieldPopover();
  });
  openPopoverAt(fieldPopover, btn);
  input.focus();
}

function openCheckDialog(btn, index) {
  closeFieldPopover();
  selectedButton = btn;
  btn.classList.add('selected');
  const wrap = document.createElement('div');
  wrap.className = 'check-choices';
  for (const [symbol, label] of [['☐', 'Blank'], ['✔', 'Check'], ['✖', 'Cross']]) {
    wrap.appendChild(popoverButton(`${symbol} ${label}`, () => { closeFieldPopover(); replaceNthTag('[check]', index, symbol); }));
  }
  fieldPopover.append(wrap);
  openPopoverAt(fieldPopover, btn);
  wrap.firstChild.focus();
}

// PaperSystem.GetWorldDateTime: the in-game date is a hundred years after today. The
// in-game time is a random offset plus the round's length, so the time now is as good
// as any. Both are written the way the server formats them.
const pad2 = n => String(n).padStart(2, '0');
function gameDate(now = new Date()) { return `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear() + 100}`; }
function gameTime(now = new Date()) { return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`; }

// Signature format from PaperSystem.GetPlayerSignature: "Rank Name, Role".
function getIdentity() { return store.get('ss14paper.identity', { rank: '', name: '', role: '' }); }
function signatureText(id = getIdentity()) {
  const { rank, name, role } = id;
  if (rank && name && role) return `${rank} ${name}, ${role}`;
  if (rank && name) return `${rank} ${name}`;
  if (name && role) return `${name}, ${role}`;
  return name;
}
function updateIdentityLabel() {
  $('identity-label').textContent = signatureText() || 'Not set';
}

function openIdentityDialog(anchor, onSaved) {
  closeFieldPopover();
  const submit = () => {
    const next = { rank: fields.rank.value.trim(), name: fields.name.value.trim(), role: fields.role.value.trim() };
    store.set('ss14paper.identity', next);
    updateIdentityLabel();
    closeFieldPopover();
    if (onSaved && next.name) onSaved();
  };
  const fields = popoverFields('identity',
    [['rank', 'Rank (short)', 'e.g. Cpl.'], ['name', 'Name', 'e.g. John Doe'], ['role', 'Role', 'e.g. Rifleman']],
    getIdentity(), submit);
  fieldPopover.append(
    popoverHint('Signing writes "Rank Name, Role" like the game does. Saved in this browser only.'),
    popoverRow(popoverButton(onSaved ? 'Save and sign' : 'Save', submit), popoverButton('Cancel', closeFieldPopover)));
  openPopoverAt(fieldPopover, anchor);
  fields.name.value ? fields.rank.focus() : fields.name.focus();
}

// What [operation], [planet] and [ship] show. The game fills these in when a round starts.
function getRound() { return store.get('ss14paper.round', { operation: '', planet: '', ship: '' }); }
function updateRoundLabel() {
  const r = getRound();
  $('round-label').textContent = [r.operation, r.planet, r.ship].filter(Boolean).join(' · ') || 'Not set';
}

function openRoundDialog(anchor) {
  closeFieldPopover();
  const submit = () => {
    store.set('ss14paper.round', { operation: fields.operation.value.trim(), planet: fields.planet.value.trim(), ship: fields.ship.value.trim() });
    updateRoundLabel();
    closeFieldPopover();
    scheduleRender();
  };
  const fields = popoverFields('round',
    [['operation', 'Operation', 'Operation name'], ['planet', 'Planet', 'Planet name'], ['ship', 'Ship', 'Ship name']],
    getRound(), submit);
  fieldPopover.append(
    popoverHint('What [operation], [planet] and [ship] show. Blank ones show "Unknown Operation" and so on, like the game does without a round. Saved in this browser only.'),
    popoverRow(popoverButton('Save', submit), popoverButton('Cancel', closeFieldPopover)));
  openPopoverAt(fieldPopover, anchor);
  fields.operation.focus();
}

// Paper buttons work like in game.
controlsLayer.addEventListener('click', ev => {
  const btn = ev.target.closest('.paper-btn');
  if (!btn) return;
  ev.stopPropagation();
  const index = Number(btn.dataset.index);
  switch (btn.dataset.kind) {
    case 'form': openFormDialog(btn, index); break;
    case 'check': openCheckDialog(btn, index); break;
    case 'date': replaceNthTag('[date]', index, gameDate()); break;
    case 'time': replaceNthTag('[time]', index, gameTime()); break;
    case 'signature': {
      const sign = () => replaceNthTag('[signature]', index, signatureText());
      if (signatureText()) sign();
      else openIdentityDialog(btn, sign);
      break;
    }
  }
});

// ─── Colour picker ────────────────────────────────────────────────────────────
const colorPopover = $('color-popover');
function buildColorGrid() {
  const grid = $('color-grid');
  for (const name of PALETTE) {
    const box = document.createElement('button');
    box.className = 'color-box';
    box.style.background = ROBUST_NAMED_COLORS[name.toLowerCase()];
    box.title = name;
    box.setAttribute('aria-label', name);
    box.addEventListener('click', () => insertColor(name));
    grid.appendChild(box);
  }
}
function insertColor(c) {
  colorPopover.hidden = true;
  insertTag(`color=${c}`);
}
$('hex-picker').addEventListener('input', e => { $('hex-input').value = e.target.value; });
$('hex-input').addEventListener('input', e => {
  if (/^#[0-9a-f]{6}$/i.test(e.target.value)) $('hex-picker').value = e.target.value;
});
function useHex() {
  const h = $('hex-input').value.trim();
  if (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(h)) insertColor(h);
  else $('hex-input').focus();
}
$('hex-insert').addEventListener('click', useHex);
$('hex-input').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); useHex(); } });

// ─── Files ───────────────────────────────────────────────────────────────────
function baseFileName() {
  const t = loadedTemplates[mode];
  if (t) return t.path.split('/').pop().replace(/\.txt$/i, '');
  return mode === 'card' ? 'business-card' : 'document';
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function saveTextAsFile() {
  download(new Blob([editor.value], { type: 'text/plain' }), `${baseFileName()}.txt`);
}

// Saves just the white paper or card, with the buttons drawn in.
function saveRenderAsImage() {
  if (!currentModel) return;
  const out = document.createElement('canvas');
  PaperRenderer.paint(out, currentModel, 2, { drawControls: true, surfaceOnly: true });
  out.toBlob(blob => download(blob, `${baseFileName()}.png`), 'image/png');
}

$('file-input').addEventListener('change', e => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => { loadedTemplates[mode] = null; markActiveTemplate(); replaceAll(String(r.result)); };
  r.readAsText(f);
  e.target.value = '';
});

// ─── Paper / business card switch ────────────────────────────────────────────
function setMode(next, { initial = false } = {}) {
  if (!MODES.includes(next) || (next === mode && !initial)) return;
  mode = next;
  editor = editors[mode];
  const card = mode === 'card';
  document.body.classList.toggle('mode-card', card);
  for (const b of document.querySelectorAll('.mode-switch button')) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  for (const m of MODES) editors[m].hidden = m !== mode;
  paperWindow.hidden = card;
  cardWindow.hidden = !card;
  closeFieldPopover();
  colorPopover.hidden = true;
  markActiveTemplate();
  store.set('ss14paper.mode', mode);
  try { history.replaceState(null, '', card ? '#card' : location.pathname + location.search); } catch { /* file:// pages */ }
  if (!initial) editor.focus();
  render();
}

function initialMode() {
  if (location.hash === '#card') return 'card';
  if (location.hash === '#paper') return 'paper';
  const saved = store.get('ss14paper.mode', 'paper');
  return MODES.includes(saved) ? saved : 'paper';
}

document.querySelector('.mode-switch').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-mode]');
  if (b) setMode(b.dataset.mode);
});

// ─── Toolbar wiring ───────────────────────────────────────────────────────────
document.querySelector('.tools').addEventListener('click', ev => {
  const b = ev.target.closest('button');
  if (!b) return;
  if (b.dataset.tag) return insertTag(b.dataset.tag);
  if (b.dataset.insert) return insertText(b.dataset.insert);
  switch (b.dataset.action) {
    case 'bullet': insertText('[bullet/]'); break;
    case 'center': centerText(); break;
    case 'color':
      ev.stopPropagation();
      if (colorPopover.hidden) openPopoverAt(colorPopover, b); else colorPopover.hidden = true;
      break;
    case 'finalize': {
      const cleaned = PaperRenderer.cleanUnfilledTags(editor.value);
      if (cleaned !== editor.value) replaceAll(cleaned);
      break;
    }
    case 'import': $('file-input').click(); break;
    case 'save-text': saveTextAsFile(); break;
    case 'save-image': saveRenderAsImage(); break;
  }
});
$('identity-btn').addEventListener('click', ev => { ev.stopPropagation(); openIdentityDialog(ev.currentTarget); });
$('round-btn').addEventListener('click', ev => { ev.stopPropagation(); openRoundDialog(ev.currentTarget); });

for (const ed of Object.values(editors)) ed.addEventListener('input', scheduleRender);

document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape') { closeFieldPopover(); colorPopover.hidden = true; }
  if (!(ev.ctrlKey || ev.metaKey) || ev.target !== editor) return;
  const k = ev.key.toLowerCase();
  if (k === 'b') { ev.preventDefault(); insertTag('bold'); }
  if (k === 'i') { ev.preventDefault(); insertTag('italic'); }
});

// Click-away closes popovers.
document.addEventListener('mousedown', ev => {
  if (!colorPopover.hidden && !colorPopover.contains(ev.target) && !ev.target.closest('#color-btn')) colorPopover.hidden = true;
  if (!fieldPopover.hidden && !fieldPopover.contains(ev.target) && !ev.target.closest('.paper-btn, .popover-anchor')) closeFieldPopover();
});

// ─── Templates ────────────────────────────────────────────────────────────────
// Templates come from the templates-upstream git submodule. The "Sync Templates"
// workflow bumps it daily and regenerates template-list.json.
const TEMPLATE_BASE = 'templates-upstream/Main/RMC14/';
const templateCache = new Map();

const FOLDER_ICON = `<svg class="folder-icon" viewBox="0 0 16 16" aria-hidden="true">
  <g class="closed"><path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3.6l1.5 1.6h5.9A1.5 1.5 0 0 1 15 5.1v7.4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5z" fill="var(--folder)"/></g>
  <g class="open"><path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3.6l1.5 1.6h5.4A1.5 1.5 0 0 1 14.5 5.1V6H4.2a1.5 1.5 0 0 0-1.4 1L1 12z" fill="var(--folder)" opacity=".75"/><path d="M2.9 7.2A1 1 0 0 1 3.8 6.6h11a.7.7 0 0 1 .7.9l-1.6 5.6a1.2 1.2 0 0 1-1.2.9H1.6z" fill="var(--folder)"/></g>
</svg>`;

function templateUrl(path) {
  return TEMPLATE_BASE + path.split('/').map(encodeURIComponent).join('/');
}

function buildTree(paths) {
  const root = { folders: new Map(), files: [] };
  for (const p of paths) {
    const parts = p.split('/');
    let node = root;
    for (const part of parts.slice(0, -1)) {
      if (!node.folders.has(part)) node.folders.set(part, { folders: new Map(), files: [] });
      node = node.folders.get(part);
    }
    node.files.push(p);
  }
  return root;
}

function renderTree(node, container) {
  const byName = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  for (const name of [...node.folders.keys()].sort(byName)) {
    const det = document.createElement('details');
    det.className = 'tree-folder';
    const sum = document.createElement('summary');
    sum.innerHTML = FOLDER_ICON;
    sum.append(document.createTextNode(name));
    sum.title = name;
    const kids = document.createElement('div');
    kids.className = 'tree-children';
    det.append(sum, kids);
    renderTree(node.folders.get(name), kids);
    container.appendChild(det);
  }
  for (const path of node.files.sort((a, b) => byName(a.split('/').pop(), b.split('/').pop()))) {
    const b = document.createElement('button');
    b.className = 'tree-file';
    const label = path.split('/').pop().replace(/\.txt$/i, '');
    b.textContent = label;
    b.title = label;
    b.dataset.path = path;
    container.appendChild(b);
  }
}

// Highlights the template the current editor was loaded from, if any.
function markActiveTemplate() {
  const t = loadedTemplates[mode];
  document.querySelectorAll('.tree-file').forEach(el => el.classList.toggle('active', !!t && el.dataset.path === t.path));
}

async function fetchTemplate(path) {
  if (templateCache.has(path)) return templateCache.get(path);
  const res = await fetch(templateUrl(path));
  if (!res.ok) throw new Error(res.status);
  const text = await res.text();
  templateCache.set(path, text);
  return text;
}

async function loadTemplate(btn) {
  const path = btn.dataset.path;
  const loaded = loadedTemplates[mode];
  const dirty = editor.value.trim() !== '' && (!loaded || editor.value !== loaded.text);
  if (dirty && !confirm('Replace your current text with this template? You can undo with Ctrl+Z.')) return;
  btn.classList.add('loading');
  try {
    const text = await fetchTemplate(path);
    replaceAll(text);
    loadedTemplates[mode] = { path, text: editor.value };
    markActiveTemplate();
  } catch {
    alert('Failed to load template ☹');
  } finally {
    btn.classList.remove('loading');
  }
}

function filterTree(query) {
  const tree = $('template-tree');
  const q = query.trim().toLowerCase();
  let shown = 0;
  tree.querySelectorAll('.tree-file').forEach(f => {
    const match = !q || f.dataset.path.toLowerCase().includes(q);
    f.hidden = !match;
    if (match) shown++;
  });
  // Deepest folders first so parents can see whether any child is visible.
  const folders = [...tree.querySelectorAll('.tree-folder')].reverse();
  for (const d of folders) {
    const visible = !!d.querySelector(':scope > .tree-children > .tree-file:not([hidden]), :scope > .tree-children > .tree-folder:not([hidden])');
    d.hidden = !visible;
    if (q) d.open = visible;
  }
  if (!q) folders.forEach(d => { d.open = d.dataset.userOpen === '1'; });
  let empty = tree.querySelector('.tree-empty');
  if (!shown) {
    if (!empty) { empty = document.createElement('div'); empty.className = 'tree-empty'; tree.appendChild(empty); }
    empty.textContent = 'No templates match.';
  } else if (empty) empty.remove();
}

async function initTemplates() {
  const tree = $('template-tree');
  try {
    const res = await fetch('template-list.json');
    const list = await res.json();
    tree.textContent = '';
    renderTree(buildTree(list), tree);
    tree.setAttribute('aria-busy', 'false');
    $('tpl-count').textContent = list.length;
  } catch {
    tree.textContent = 'Could not load the template list.';
    return;
  }
  tree.addEventListener('click', ev => {
    const f = ev.target.closest('.tree-file');
    if (f) loadTemplate(f);
  });
  // Remember which folders the user opened, so clearing a search restores them.
  tree.addEventListener('toggle', ev => {
    if (!$('tpl-search').value.trim()) ev.target.dataset.userOpen = ev.target.open ? '1' : '0';
  }, true);
  // Warm the cache when hovering so the click feels instant.
  tree.addEventListener('pointerover', ev => {
    const f = ev.target.closest('.tree-file');
    if (f && !templateCache.has(f.dataset.path)) fetchTemplate(f.dataset.path).catch(() => {});
  });
  $('tpl-search').addEventListener('input', e => filterTree(e.target.value));
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
buildColorGrid();
updateIdentityLabel();
updateRoundLabel();
initTemplates();
setMode(initialMode(), { initial: true });


RobustFonts.load()
  .then(() => {
    $('paper-loading').hidden = true;
    $('card-loading').hidden = true;
    render();
  })
  .catch(err => {
    console.error(err);
    const msg = 'Could not load the fonts. Open the site through a web server (for example VS Code Live Server), not as a file.';
    $('paper-loading').textContent = msg;
    $('card-loading').textContent = msg;
  });

// Re-render when the screen's pixel density changes (zoom, moving monitors).
matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener?.('change', () => render());
window.addEventListener('resize', () => scheduleRender());
