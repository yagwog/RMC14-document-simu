        // Define supported named colors
        const namedColors = {
    "Black": "#000000", "DimGray": "#696969", "Gray": "#808080", "DarkGray": "#A9A9A9",
    "Silver": "#C0C0C0", "Gainsboro": "#DCDCDC", "WhiteSmoke": "#F5F5F5", "White": "#FFFFFF",

    "DarkRed": "#8B0000", "FireBrick": "#B22222", "IndianRed": "#CD5C5C",
    "Crimson": "#DC143C", "Red": "#FF0000", "Tomato": "#FF6347", "OrangeRed": "#FF4500",
    "DarkOrange": "#FF8C00", "Coral": "#FF7F50", "LightCoral": "#F08080",

    "Chocolate": "#D2691E", "SaddleBrown": "#8B4513", "Sienna": "#A0522D",
    "Brown": "#A52A2A", "RosyBrown": "#BC8F8F", "Peru": "#CD853F", "SandyBrown": "#F4A460",
    "GoldenRod": "#DAA520", "DarkGoldenRod": "#B8860B", "Gold": "#FFD700", "Yellow": "#FFFF00",

    "Khaki": "#F0E68C", "DarkKhaki": "#BDB76B", "PaleGoldenRod": "#EEE8AA",
    "LightGoldenRodYellow": "#FAFAD2", "LemonChiffon": "#FFFACD", "LightYellow": "#FFFFE0",

    "Olive": "#808000", "DarkOliveGreen": "#556B2F", "OliveDrab": "#6B8E23",
    "DarkGreen": "#006400", "Green": "#008000", "ForestGreen": "#228B22",
    "SeaGreen": "#2E8B57", "MediumSeaGreen": "#3CB371", "LightSeaGreen": "#20B2AA",
    "SpringGreen": "#00FF7F", "LawnGreen": "#7CFC00", "Chartreuse": "#7FFF00",
    "GreenYellow": "#ADFF2F", "LimeGreen": "#32CD32", "Lime": "#00FF00",
    "PaleGreen": "#98FB98", "LightGreen": "#90EE90", "MediumSpringGreen": "#00FA9A",

    "Teal": "#008080", "DarkCyan": "#008B8B", "MediumTurquoise": "#48D1CC",
    "Turquoise": "#40E0D0", "LightSeaGreen": "#20B2AA", "DarkTurquoise": "#00CED1",
    "Aqua": "#00FFFF", "Cyan": "#00FFFF", "Aquamarine": "#7FFFD4",
    "PaleTurquoise": "#AFEEEE", "PowderBlue": "#B0E0E6", "LightBlue": "#ADD8E6",
    "SkyBlue": "#87CEEB", "DeepSkyBlue": "#00BFFF", "DodgerBlue": "#1E90FF",
    "CornflowerBlue": "#6495ED", "SteelBlue": "#4682B4", "RoyalBlue": "#4169E1",
    "Blue": "#0000FF", "MediumBlue": "#0000CD", "DarkBlue": "#00008B",
    "Navy": "#000080", "MidnightBlue": "#191970",

    "Indigo": "#4B0082", "DarkSlateBlue": "#483D8B", "SlateBlue": "#6A5ACD",
    "MediumSlateBlue": "#7B68EE", "MediumPurple": "#9370DB", "BlueViolet": "#8A2BE2",
    "DarkViolet": "#9400D3", "DarkOrchid": "#9932CC", "MediumOrchid": "#BA55D3",
    "Purple": "#800080", "RebeccaPurple": "#663399", "Fuchsia": "#FF00FF",
    "Magenta": "#FF00FF", "Orchid": "#DA70D6", "Violet": "#EE82EE",
    "Plum": "#DDA0DD", "Thistle": "#D8BFD8", "Lavender": "#E6E6FA",

    "PeachPuff": "#FFDAB9", "Moccasin": "#FFE4B5", "NavajoWhite": "#FFDEAD",
    "Bisque": "#FFE4C4", "BlanchedAlmond": "#FFEBCD", "Cornsilk": "#FFF8DC",
    "PapayaWhip": "#FFEFD5", "AntiqueWhite": "#FAEBD7", "FloralWhite": "#FFFAF0",
    "Ivory": "#FFFFF0", "Beige": "#F5F5DC", "Linen": "#FAF0E6",
    "OldLace": "#FDF5E6", "WhiteSmoke": "#F5F5F5", "GhostWhite": "#F8F8FF",
    "AliceBlue": "#F0F8FF", };

function initializeColorPicker() {
  const p = document.getElementById('color-picker');
  p.style.display = 'none';
  p.innerHTML = '';
  for (let [name, hex] of Object.entries(namedColors)) {
    const box = document.createElement('div');
    box.className = 'color-box';
    box.style.background = hex;
    box.title = name;
    box.onclick = () => insertColor(name);
    p.appendChild(box);
  }
}

function toggleColorPicker() {
  const p = document.getElementById('color-picker');
  if (p.style.display === 'grid') p.style.display = 'none';
  else {
    p.style.display = 'grid';
    const t = document.getElementById('toolbar').getBoundingClientRect();
    p.style.top = `${t.top + 10}px`;
    p.style.left = `${t.right + 10}px`;
  }
}
function insertColor(c) {
  const ed = document.getElementById('editor'),
        [s,e] = [ed.selectionStart, ed.selectionEnd],
        txt = ed.value.slice(s,e);
  ed.value = ed.value.slice(0,s)
           + `[color=${c}]${txt}[/color]`
           + ed.value.slice(e);
  ed.focus();
  updateRender();
  document.getElementById('color-picker').style.display='none';
}
function insertHexColor() {
  let h = prompt("Enter hex (e.g. #aabbcc):");
  if (h && /^#[0-9A-F]{3,6}$/i.test(h)) insertColor(h);
}

// --- generic insertTag for bold/italic/mono/head/bullet ---
function insertTag(tag) {
  const ed = document.getElementById('editor'),
        [s,e] = [ed.selectionStart, ed.selectionEnd],
        sel = ed.value.slice(s,e);
  if (tag==='bullet') {
    ed.value = ed.value.slice(0,s) + '• ' + ed.value.slice(s);
  } else {
    ed.value = ed.value.slice(0,s)
             + `[${tag}]${sel}[/${ tag.split('=')[0] }]`
             + ed.value.slice(e);
  }
  ed.focus();
  updateRender();
}

// --- center text ---
function centerText() {
  const ed = document.getElementById('editor'), [s,e] = [ed.selectionStart, ed.selectionEnd],
        lines = ed.value.slice(s,e).split('\n');
  const centered = lines.map(l=>{
    const pad = Math.floor((80 - l.length)/2);
    return ' '.repeat(Math.max(0,pad)) + l;
  }).join('\n');
  ed.value = ed.value.slice(0,s) + centered + ed.value.slice(e);
  ed.focus();
  updateRender();
}

// --- save/load/undo/keyboard shortcuts ---
function saveTextAsFile() {
  const blob = new Blob([document.getElementById('editor').value],{type:'text/plain'}),
        a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'document.txt';
  a.click();
}
function saveRenderAsImage(){
  const el = document.getElementById('render');
  html2canvas(el, {
    backgroundColor: null,   // <-- keeps the rounded-corner transparency
    useCORS: true,
    scale: 2
  }).then(canvas=>{
    const a=document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'render.png';
    a.click();
  });
}


document.getElementById('file-input').addEventListener('change', e=>{
  const f = e.target.files[0], r = new FileReader();
  r.onload = ()=>{ document.getElementById('editor').value = r.result; updateRender(); };
  r.readAsText(f);
});

const history = [];
function saveHistory() {
  const ed = document.getElementById('editor');
  history.push(ed.value);
  if (history.length > 20) history.shift();
}
function undo() {
  if (history.length) {
    document.getElementById('editor').value = history.pop();
    updateRender();
  }
}
document.getElementById('editor').addEventListener('input', ()=>{
  saveHistory();
  updateRender();
});
document.addEventListener('keydown', ev=>{
  if (ev.ctrlKey) {
    if (ev.key==='b') { ev.preventDefault(); insertTag('bold'); }
    if (ev.key==='i') { ev.preventDefault(); insertTag('italic'); }
    if (ev.key==='z') { ev.preventDefault(); undo(); }
  }
});

// --- dark mode ---
function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
}

// ─── updateRender ───────────────────────────────────────────────────────────
function updateRender() {
    const editorContent = document.getElementById('editor').value;
    const renderDiv = document.getElementById('render');
    let output = '';
    let stack = [];

    const tokens = editorContent.split(/(\[\/?[a-z=0-9#]+\])/i).filter(Boolean);

    tokens.forEach(tok => {
        const openMatch = tok.match(/^\[([a-z]+)(?:=([^\]]+))?\]$/i);
        const closeMatch = tok.match(/^\[\/([a-z]+)\]$/i);

        if (openMatch) {
            const tag = openMatch[1];
            const param = openMatch[2] || '';

            if (tag === 'bullet') {
                output += '• ';
            } else {
                let spanClass = '', spanStyle = '';
                switch (tag) {
                    case 'bold':
                        output += '<b>'; stack.push({tag: 'bold'}); break;
                    case 'italic':
                        output += '<i>'; stack.push({tag: 'italic'}); break;
                    case 'bolditalic':
                        output += '<b><i>';
                        stack.push({tag: 'bolditalic'});
                        break;
                    case 'mono':
                        output += '<span class="monospace">'; stack.push({tag: 'mono'}); break;
                    case 'color':
                    spanStyle = `color:${param}`;
                    output   += `<span style="${spanStyle}">`;
                    stack.push({ tag: 'color', param });   // ← keep the colour for later re-open
                    break;
                    case 'head':
                        spanClass = `header-${param}`;
                        output += `<span class="${spanClass}">`;
                        stack.push({tag: 'head', param}); break;
                    default: break;
                }
            }
        } else if (closeMatch) {
            const tag = closeMatch[1];
            let tempStack = [];

            while (stack.length) {
                const last = stack.pop();
                if (last.tag === 'bold') output += '</b>';
                else if (last.tag === 'italic') output += '</i>';
                else if (last.tag === 'bolditalic') output += '</i></b>';   
                else output += '</span>';

                if (last.tag === tag) break;
                else tempStack.push(last);
            }

            // reopen styles temporarily closed above
            while (tempStack.length) {
                const reopened = tempStack.pop();
                switch (reopened.tag) {
            case 'bold':        output += '<b>';                      break;
            case 'italic':      output += '<i>';                      break;
            case 'mono':        output += '<span class="monospace">'; break;
            case 'color':       output += `<span style="color:${reopened.param}">`; break;
            case 'head':        output += `<span class="header-${reopened.param}">`; break;
            case 'bolditalic':  output += '<b><i>';                   break;
            default: break;
            }
                stack.push(reopened);
            }

        } else {
            output += tok
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/  /g,' &nbsp;');
        }
    });

    // Close all leftover tags at the end
    while (stack.length) {
        const tag = stack.pop();
        if (tag.tag === 'bold') output += '</b>';
        else if (tag.tag === 'italic') output += '</i>';
        else output += '</span>';
    }

    renderDiv.innerHTML = output;
}

function htmlOpenFor(tag, param = '') {
  switch (tag) {
    case 'bold': return '<b>';
    case 'italic': return '<i>';
    case 'bolditalic': return '<b><i>';
    case 'mono': return '<span class="monospace">';
    case 'color': return `<span style="color:${param}">`;
    default: return '';
  }
}

function htmlCloseFor(tag) {
  const baseTag = tag.split('=')[0];
  switch (baseTag) {
    case 'bold': return '</b>';
    case 'italic': return '</i>';
    case 'bolditalic': return '</i></b>';
    case 'mono':
    case 'color':
    case 'head':
      return '</span>';
    default: return '';
  }
}

// ─── TEMPLATE PICKER ──────────────────────────────────────────
let templateCache = null;

async function toggleTemplatePicker() {
  const picker = document.getElementById('template-picker');
  if (picker.style.display === 'block') {           // hide
    picker.style.display = 'none';
    return;
  }

  // 1) first-time fetch?
  if (!templateCache) {
    picker.innerHTML = 'loading…';
    templateCache = await fetchTemplates();
  }

  // 2) build / rebuild the tree every time (cheap)
  picker.innerHTML = buildTemplateTree(templateCache);
  picker.style.display = 'block';

  // position next to toolbar
  const tb = document.getElementById('toolbar').getBoundingClientRect();
  picker.style.top  = `${tb.top + 10}px`;
  picker.style.left = `${tb.right + 10}px`;
}

// returns an array of { path:"folder/file.txt", url:"raw-url" }
async function fetchTemplates() {
  const API   = 'https://api.github.com/repos/crazy1112345/RMC14Paperwork/contents/Main/Updated%20RMC14';
  async function walk(url, basePath='') {
    const res  = await fetch(url);
    const list = await res.json();
    let out    = [];
    for (const item of list) {
      if (item.type === 'file' && item.name.endsWith('.txt')) {
        out.push({path: basePath + item.name, url: item.download_url});
      } else if (item.type === 'dir') {
        out = out.concat(await walk(item.url, basePath + item.name + '/'));
      }
    }
    return out;
  }
  return walk(API);
}

function buildTemplateTree(files) {
  // files is flat; build simple <ul><li> structure by path parts
  const root = {};
  files.forEach(f => {
    const parts = f.path.split('/');
    let node = root;
    parts.forEach((p,i) => {
      if (!node[p]) node[p] = (i === parts.length-1) ? f.url : {};
      node = node[p];
    });
  });

  function render(node, indent='') {
    return Object.entries(node).map(([name,val])=>{
      if (typeof val === 'string') {        // file
        return `<div style="cursor:pointer"
                     onclick="loadTemplate('${val.replace(/'/g,"\\'")}')">
                  ${indent}📄 ${name}</div>`;
      }
      // folder
      return `<div>${indent}📂 <b>${name}</b></div>${render(val, indent+'  ')}`;
    }).join('');
  }
  return render(root);
}

// fetch file → put into #editor
async function loadTemplate(rawUrl) {
  try {
    const txt = await (await fetch(rawUrl)).text();
    const ed  = document.getElementById('editor');
    ed.value  = txt;
    updateRender();
    document.getElementById('template-picker').style.display='none';
  } catch (e) {
    alert('Failed to load template ☹');
  }
}

// ─── CLICK-AWAY HIDER FOR PICKERS ────────────────────────────────
(() => {
  // cache the DOM nodes we care about once:
  const colorBtn   = document.querySelector('button[onclick^="toggleColorPicker"]');
  const templateBtn= document.querySelector('button[onclick^="toggleTemplatePicker"]');
  const colorPick  = document.getElementById('color-picker');
  const templatePick = document.getElementById('template-picker');

  // helper: is the click inside a given element?
  function inside(node, target) { return node && target && node.contains(target); }

  document.addEventListener('click', (ev) => {
    const t = ev.target;
    // Colour-picker
    if (colorPick.style.display !== 'none' &&
        !inside(colorPick, t) && !inside(colorBtn, t)) {
      colorPick.style.display = 'none';
    }
    // Template-picker
    if (templatePick.style.display !== 'none' &&
        !inside(templatePick, t) && !inside(templateBtn, t)) {
      templatePick.style.display = 'none';
    }
  });
})();

// --- bootstrap ---
initializeColorPicker();
updateRender();
