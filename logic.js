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

// SS14 Font Constants (browser adjusted)
const SS14_DEFAULT_SIZE = 16;

// SS14 Header calculation: Math.Ceiling(DefaultSize * 2 / Math.Sqrt(level))
function getHeaderSize(level) {
    return Math.ceil(SS14_DEFAULT_SIZE * 2 / Math.sqrt(level));
}

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
    ed.setSelectionRange(s+2, s+2);
  } else {
    const openTag = `[${tag}]`;
    const closeTag = `[/${tag.split('=')[0]}]`;
    ed.value = ed.value.slice(0,s) + openTag + sel + closeTag + ed.value.slice(e);
    if (sel.length === 0) {
      ed.setSelectionRange(s + openTag.length, s + openTag.length);
    } else {
      ed.setSelectionRange(s + openTag.length + sel.length + closeTag.length, s + openTag.length + sel.length + closeTag.length);
    }
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

// Fetch templates from local submodule via GitHub Pages
async function fetchTemplates() {
  const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '') + '/templates-upstream/Main/Updated%20RMC14/';
  
  // Template structure - update this when new categories are added
  const structure = {
    'Command': ['C-402 Regional or High Command Correspondence.txt', 'C-486 Squad Comp Report.txt', 'C-501 General Deployment Request.txt', 'C-594 Enlistment Form.txt', 'C-619 Recomendation for Award.txt', 'C-999 Nuclear Authorization Request.txt'],
    'Medical': ['M-106 Certification of Death.txt', 'M-133 Morgue Autopsy Report.txt', 'M-210 Prescription Slip.txt', 'M-212 Medical Bay Preparedness.txt', 'M-389 Req form.txt', 'M-488 Psych Eval.txt', 'M-489 Declaration of Insanity.txt', 'M-532 Deployment Request.txt', 'M-62 GC Waiver.txt', 'M-BT012 DEAD Casevac Bag Tag.txt', 'M-BT013 LARVA Casevac Bag Tag.txt'],
    'MP': ['P-304 Armory Request form.txt', 'P-401 Incident Report.txt', 'P-402 Provost correspondence.txt', 'P-403 Arrest Report.txt', 'P-404 Witness Statement.txt', 'P-409 Arrest Record.txt', 'P-415 Record of Misuse of Authority.txt', 'P-508 Search Warrant.txt', 'P-509 Arrest Warrant.txt', 'P-512 Deployment Request.txt', 'P-605 Criminal Appeal.txt', 'Execution Order.txt'],
    'Engineering': ['E-389 Engineering Supply Request.txt', 'E-436 Work-order.txt', 'E-465 OB Usage.txt', 'E-482 Shipside Modification Request.txt', 'E-501 Deployment Request.txt'],
    'Req': ['R-301 Supply Drop Manifest.txt', 'R-304 General Armory Request.txt', 'R-306 Suppy Drop Request.txt', 'R-315 Expenditure Report.txt', 'R-389 Requisitions Request.txt', 'R-M39 Medical Supply Request.txt'],
    'Squads': ['S-404 After Action Review.txt', 'S-A5 Alpha Personnel Roster.txt', 'S-B5 Bravo Personnel Roster.txt', 'S-C5 Charlie Personnel Roster.txt', 'S-D5 Delta Personnel Roster.txt', 'S-E1 Echo Transfer Request.txt', 'S-M59 Marine Service Record.txt', 'Liberty Pass.txt'],
    'Weston-Yamada': ['CL-000 Generic Fax Template.txt', 'CL-402 We-Ya correspondence.txt', 'CL-433 Colony Incident Report.txt', 'CL-435 Liaison Operations Report.txt', 'CL-524 Liasion Deployment Request.txt', 'CL-529 Special Assignment (we-ya marine).txt', 'CL-532 Correspondent Agreement.txt', 'CL-563 Last Will and Testament.txt', 'CL-563A Compensation Stipulations.txt', 'CL-579 PMC Request Form.txt', 'CL-602 General NDA.txt', 'CL-604 Colonist NDA.txt', 'CL-609 Feedback Form.txt', 'CL-654 Asset Protection Agreement.txt', 'CL-658 Intel Review Request.txt', 'CL-679 Cease and Desist.txt', 'CL-694 Claims Waiver.txt']
  };
  
  let templates = [];
  for (const [folder, files] of Object.entries(structure)) {
    for (const file of files) {
      templates.push({
        path: `${folder}/${file}`,
        url: `${baseUrl}${folder}/${encodeURIComponent(file)}`
      });
    }
  }
  return templates;
}

function buildTemplateTree(files) {
  const root = {};
  files.forEach(f => {
    const parts = f.path.split('/');
    let node = root;
    parts.forEach((p,i) => {
      if (!node[p]) node[p] = (i === parts.length-1) ? f.url : {};
      node = node[p];
    });
  });

  function render(node, indent='', level=0) {
    return Object.entries(node).map(([name,val])=>{
      if (typeof val === 'string') {
        return `<div class="template-button" onclick="loadTemplate('${val.replace(/'/g,"\\'")}')">
                  ${indent}📄 <span style="font-weight:500">${name}</span></div>`;
      }
      return `<div style="margin:${level*2}px 0;padding:4px 0;">
                <div class="template-title">
                  ${indent}📂 ${name}</div>
                <div style="margin-left:16px;">${render(val, indent+'  ', level+1)}</div>
              </div>`;
    }).join('');
  }
  return `<div style="color:#2c3e50;line-height:1.4;">${render(root)}</div>`;
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
                        const headerSize = Math.ceil(SS14_DEFAULT_SIZE * 2 / Math.sqrt(parseInt(param)));
                        const headerWeight = param == 1 ? 'bold' : param == 2 ? '600' : '500';
                        output += `<span style="font-size:${headerSize}px; line-height:0; font-weight:${headerWeight}; display:inline-block; vertical-align:middle;">`;
                        stack.push({ tag: 'head', param });
                        break;
                    default: break;
                }
            }
        } else if (closeMatch) {
            const tag = closeMatch[1];
            
            if (tag === 'bullet') {
                output += '• ';
                return;
            }
            
            let tempStack = [];

            while (stack.length) {
                const last = stack.pop();
                if (last.tag === 'bold') output += '</b>';
                else if (last.tag === 'italic') output += '</i>';
                else if (last.tag === 'bolditalic') output += '</i></b>';
                else if (last.tag === 'bullet') { /* bullet has no closing output */ }
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
            case 'head':        
                const reopenSize = Math.ceil(SS14_DEFAULT_SIZE * 2 / Math.sqrt(parseInt(reopened.param || 1)));
                const reopenWeight = reopened.param == 1 ? 'bold' : reopened.param == 2 ? '600' : '500';
                output += `<span style="font-size:${reopenSize}px; line-height:0; font-weight:${reopenWeight}; display:inline-block; vertical-align:middle;">`;
                break;
            case 'bolditalic':  output += '<b><i>';                   break;
            case 'bullet':      output += '• ';                   break;
            default: break;
            }
                stack.push(reopened);
            }

        } else {
            output += tok
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/_/g, '<span class="underscore-normal">_</span>')
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

// --- bootstrap ---
initializeColorPicker();
updateRender();
