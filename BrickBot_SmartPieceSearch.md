# BrickBot — Smart Piece Search
## Claude Code Build Document v1.3

**What this upgrades:** The Quick Add bar on bench.html and the search bar on index.html  
**Files to modify:** bench.html, bench.css, bench.js, index.html, css/styles.css  
**New Netlify function:** search-parts.js  
**Do NOT touch:** idea.html, idea.js, idea.css, get-idea-detail.js, ask-brickbot.js, get-bench-ideas.js, get-challenge.js, part.html  

---

## The Problem We're Solving

Right now users can only find a piece if they:
1. Already know the part number (most kids don't), OR
2. Take a photo (requires a camera, good lighting, extra steps)

Most kids describe pieces naturally — "the long flat red one", "a 2x4 brick", "the slope piece", "that round flat thing". BrickBot should understand all of these and show visual results to pick from.

---

## What We're Building

Replace the current Quick Add bar on bench.html with a single smart search bar that handles all three entry methods:

1. **Text description** — type anything like "2x4 brick", "long flat blue", "slope", "round plate" → shows a visual grid of matching pieces from Rebrickable
2. **Part number** — type a number like "3001" → works exactly like before, instantly adds the piece
3. **Photo upload** — camera icon on the right, works exactly like the existing Photo ID feature

All three methods resolve to the same outcome: a visual picker grid where the user taps "+ Add" on the piece they want.

---

## Change 1 — New Netlify Function: search-parts.js

**Location:** `/netlify/functions/search-parts.js`

This function calls the Rebrickable search API and returns matching parts with images.

**Rebrickable search endpoint:**
```
GET https://rebrickable.com/api/v3/lego/parts/?search={query}&page_size=8
Authorization: key YOUR_API_KEY
```

**What it receives (GET request with query param):**
```
/api/search-parts?q=flat+brick
```

**What it returns:**
```json
{
  "results": [
    {
      "part_num": "3020",
      "name": "Plate 2 x 4",
      "part_img_url": "https://cdn.rebrickable.com/...",
      "part_cat_id": 14
    },
    {
      "part_num": "3021",
      "name": "Plate 2 x 3",
      "part_img_url": "https://cdn.rebrickable.com/...",
      "part_cat_id": 14
    }
  ],
  "count": 8
}
```

Return a maximum of 8 results. If the query is a pure number (only digits), skip the Rebrickable search and instead call the existing get-part endpoint logic directly for that specific part number — this handles the case where someone types a part number into the describe field.

---

## Change 2 — Replace Quick Add bar on bench.html

Remove the current Quick Add section entirely. Replace it with this new Smart Search section.

### New HTML structure:

```html
<div class="smart-search-section">
  <div class="smart-search-label">ADD PIECES TO YOUR BENCH</div>
  
  <div class="smart-search-bar">
    <input 
      type="text" 
      id="piece-search-input"
      class="smart-search-input"
      placeholder="Describe a piece, enter a part number, or upload a photo..."
      autocomplete="off"
    />
    <button class="smart-search-photo-btn" id="photo-search-btn" title="Identify a piece from a photo">
      <!-- camera icon SVG -->
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
        <circle cx="12" cy="13" r="4"/>
      </svg>
    </button>
  </div>

  <div class="smart-search-hints">
    Try: <span class="hint-chip" data-query="2x4 brick">2x4 brick</span>
    <span class="hint-chip" data-query="slope">slope</span>
    <span class="hint-chip" data-query="round plate">round plate</span>
    <span class="hint-chip" data-query="flat tile">flat tile</span>
    <span class="hint-chip" data-query="technic pin">technic pin</span>
  </div>

  <!-- Results grid — hidden until search runs -->
  <div class="search-results-area" id="search-results-area" style="display:none;">
    <div class="search-results-label" id="search-results-label">Showing results for "2x4 brick"</div>
    <div class="search-results-grid" id="search-results-grid">
      <!-- Piece result cards injected here by JS -->
    </div>
    <div class="search-no-results" id="search-no-results" style="display:none;">
      BrickBot couldn't find that piece. Try different words, or use the camera to take a photo.
    </div>
  </div>

</div>
```

### Search result card HTML (one card, repeated for each result):
```html
<div class="search-result-card">
  <img src="{part_img_url}" alt="{name}" class="search-result-img" />
  <div class="search-result-name">{name}</div>
  <div class="search-result-num">#{part_num}</div>
  <button class="btn-add-result" data-partnum="{part_num}" data-name="{name}" data-img="{part_img_url}">
    + Add
  </button>
</div>
```

### Hint chips behavior:
Clicking a hint chip fills the search input with that text and immediately triggers a search. This gives first-time users a starting point without having to think of what to type.

---

## Change 3 — Update bench.js

### Add these new functions:

**`handleSearchInput()`**
- Triggered on input event with a 400ms debounce (don't search on every keystroke)
- If input is empty: hide the results area
- If input is a pure number (digits only): call getPart() directly for that number, show as a single result card, do not call search-parts
- Otherwise: call searchParts(query)

**`searchParts(query)`**
- Show loading state in results area: "BrickBot is searching..."
- GET /api/search-parts?q={encodeURIComponent(query)}
- On response: render result cards in the grid
- Show results area
- If 0 results: show the no-results message
- Update the label: "Showing results for '{query}' — tap a piece to add it"

**`addFromSearch(partNum, name, imgUrl)`**
- Called when user clicks "+ Add" on a result card
- Check for duplicate — if already on bench, show toast: "That piece is already on your bench!"
- Otherwise add to benchState.pieces and re-render the piece grid
- Change the button on that result card to "✓ Added" (green, disabled) so the user knows it worked
- Do NOT clear the search results — let the user keep adding more pieces from the same search

**`handlePhotoSearchBtn()`**
- Clicking the camera icon opens a file picker (accept="image/*", capture="environment" for mobile)
- On file select: convert to base64, call the existing identify-photo Netlify function
- While identifying: show loading state in results area: "BrickBot is looking at your photo..."
- On response: show the identified piece(s) as result cards, same UI as text search results
- User taps "+ Add" on the correct match

**Update `addPiecesFromInput()`**
- This function handled the old comma-separated Quick Add
- Remove it entirely — it's replaced by the new search flow
- The old "Enter key adds piece" behavior is replaced by: Enter key triggers a search

### Remove from bench.js:
- `addPiecesFromInput()` function
- The event listener on the old quick-add input
- The error pill rendering for "not found" part numbers (replaced by no-results message)

---

## Change 4 — Update bench.css

### Remove:
- `.quick-add` styles
- `.quick-add-label` styles  
- `.quick-add-row` styles
- `.quick-add-input` styles
- `.error-pill` styles

### Add:

```css
/* Smart search section */
.smart-search-section {
  margin-bottom: 24px;
}

.smart-search-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.8px;
  color: var(--muted-gray);
  margin-bottom: 10px;
}

.smart-search-bar {
  display: flex;
  align-items: center;
  background: white;
  border: 2px solid var(--lego-yellow);
  border-radius: 28px;
  padding: 6px 6px 6px 20px;
  gap: 8px;
  transition: box-shadow 0.2s;
}

.smart-search-bar:focus-within {
  box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.25);
}

.smart-search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 15px;
  font-family: 'Nunito', sans-serif;
  color: #222;
  background: transparent;
  min-width: 0;
}

.smart-search-input::placeholder {
  color: var(--muted-gray);
  font-size: 14px;
}

.smart-search-photo-btn {
  width: 44px;
  height: 44px;
  min-width: 44px;
  background: var(--dark-navy);
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--lego-yellow);
  transition: background 0.15s;
}

.smart-search-photo-btn:hover {
  background: var(--lego-red);
}

/* Hint chips */
.smart-search-hints {
  margin-top: 10px;
  font-size: 12px;
  color: var(--muted-gray);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.hint-chip {
  background: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 20px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  color: #444;
  font-family: 'Nunito', sans-serif;
}

.hint-chip:hover {
  background: var(--lego-yellow);
  border-color: var(--lego-yellow);
  color: #1a1a1a;
}

/* Search results area */
.search-results-area {
  margin-top: 16px;
}

.search-results-label {
  font-size: 12px;
  color: var(--muted-gray);
  margin-bottom: 12px;
}

.search-results-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

@media (max-width: 600px) {
  .search-results-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.search-result-card {
  background: white;
  border: 1px solid #eee;
  border-radius: 14px;
  padding: 12px 10px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  transition: box-shadow 0.15s;
}

.search-result-card:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
}

.search-result-img {
  width: 72px;
  height: 72px;
  object-fit: contain;
  background: #fafafa;
  border-radius: 8px;
}

.search-result-name {
  font-size: 11px;
  font-weight: 700;
  color: #222;
  line-height: 1.3;
}

.search-result-num {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--muted-gray);
}

.btn-add-result {
  background: var(--lego-yellow);
  border: none;
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  font-family: 'Nunito', sans-serif;
  transition: background 0.15s;
  width: 100%;
  margin-top: 2px;
}

.btn-add-result:hover {
  background: var(--lego-red);
  color: white;
}

.btn-add-result.added {
  background: var(--lego-green);
  color: white;
  cursor: default;
}

.search-no-results {
  font-size: 13px;
  color: var(--muted-gray);
  text-align: center;
  padding: 20px;
}

/* Loading state */
.search-loading {
  font-size: 13px;
  color: var(--muted-gray);
  text-align: center;
  padding: 20px;
  font-style: italic;
}
```

---

## Change 5 — Update index.html homepage search bar

The homepage already has a search bar. Add the same hint chips below it so new visitors immediately understand they can describe a piece in plain English:

Below the existing search input on index.html, add:

```html
<div class="homepage-hints">
  Try: 
  <span class="hint-chip" onclick="document.getElementById('search-input').value='2x4 brick'; document.getElementById('search-input').focus();">2x4 brick</span>
  <span class="hint-chip" onclick="document.getElementById('search-input').value='slope piece'; document.getElementById('search-input').focus();">slope piece</span>
  <span class="hint-chip" onclick="document.getElementById('search-input').value='round flat plate'; document.getElementById('search-input').focus();">round flat plate</span>
  <span class="hint-chip" onclick="document.getElementById('search-input').value='technic pin'; document.getElementById('search-input').focus();">technic pin</span>
</div>
```

Add the same `.hint-chip` CSS to styles.css (copy from bench.css).

Update the homepage search placeholder text from whatever it currently says to:
```
Describe a piece or enter a part number...
```

---

## Testing Checklist

- [ ] Type "2x4 brick" — shows 8 results with photos after ~400ms debounce
- [ ] Type "slope" — shows slope-related pieces
- [ ] Type "3001" (a number) — instantly shows just that one piece, no search needed
- [ ] Type complete gibberish like "xyzqqqq" — shows no-results message
- [ ] Click a hint chip — fills input and triggers search immediately
- [ ] Click "+ Add" on a result — piece appears in the bench grid below, button turns green "✓ Added"
- [ ] Click "+ Add" on a piece already on bench — shows "already on your bench" toast
- [ ] Camera button opens file picker on desktop, camera on mobile
- [ ] Photo upload identifies piece and shows result cards
- [ ] Homepage hint chips fill the search bar on click
- [ ] Everything works on mobile (2-column grid, large tap targets)

---

## How to Tell Claude Code

> "Read BrickBot_SmartPieceSearch.md. Build the smart piece search feature exactly as described. Create the new search-parts.js Netlify function. Replace the Quick Add bar on bench.html with the new smart search bar including hint chips and results grid. Update bench.js to add handleSearchInput, searchParts, addFromSearch, and handlePhotoSearchBtn functions and remove the old addPiecesFromInput function. Update bench.css to remove old quick-add styles and add new search styles. Add hint chips below the search bar on index.html and update the placeholder text. Do not touch any other files. When done, deploy to Netlify."

---

*BrickBot — Know your bricks. Build anything. 🤖🧱*
