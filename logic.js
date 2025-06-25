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
    "AliceBlue": "#F0F8FF",
};

        // Initialize the color picker with color options
        function initializeColorPicker() {
    const picker = document.getElementById('color-picker');
    picker.innerHTML = ''; // Clear existing colors
    for (const [name, hex] of Object.entries(namedColors)) {
        const box = document.createElement('div');
        box.style.backgroundColor = hex;
        box.className = 'color-box';
        box.title = name;
        box.onclick = () => insertColor(name);
        picker.appendChild(box);
    }
}


function toggleDarkMode() {
    // Toggle the "dark-mode" class on the body
    document.body.classList.toggle("dark-mode");

    // Ensure the #render element's color stays consistent
    const renderArea = document.getElementById("render");
    renderArea.style.color = document.body.classList.contains("dark-mode") ? "#000" : ""; // Maintain black text
}


// Toggle the color picker visibility
function toggleColorPicker() {
    const picker = document.getElementById('color-picker');
    const isVisible = picker.style.display === 'grid';
    picker.style.display = isVisible ? 'none' : 'grid';

    // Recalculate and adjust position if necessary
    if (!isVisible) {
        const toolbar = document.getElementById('toolbar');
        const rect = toolbar.getBoundingClientRect();
        picker.style.top = `${rect.top + window.scrollY + 10}px`; // Place below toolbar
        picker.style.left = `${rect.right + 10}px`; // Place beside toolbar
    }
}


// Insert a color tag into the editor
function insertColor(colorName) {
    const editor = document.getElementById('editor');
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selectedText = editor.value.substring(start, end);
    const colorTag = `[color=${colorName}]${selectedText}[/color]`;

    editor.value =
        editor.value.substring(0, start) + colorTag + editor.value.substring(end);

    updateRender();
    document.getElementById('color-picker').style.display = 'none';
}



    // Insert a formatting tag
    function insertTag(tag) {
    const editor = document.getElementById('editor');
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selectedText = editor.value.substring(start, end);

    let openTag = '', closeTag = '';

    switch (tag) {
        case 'bold':
            openTag = '[bold]';
            closeTag = '[/bold]';
            break;
        case 'italic':
            openTag = '[italic]';
            closeTag = '[/italic]';
            break;
        case 'bolditalic':
            openTag = '[bolditalic]';
            closeTag = '[/bolditalic]';
            break;
        case 'header-1':
            openTag = '[head=1]';
            closeTag = '[/head]';
            break;
        case 'header-2':
            openTag = '[head=2]';
            closeTag = '[/head]';
            break;
        case 'header-3':
            openTag = '[head=3]';
            closeTag = '[/head]';
            break;
          case 'bullet': {
            const editor = document.getElementById('editor');
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            
            const before = editor.value.substring(0, start);
            const selectedText = editor.value.substring(start, end);
            const after = editor.value.substring(end);

            // Insert `[bullet] ` before the selected text or at the cursor
            if (selectedText.trim()) {
                editor.value = before + `[bullet] ` + selectedText + after;
            } else {
                editor.value = before + `[bullet] ` + after;
            }

            // Move the cursor correctly after inserting the bullet
            const cursorPosition = start + `[bullet] `.length;
            editor.setSelectionRange(cursorPosition, cursorPosition);
            editor.focus();

            updateRender();
            break;
        }
        case 'mono':
            openTag = '[mono]';
            closeTag = '[/mono]';
            break;
    }

    const before = editor.value.substring(0, start);
    const after = editor.value.substring(end);

    // Insert the tags and position the cursor correctly
    editor.value = before + openTag + selectedText + closeTag + after;

    // Set the cursor position or selection range
    const cursorPosition = start + openTag.length;
    editor.setSelectionRange(cursorPosition, cursorPosition + selectedText.length);
    editor.focus();

    updateRender(); // Update the live preview
}

    function centerText() {
    const editor = document.getElementById('editor');
    const totalWidth = 80; // Total width for centering (adjust as needed for the input layout)

    // Get the selection start and end
    const start = editor.selectionStart;
    const end = editor.selectionEnd;

    // Extract selected text
    const selectedText = editor.value.substring(start, end);

    if (!selectedText.trim()) {
        alert("Please select some text to center.");
        return;
    }

    // Split selected text into lines
    const lines = selectedText.split("\n");

    // Center each line individually
    const centeredLines = lines.map(line => {
        const textLength = line.trim().length; // Trim to exclude leading/trailing spaces
        const spacesNeeded = Math.max(0, Math.floor((totalWidth - textLength) / 2));
        return " ".repeat(spacesNeeded) + line.trim();
    });

    // Replace the selected text with the centered text
    const centeredText = centeredLines.join("\n");
    const before = editor.value.substring(0, start);
    const after = editor.value.substring(end);
    editor.value = before + centeredText + after;

    // Re-select the centered text
    editor.setSelectionRange(start, start + centeredText.length);

    // Update the render preview
    updateRender();
}

function saveTextAsFile() {
    // Get the content of the editor
    const editorContent = document.getElementById('editor').value;

    // Prompt the user to enter a file name
    const fileName = prompt("Enter a name for your file (without extension):", "my_document");
    if (!fileName) {
        alert("File name is required to save the file.");
        return;
    }

// Function to handle file import
document.getElementById('file-input').addEventListener('change', function(event) {
    const file = event.target.files[0];

    if (!file) {
        alert("No file selected. Please select a .txt file.");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        document.getElementById('editor').value = content; // Load content into the editor
        updateRender(); // Update the render preview
    };

    reader.onerror = function() {
        alert("Failed to read the file. Please try again.");
    };

    reader.readAsText(file);
});


    // Create a Blob with the content and type
    const blob = new Blob([editorContent], { type: "text/plain" });

    // Create a temporary anchor element to trigger download
    const downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = `${fileName}.txt`;

    // Programmatically click the anchor to start the download
    downloadLink.click();

    // Revoke the URL object to free memory
    URL.revokeObjectURL(downloadLink.href);
}

// Function to detect ASCII Art (symbols and special characters)
function isAsciiArt(char) {
    return /[^\w\s]/.test(char); // Detects non-alphanumeric, non-space characters
}

// Function to detect Box Drawing characters (╔, ╦, ╬, etc.)
const asciiBoxDrawing = new Set([
    '─', '│', '┌', '┐', '└', '┘', '├', '┤', '┬', '┴', '┼',
    '═', '║', '╔', '╗', '╚', '╝', '╠', '╣', '╦', '╩', '╬',
    '╤', '╧', '╪', '╫', '╢', '╟', '╞', '╡', '╜', '╛', '╘', '╙',
    '╓', '╖', '╕', '■', '□', '▪', '▫', '▬', '▲', '►', '▼', '◀', '◊', '○', '◌', '●'
]);

function isBoxDrawing(char) {
    return asciiBoxDrawing.has(char); 
}


function updateRender() {
    const editorContent = document.getElementById('editor').value.trim();
    const renderDiv = document.getElementById('render');

    if (!editorContent) {
        renderDiv.innerHTML = "";
        return;
    }

    let output = "";
    let isMono = false;
    let tagStack = [];

    try {
        let tokens = editorContent.split(/(\[\/?[a-zA-Z0-9=#]+\])/g).filter(Boolean);

        tokens.forEach(token => {
            let tagMatch = token.match(/\[([a-zA-Z0-9=#\/]+)\]/);

            if (tagMatch) {
                let tag = tagMatch[1];

                // Handle Closing Tags
                if (tag.startsWith('/')) {
                    let tagName = tag.substring(1);

                    if (tagName === "mono") {
                        isMono = false;
                        output += `</span>`;
                    } else if (tagName === "bold") {
                        output += `</b>`;
                    } else if (tagName === "italic") {
                        output += `</i>`;
                    } else if (tagName === "bolditalic") {
                        output += `</i></b>`;
                    } else if (tagName.startsWith("head")) {
                        output += `</span>`;
                    } else if (tagName.startsWith("color")) {
                        output += `</span>`;
                    }

                    tagStack.pop();
                } else {
                // Handle Opening Tags
                if (tag === "mono") {
                    isMono = true;
                    output += `<span class="monospace">`;
                } else if (tag === "bold") {
                    output += `<b>`;
                } else if (tag === "italic") {
                    output += `<i>`;
                } else if (tag === "bolditalic") {
                    output += `<b><i>`;
                } else if (tag.startsWith("color=")) {
                    let color = tag.split("=")[1];
                    output += `<span style="color:${color}">`;
                } else if (tag.startsWith("head=")) {
                    let level = tag.split("=")[1].trim();

                    if (["1", "2", "3"].includes(level)) {
                        // Close any currently open [head] tag before opening a new one
                        while (tagStack.length > 0 && tagStack[tagStack.length - 1].startsWith("head")) {
                            output += `</span>`;
                            tagStack.pop();
                        }

                        output += `<span class="header-${level}">`;
                        tagStack.push(`head=${level}`); // Track the currently open header tag
                    }
                } else if (tag === "/head") {
                    // Close only the last opened [head] tag
                    let lastTag = tagStack.pop();
                    if (lastTag && lastTag.startsWith("head")) {
                        output += `</span>`;
                    }
                } else if (tag === "bullet") {  
                    output += `• `; // Just insert the bullet symbol
                }

                // Only push tags that aren't closing [head]
                if (!tag.startsWith("/")) {
                    tagStack.push(tag);
                }}

            } else {
                // Apply ASCII formatting only inside [mono]
                if (isMono) {
                    output += token.split("").map(char => {
                        if (isBoxDrawing(char)) {
                            return `<span class="ascii-art">${char}</span>`; 
                        } else if (isAsciiArt(char)) {
                            return `<span class="monospace">${char}</span>`; 
                        }
                        return char;
                    }).join("");
                } else {
                    output += token; // Normal text remains as is
                }
            }
        });

        // Close any unclosed tags
        while (tagStack.length > 0) {
            let tag = tagStack.pop();
            if (tag === "bold") output += `</b>`;
            if (tag === "italic") output += `</i>`;
            if (tag === "bolditalic") output += `</i></b>`;
            if (tag.startsWith("head")) output += `</span>`;
            if (tag.startsWith("color")) output += `</span>`;
            if (tag === "mono") output += `</span>`;
        }

        renderDiv.innerHTML = output;

    } catch (error) {  
        console.error("Error in updateRender:", error);
        renderDiv.innerHTML = `<span style='color:red;'>⚠ Render Error ⚠</span>`;
    }
}

// Function to convert tags
function convertTag(tag) {
    if (tag.startsWith("color=")) {
        let color = tag.split("=")[1];
        return `span style="color:${color}"`;
    }

    const tagMap = {
        "bold": "b",
        "italic": "i",
        "bolditalic": "b><i",
        "head=1": 'span class="header-1"',
        "head=2": 'span class="header-2"',
        "head=3": 'span class="header-3"',
        "mono": 'span class="monospace"' // Correctly mapped
    };

    return tagMap[tag] || null;
}



function insertHexColor() {
    const hexColor = prompt("Enter a hex color code (e.g., #FF5733):");
    if (hexColor && /^#[0-9A-Fa-f]{3,8}$/.test(hexColor)) {
        const editor = document.getElementById('editor');
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const selectedText = editor.value.substring(start, end);

        const before = editor.value.substring(0, start);
        const after = editor.value.substring(end);

        // Insert the hex color tag
        const colorTag = `[color=${hexColor}]${selectedText}`;
        editor.value = `${before}${colorTag}${after}`;
        const cursorPosition = start + colorTag.length;
        editor.setSelectionRange(cursorPosition, cursorPosition + selectedText.length);
        editor.focus();

        updateRender(); // Trigger render update
    } else {
        alert("Invalid hex code! Please use formats like #RGB, #RRGGBB, #RGBA, or #RRGGBBAA.");
    }
}


    // Keybinds for formatting and undo
    document.addEventListener('keydown', (event) => {
        const editor = document.getElementById('editor');
        if (event.ctrlKey) {
            switch (event.key.toLowerCase()) {
                case 'b': event.preventDefault(); insertTag('bold'); break;
                case 'i': event.preventDefault(); insertTag('italic'); break;
                case 'z': event.preventDefault(); undoLastChange(); break;
            }
        }
    });

    // Undo functionality
    const history = [];
    function saveToHistory() {
        const editor = document.getElementById('editor');
        history.push(editor.value);
        if (history.length > 20) history.shift(); // Limit history size
    }

    function undoLastChange() {
        const editor = document.getElementById('editor');
        if (history.length > 0) {
            editor.value = history.pop();
            updateRender();
        }
    }

    // Initialize color picker and save initial state
    initializeColorPicker();
    document.getElementById('editor').addEventListener('input', () => {
        saveToHistory();
        updateRender();
    });

    function saveRenderAsImage() {
    const renderDiv = document.getElementById('render');

    html2canvas(renderDiv, { // Saves render as png
        backgroundColor: null, // Keeps transparency
        useCORS: true, // Fixes rendering artifacts
        scale: 2, // Increases resolution for better quality
    }).then(canvas => {
        const imgData = canvas.toDataURL("image/png");

        // Create a download link
        const downloadLink = document.createElement("a");
        downloadLink.href = imgData;
        downloadLink.download = "render_output.png";
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    });
}
