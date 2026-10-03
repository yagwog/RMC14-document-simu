// ─── Robust markup parser ───────────────────────────────────────────────────
// Port of RobustToolbox FormattedMessage.MarkupParser.cs (a Pidgin parser).
// Paper uses AddMarkupPermissive: try the strict parser first; if it fails,
// re-parse with the "safe" parser that turns invalid tags into plain text.
//
// Quirks reproduced on purpose, because the game has them too:
//  * One malformed tag anywhere (e.g. "[TYPE-001]", "[ ]") switches the whole
//    paper to the permissive parser. Invalid tags then show as literal text.
//  * In strict mode a lone backslash that isn't escaping \ [ ] or / ends the
//    parse early, and everything after it is silently dropped.

const RobustMarkup = (() => {
  const isLetter = c => /\p{L}/u.test(c);
  const isLetterOrDigit = c => /[\p{L}\p{Nd}]/u.test(c);
  const isWs = c => /\s/u.test(c);
  const isColorChar = c => /[#a-zA-Z0-9]/.test(c);
  const ESCAPABLE = new Set(['\\', '[', ']', '/']);

  class Fail { constructor(pos) { this.pos = pos; } }

  function skipWs(s, p) { while (p < s.length && isWs(s[p])) p++; return p; }

  function identifier(s, p) {
    if (p >= s.length || !isLetter(s[p])) throw new Fail(p);
    let e = p + 1;
    while (e < s.length && isLetterOrDigit(s[e])) e++;
    return [s.slice(p, e), e];
  }

  // Parameter: = "string" | color | long
  function parameter(s, p) {
    p = skipWs(s, p + 1); // after '='
    const c = s[p];
    if (c === '"') {
      const end = s.indexOf('"', p + 1);
      if (end < 0) throw new Fail(s.length);
      return [{ type: 'string', value: s.slice(p + 1, end) }, end + 1];
    }
    if (c !== undefined && (c === '#' || isLetter(c))) {
      let e = p + 1;
      while (e < s.length && isColorChar(s[e])) e++;
      const raw = s.slice(p, e);
      return [{ type: 'color', value: createColor(raw), raw }, e];
    }
    const m = /^[+-]?\d+/.exec(s.slice(p, p + 32));
    if (m) return [{ type: 'long', value: parseInt(m[0], 10) }, p + m[0].length];
    throw new Fail(p);
  }

  // KeyValuePair = Identifier [= Parameter], wrapped in optional whitespace.
  function keyValue(s, p) {
    p = skipWs(s, p);
    let name;
    [name, p] = identifier(s, p);
    p = skipWs(s, p);
    let param = null;
    if (s[p] === '=') [param, p] = parameter(s, p);
    p = skipWs(s, p);
    return [name, param, p];
  }

  // Parses a tag starting at '['. Returns { nodes, end } or throws Fail.
  function tag(s, start) {
    let p = start + 1;
    if (s[p] === '/') {
      p = skipWs(s, p + 1);
      let name;
      [name, p] = identifier(s, p);
      p = skipWs(s, p);
      if (s[p] !== ']') throw new Fail(p);
      return { nodes: [{ name, value: null, attrs: {}, closing: true, start, end: p + 1 }], end: p + 1 };
    }
    let name, value;
    [name, value, p] = keyValue(s, p);
    const attrs = {};
    while (p < s.length && isLetter(s[p])) {
      let an, av;
      [an, av, p] = keyValue(s, p);
      if (!(an in attrs)) attrs[an] = av;
    }
    let selfClosing = false;
    if (s[p] === '/') {
      p = skipWs(s, p + 1);
      if (s[p] !== ']') throw new Fail(p);
      selfClosing = true;
    } else if (s[p] !== ']') {
      throw new Fail(p);
    }
    const end = p + 1;
    const nodes = [{ name, value, attrs, closing: false, start, end }];
    if (selfClosing) nodes.push({ name, value: null, attrs: {}, closing: true, start, end, selfClose: true });
    return { nodes, end };
  }

  // Text: runs of escape sequences or any char except '[' and '\'.
  function text(s, p) {
    let out = '';
    const start = p;
    while (p < s.length) {
      const c = s[p];
      if (c === '[') break;
      if (c === '\\') {
        if (p + 1 < s.length && ESCAPABLE.has(s[p + 1])) { out += s[p + 1]; p += 2; continue; }
        break;
      }
      out += c; p++;
    }
    return p > start ? { node: { name: null, text: out, start, end: p }, end: p } : null;
  }

  function parseStrict(s) {
    const nodes = [];
    let p = 0;
    while (p < s.length) {
      const t = text(s, p);
      if (t) { nodes.push(t.node); p = t.end; continue; }
      if (s[p] === '[') {
        try {
          const r = tag(s, p);
          nodes.push(...r.nodes); p = r.end; continue;
        } catch (e) {
          if (e instanceof Fail) return { ok: false, failAt: p };
          throw e;
        }
      }
      // A lone backslash: Many() stops here without error.
      return { ok: true, nodes, truncatedAt: p };
    }
    return { ok: true, nodes, truncatedAt: null };
  }

  function parsePermissive(s) {
    const nodes = [];
    const invalidTags = [];
    let p = 0;
    while (p < s.length) {
      const t = text(s, p);
      if (t) { nodes.push(t.node); p = t.end; continue; }
      if (s[p] === '[') {
        try {
          const r = tag(s, p);
          nodes.push(...r.nodes); p = r.end; continue;
        } catch (e) {
          if (!(e instanceof Fail)) throw e;
          invalidTags.push(p);
        }
      }
      nodes.push({ name: null, text: s[p], start: p, end: p + 1 });
      p++;
    }
    return { nodes, invalidTags };
  }

  function parse(s) {
    const strict = parseStrict(s);
    if (strict.ok) return { mode: 'strict', nodes: strict.nodes, truncatedAt: strict.truncatedAt, invalidTags: [] };
    const perm = parsePermissive(s);
    return { mode: 'permissive', nodes: perm.nodes, truncatedAt: null, invalidTags: perm.invalidTags };
  }

  // Color.TryFromName (case-insensitive) → Color.TryFromHex → Color.Black
  function createColor(raw) {
    const named = ROBUST_NAMED_COLORS[raw.toLowerCase()];
    if (named) return hexToRgba(named);
    return tryFromHex(raw) || { r: 0, g: 0, b: 0, a: 255 };
  }

  function tryFromHex(h) {
    if (!h || h[0] !== '#') return null;
    const hex = h.slice(1);
    if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
    if (hex.length === 8 || hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16),
        a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) : 255,
      };
    }
    if (hex.length === 4 || hex.length === 3) {
      const d = i => parseInt(hex[i] + hex[i], 16);
      return { r: d(0), g: d(1), b: d(2), a: hex.length === 4 ? d(3) : 255 };
    }
    return null;
  }

  function hexToRgba(h) { return tryFromHex(h); }

  return { parse, createColor };
})();
