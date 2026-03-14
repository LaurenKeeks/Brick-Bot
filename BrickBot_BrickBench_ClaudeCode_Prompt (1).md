# BrickBot — Brick Bench Feature
## Claude Code Build Document v1.0

**Project:** BrickBot.fun — Brick Bench feature  
**Builds on top of:** The existing BrickBot v1 (part lookup, Claude AI build ideas, LEGO color/set data)  
**Stack:** HTML + CSS + JavaScript · Rebrickable API · Claude API · Netlify Functions  
**Author:** Malakai

---

## What You Are Building

Add a "Brick Bench" page and feature to the existing BrickBot website. The Brick Bench lets users:

1. **Quick Add** — paste a comma-separated list of part numbers and load them all at once
2. **Build up a visual bench** — see thumbnails of every piece they've added
3. **Ask BrickBot "What can I build?"** — Claude looks at ALL their pieces together and generates 3 build ideas using combinations of those exact pieces
4. **Get a "Challenge Mode"** — BrickBot picks a random subset of pieces and gives the user one specific timed build challenge

This is the feature that separates BrickBot from every other LEGO tool. Nobody else does combined multi-piece AI build suggestions in a fun, kid-friendly way.

---

## Design System (Match Existing BrickBot)

Use the existing BrickBot color palette and style exactly:

```css
:root {
  --lego-yellow: #FFD700;
  --lego-red: #CC0000;
  --lego-blue: #006DB7;
  --lego-green: #00A650;
  --dark-navy: #1A1A2E;
  --darker-navy: #12122a;
  --white: #FFFFFF;
  --light-gray: #F5F5F5;
  --muted-gray: #888888;
}
```

- **Font:** Nunito or Poppins (Google Fonts), rounded and friendly
- **Part numbers:** JetBrains Mono
- **Buttons:** border-radius 12px, yellow fill, black bold text, hover shifts to red
- **Cards:** white background, box-shadow subtle, border-radius 16px, 24px padding
- **Page background:** dark navy (#1A1A2E)
- **Tone:** Enthusiastic, encouraging, like a LEGO-obsessed best friend

---

## Files to Create / Modify

```
brickbot/
├── bench.html              ← NEW: the entire Brick Bench page
├── css/
│   └── bench.css           ← NEW: styles for bench page
├── js/
│   ├── bench.js            ← NEW: all bench logic
│   └── api.js              ← MODIFY: add bench-related API calls
└── netlify/
    └── functions/
        ├── get-bench-ideas.js    ← NEW: Claude API call for multi-piece ideas
        └── get-challenge.js      ← NEW: Claude API call for challenge mode
```

Also update `index.html` to add a "My Bench" link in the navigation.

---

## Page: bench.html

### Layout (top to bottom)

**1. Top navigation bar** (same as rest of site)
- BrickBot logo left, nav links right: Home | My Bench | Pro
- "My Bench" is the active link on this page
- Dark navy background (#12122a), thin bottom border

**2. Page header**
- Heading: "My Brick Bench"
- Subheading: "Add your pieces, then ask BrickBot what you can build."
- A pill badge showing the current piece count: e.g. "6 pieces"
- "Clear all" text button aligned right (with confirmation: "Are you sure?")

**3. Quick Add bar**
- Label: "QUICK ADD — TYPE PART NUMBERS"
- A wide pill-shaped text input. Placeholder: "3001, 3005, 3622, 3010, 3040..."
- A yellow "+ Add All" button to the right
- Below the input, small helper text: "Separate part numbers with commas. You can add up to 30 pieces."
- On click "+ Add All": split the input by commas, trim spaces, loop through each part number, call the Rebrickable API for each one (use the existing get-part Netlify function), add each result to the bench state
- Show a loading spinner on the button while fetching ("Adding pieces...")
- If a part number is not found, show a small red pill next to that number: "3999 — not found"

**4. Piece grid**
- Responsive grid: 4 columns on desktop, 3 on tablet, 2 on mobile
- Each piece card contains:
  - Part image from Rebrickable (part_img_url), 80px × 80px, white card background
  - Part name (bold, 12px)
  - Part number in mono font (10px, muted)
  - A small color dot showing the color the user has (default to the first available color)
  - An × remove button (top-right corner, appears on hover)
- One final empty "ghost" card with a + icon and text "Add a piece" — clicking it focuses the Quick Add input
- If the bench is empty, show a friendly empty state: BrickBot mascot icon, text "Your bench is empty! Add some pieces above to get started." with an arrow pointing up to the Quick Add bar

**5. Action buttons** (shown only when bench has 2 or more pieces)
- Two buttons side by side:
  - **"What can I build?"** — yellow fill, calls get-bench-ideas Netlify function
  - **"Challenge me!"** — yellow outline, calls get-challenge Netlify function
- Below the buttons: muted text "BrickBot will use the pieces on your bench"

**6. Age + Topic selector** (same as existing part results page — reuse the component)
- "Who's building?" — Ages 5-8 / Ages 9-12 / Ages 13+ (default: Ages 9-12)
- Topic chips (multi-select): Animals, Vehicles, Buildings, Space, Fantasy, Robots, Nature, Food, Sports
- These filters apply to BOTH "What can I build?" and "Challenge me!"

**7. Results area** (appears below the action buttons after clicking)

For "What can I build?" — show 3 build idea cards:
```
BRICKBOT BUILD IDEA #1         [INTERMEDIATE badge]
Red & Yellow Lighthouse
Stack your 2×4 and 1×2 bricks in alternating red and yellow...
Pieces used: #3001 #3004 #3040 #3020    [small mono tags]
```

For "Challenge me!" — show 1 challenge card (different styling — red left border):
```
BRICKBOT CHALLENGE
Build something that floats — using only 4 of your 6 pieces
BrickBot chose: your blue plate, two 2×4 bricks, and the slope...
[15 min challenge]  [I did it! Share →]
```

**8. Footer** — same as rest of site

---

## Netlify Function: get-bench-ideas.js

**Location:** `/netlify/functions/get-bench-ideas.js`

**What it receives (POST body):**
```json
{
  "pieces": [
    { "partName": "2x4 Brick", "partNumber": "3001", "category": "Basic Brick" },
    { "partName": "Slope 45°", "partNumber": "3040", "category": "Slope" }
  ],
  "ageGroup": "Ages 9-12",
  "topics": ["Vehicles", "Space"]
}
```

**Claude API prompt to send:**

```
You are BrickBot, an enthusiastic LEGO-obsessed AI assistant. 

A user has the following LEGO pieces on their Brick Bench:
{pieces_list}

Generate exactly 3 creative build ideas using COMBINATIONS of these exact pieces. 
Each idea should use at least 2 of the pieces listed.

Target age: {age_group}
Preferred topics: {topics}

Format each idea EXACTLY like this (including the labels):

IDEA [number]: [catchy name]
DIFFICULTY: [Beginner / Intermediate / Advanced]
DESCRIPTION: [2-3 sentences, enthusiastic, specific, mentions the actual piece names]
PIECES USED: [comma-separated list of part numbers from the bench that this idea uses]

Rules:
- Only use pieces from the list above. Do not suggest any pieces they don't have.
- Be creative, specific, and encouraging. Make kids excited to start building.
- Do not suggest buying more pieces.
- Each idea should use a DIFFERENT combination of pieces so the ideas feel varied.
```

**What it returns:**
```json
{
  "ideas": [
    {
      "name": "Red & Yellow Lighthouse",
      "difficulty": "Intermediate",
      "description": "Stack your 2x4 and 1x2 bricks...",
      "piecesUsed": ["3001", "3004", "3040"]
    }
  ]
}
```

Parse Claude's text response by splitting on "IDEA " and extracting each field. Return structured JSON — do NOT return raw text.

---

## Netlify Function: get-challenge.js

**Location:** `/netlify/functions/get-challenge.js`

**What it receives (POST body):** Same shape as get-bench-ideas.js

**Claude API prompt to send:**

```
You are BrickBot, an enthusiastic LEGO-obsessed AI assistant running a build challenge.

A user has these LEGO pieces available:
{pieces_list}

Create ONE exciting build challenge using only a SUBSET of their pieces (pick 2-5 pieces).

Target age: {age_group}
Preferred topics: {topics}

Format your response EXACTLY like this:

CHALLENGE TITLE: [one punchy sentence, e.g. "Build something that floats using only 4 pieces"]
PIECES TO USE: [list only the part numbers to use for this challenge, comma-separated]
DESCRIPTION: [2-3 sentences explaining the challenge, what to build, why it's fun]
TIME LIMIT: [a suggested time in minutes — between 10 and 30]
BONUS: [one optional bonus twist, e.g. "Bonus: make it tall enough to be taller than your hand!"]

Rules:
- Pick a subset of their pieces — not all of them. That's the constraint that makes it fun.
- Be specific about what to build, not vague.
- Make it feel like a game show challenge. High energy.
- Only use pieces from the list. Never suggest pieces they don't have.
```

**What it returns:**
```json
{
  "title": "Build something that floats — using only 4 of your pieces",
  "piecesUsed": ["3001", "3020", "3004", "3040"],
  "description": "BrickBot chose your blue plate, two 2×4 bricks...",
  "timeLimit": 15,
  "bonus": "Bonus: make it tall enough to be taller than your hand!"
}
```

---

## JavaScript: bench.js

### State to manage

```javascript
const benchState = {
  pieces: [],        // array of piece objects from Rebrickable
  ageGroup: "Ages 9-12",
  topics: [],
  results: null,     // last build ideas result
  challenge: null    // last challenge result
};
```

### Key functions to implement

**`addPiecesFromInput()`**
- Read the comma-separated input
- Split and trim each part number
- For each part number, call the existing get-part Netlify function
- Push successful results to benchState.pieces
- Re-render the piece grid
- Show errors for any not-found part numbers

**`removePiece(partNumber)`**
- Filter that part number out of benchState.pieces
- Re-render grid
- If bench drops below 2 pieces, hide the action buttons

**`renderPieceGrid()`**
- Loop through benchState.pieces and build the HTML for each piece card
- Always add the "ghost" + card at the end
- Show empty state if pieces array is empty

**`getBuildIdeas()`**
- Show loading state on the "What can I build?" button ("Thinking...")
- POST to /api/get-bench-ideas with pieces, ageGroup, topics
- On response, render the 3 idea cards in the results area
- Scroll results area into view

**`getChallenge()`**
- Show loading state on "Challenge me!" button
- POST to /api/get-challenge with pieces, ageGroup, topics
- On response, render the challenge card
- Start a visible countdown timer based on timeLimit
- Scroll challenge card into view

**`saveToLocalStorage()`**
- Save benchState.pieces to localStorage as JSON
- Key: `brickbot_bench_pieces`
- Call this every time pieces change

**`loadFromLocalStorage()`**
- On page load, check localStorage for saved pieces
- If found, restore them to benchState and render
- Show a small "Welcome back! Your bench was saved." toast notification

**`clearBench()`**
- Show a confirm dialog: "Clear your whole bench? This can't be undone."
- If confirmed, empty benchState.pieces, clear localStorage, re-render

### Notes on the "I did it! Share →" button

On the challenge card, include a "I did it! Share →" button. For now this can:
- Copy a share text to clipboard: "I built [challenge title] with BrickBot! 🧱 Try it at BrickBot.fun"
- Show a brief "Copied! Share it anywhere." toast

---

## Accounts (Phase 2 — do not build now)

The user asked about saving to an account. For v1, use localStorage only (no login required). This is simpler to build, still saves their bench between visits on the same device, and avoids COPPA compliance issues with collecting kids' data.

**Add this note to the bench page UI:**  
A small info line under the piece count: "Your bench is saved on this device. Sign up for an account to access it anywhere." (Link goes to a coming-soon page for now.)

---

## Linking From the Rest of the Site

**On every part results page**, after the existing BrickBot Build Ideas section, add:

```html
<div class="add-to-bench-row">
  <button class="btn-add-bench" onclick="addToBench('3001')">
    + Add to My Bench
  </button>
  <span class="bench-hint">Add this piece to your bench and get ideas for combinations</span>
</div>
```

Clicking "+ Add to My Bench":
1. Saves the piece to localStorage under `brickbot_bench_pieces`
2. Shows a toast: "Added 2×4 Brick to your bench! [View Bench →]"
3. The "View Bench" link goes to bench.html

**In the top navigation** on all pages, add "My Bench" as a link. If there are pieces saved in localStorage, show the count in a small yellow badge next to it, e.g. "My Bench (6)".

---

## Error Handling

| Situation | What to show |
|---|---|
| Part number not found in Rebrickable | Small red pill: "3999 — not found. Check the number." |
| Claude API times out | "BrickBot is thinking hard... try again in a moment." with a retry button |
| Bench has fewer than 2 pieces when clicking action buttons | "Add at least 2 pieces to your bench first!" shown inline |
| Network error | "Couldn't connect — check your internet and try again." |
| LocalStorage not available | Silently fail saving, bench still works for the session |

---

## Do Not Build Yet (Future Phases)

- User accounts / login
- Sharing a bench with a friend via URL
- Importing a full set from Rebrickable (that's a larger feature)
- Piece quantity tracking (e.g. "I have 10 of this piece")
- Build Gallery where users post photos

---

## Definition of Done

The Brick Bench feature is complete when:

- [ ] `bench.html` loads and is linked from the nav on all pages
- [ ] Quick Add correctly loads part data from Rebrickable for a comma-separated list
- [ ] Piece grid renders correctly with images, names, numbers, remove buttons
- [ ] "What can I build?" calls Claude and renders 3 structured idea cards
- [ ] "Challenge me!" calls Claude and renders 1 structured challenge card with a timer
- [ ] Age selector and topic chips filter both Claude calls correctly
- [ ] Pieces persist in localStorage and reload on next visit
- [ ] "+ Add to My Bench" button works on part results pages
- [ ] Nav badge shows saved piece count
- [ ] All error states are handled gracefully
- [ ] Matches the BrickBot design system (colors, fonts, card styles)
- [ ] Works on mobile (responsive grid, readable text, tappable buttons)

---

## How to Start

Tell Claude Code:

> "Build the Brick Bench feature for BrickBot exactly as described in this document. Start with bench.html and bench.css to get the page layout and piece grid rendering correctly with hardcoded sample data. Then add bench.js with the localStorage save/load and the Quick Add functionality calling the existing get-part Netlify function. Then add the two new Netlify functions (get-bench-ideas and get-challenge) with the Claude API prompts. Finally wire up the '+ Add to My Bench' button on the part results page and the nav badge."

---

*BrickBot Brick Bench — Know your bricks. Build anything. Together. 🤖🧱*
