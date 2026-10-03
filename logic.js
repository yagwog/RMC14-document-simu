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
const editor = $('editor');
const canvas = $('paper');
const controlsLayer = $('paper-controls');

let currentModel = null;
let loadedTemplate = null; // { path, text }

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
    const w = PaperRenderer.measureLine(trimmed);
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
  const model = PaperRenderer.layout(editor.value);
  currentModel = model;
  const dpr = window.devicePixelRatio || 1;
  PaperRenderer.paint(canvas, model, dpr);
  canvas.style.width = `${model.width}px`;
  canvas.style.height = `${model.height}px`;
  renderControls(model);
  renderStatus(model);
  renderDiagnostics(model);
}

function renderControls(model) {
  controlsLayer.textContent = '';
  for (const c of model.controls) {
    const b = document.createElement('button');
    b.className = 'paper-btn';
    b.textContent = c.label;
    b.dataset.kind = c.kind;
    b.dataset.index = c.index;
    b.style.left = `${PAPER.border + c.x}px`;
    b.style.top = `${PAPER.border + c.y}px`;
    b.style.width = `${c.w}px`;
    b.style.height = `${c.h}px`;
    b.title = { form: 'Fill in this field', signature: 'Sign here', check: 'Tick or cross this box' }[c.kind];
    controlsLayer.appendChild(b);
  }
}

function renderStatus(model) {
  const parts = [`Text width ${model.wrapWidth}px.`];
  if (model.scrolls) parts.push('This paper is taller than the in-game window, so the game adds a scrollbar and wraps 10px narrower.');
  $('paper-status').textContent = parts.join(' ');
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

// ─── Fill / Sign / Check buttons ─────────────────────────────────────────────
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
  pop.style.left = `${Math.max(8, left)}px`;
  pop.style.top = `${top}px`;
}

// The nth button of a kind replaces the nth literal tag, exactly like the game.
function replaceNthTag(tag, index, replacement) {
  const pos = PaperRenderer.findNthTag(editor.value, tag, index);
  if (pos < 0) return;
  const scroll = $('preview').scrollTop;
  editRange(pos, pos + tag.length, replacement);
  $('preview').scrollTop = scroll;
}

function openFormDialog(btn, index) {
  closeFieldPopover();
  selectedButton = btn;
  btn.classList.add('selected');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'field-input';
  input.placeholder = 'Type and press Enter';
  const ok = document.createElement('button');
  ok.textContent = 'OK';
  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  const row = document.createElement('div');
  row.className = 'row';
  row.append(ok, cancel);
  fieldPopover.append(input, row);
  const submit = () => {
    const value = input.value;
    closeFieldPopover();
    if (value) replaceNthTag('[form]', index, value);
  };
  ok.addEventListener('click', submit);
  cancel.addEventListener('click', closeFieldPopover);
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
    const b = document.createElement('button');
    b.textContent = `${symbol} ${label}`;
    b.addEventListener('click', () => { closeFieldPopover(); replaceNthTag('[check]', index, symbol); });
    wrap.appendChild(b);
  }
  fieldPopover.append(wrap);
  openPopoverAt(fieldPopover, btn);
  wrap.firstChild.focus();
}

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
  const id = getIdentity();
  const fields = {};
  for (const [key, label, ph] of [['rank', 'Rank (short)', 'e.g. Cpl.'], ['name', 'Name', 'e.g. John Doe'], ['role', 'Role', 'e.g. Rifleman']]) {
    const l = document.createElement('label');
    l.textContent = label;
    const i = document.createElement('input');
    i.type = 'text';
    i.className = 'field-input';
    i.placeholder = ph;
    i.value = id[key] || '';
    l.htmlFor = i.id = `identity-${key}`;
    fields[key] = i;
    fieldPopover.append(l, i);
  }
  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = 'Signing writes "Rank Name, Role" like the game does. Saved in this browser only.';
  const save = document.createElement('button');
  save.textContent = onSaved ? 'Save and sign' : 'Save';
  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  const row = document.createElement('div');
  row.className = 'row';
  row.append(save, cancel);
  fieldPopover.append(hint, row);
  const submit = () => {
    const next = { rank: fields.rank.value.trim(), name: fields.name.value.trim(), role: fields.role.value.trim() };
    store.set('ss14paper.identity', next);
    updateIdentityLabel();
    closeFieldPopover();
    if (onSaved && next.name) onSaved();
  };
  save.addEventListener('click', submit);
  cancel.addEventListener('click', closeFieldPopover);
  for (const input of Object.values(fields)) {
    input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { ev.preventDefault(); submit(); }
    });
  }
  openPopoverAt(fieldPopover, anchor);
  fields.name.value ? fields.rank.focus() : fields.name.focus();
}

controlsLayer.addEventListener('click', ev => {
  const btn = ev.target.closest('.paper-btn');
  if (!btn) return;
  ev.stopPropagation();
  const index = Number(btn.dataset.index);
  switch (btn.dataset.kind) {
    case 'form': openFormDialog(btn, index); break;
    case 'check': openCheckDialog(btn, index); break;
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
  if (loadedTemplate) return loadedTemplate.path.split('/').pop().replace(/\.txt$/i, '');
  return 'document';
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

function saveRenderAsImage() {
  if (!currentModel) return;
  const out = document.createElement('canvas');
  PaperRenderer.paint(out, currentModel, 2, { drawControls: true });
  out.toBlob(blob => download(blob, `${baseFileName()}.png`), 'image/png');
}

$('file-input').addEventListener('change', e => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => { loadedTemplate = null; replaceAll(String(r.result)); };
  r.readAsText(f);
  e.target.value = '';
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

editor.addEventListener('input', scheduleRender);

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
  if (!fieldPopover.hidden && !fieldPopover.contains(ev.target) && !ev.target.closest('.paper-btn') && !ev.target.closest('#identity-btn')) closeFieldPopover();
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
  const dirty = editor.value.trim() !== '' && (!loadedTemplate || editor.value !== loadedTemplate.text);
  if (dirty && !confirm('Replace your current text with this template? You can undo with Ctrl+Z.')) return;
  btn.classList.add('loading');
  try {
    const text = await fetchTemplate(path);
    replaceAll(text);
    loadedTemplate = { path, text: editor.value };
    document.querySelectorAll('.tree-file.active').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
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
initTemplates();

RobustFonts.load()
  .then(() => {
    $('paper-loading').hidden = true;
    render();
  })
  .catch(err => {
    console.error(err);
    $('paper-loading').textContent = 'Could not load the fonts. Open the site through a web server (for example VS Code Live Server), not as a file.';
  });

// Re-render when the screen's pixel density changes (zoom, moving monitors).
matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener?.('change', () => render());
window.addEventListener('resize', () => scheduleRender());
