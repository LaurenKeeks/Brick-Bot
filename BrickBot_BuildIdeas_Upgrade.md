# BrickBot — Build Ideas Upgrade
## Claude Code Build Document v1.1

**What this upgrades:** The "What can I build?" results on bench.html  
**Files to modify:** get-bench-ideas.js, bench.js, bench.css  
**Do NOT touch:** Everything else — index.html, part.html, get-challenge.js, all other Netlify functions  

---

## What We're Adding

Right now each build idea card shows:
- Idea name
- Difficulty badge
- Description text
- Piece number tags

We are upgrading each card to also show:
1. **Piece images** — thumbnail photos of each piece used in that idea, pulled from the data already in benchState
2. **Loose building steps** — 4 to 6 short bullet points telling the kid roughly how to assemble it, written in a fun encouraging voice

---

## Change 1 — Update the Claude prompt in get-bench-ideas.js

Replace the existing prompt with this one:

```
You are BrickBot, an enthusiastic LEGO-obsessed AI assistant.

A user has the following LEGO pieces on their Brick Bench:
{pieces_list}

Generate exactly 3 creative build ideas using COMBINATIONS of these exact pieces.
Each idea should use at least 2 of the pieces listed.

Target age: {age_group}
Preferred topics: {topics}

Format each idea EXACTLY like this — include every label, do not skip any:

IDEA [number]: [catchy name]
DIFFICULTY: [Beginner / Intermediate / Advanced]
DESCRIPTION: [2 sentences max, enthusiastic, mentions the actual piece names]
PIECES USED: [comma-separated part numbers from the bench that this idea uses]
STEPS:
- [Step 1 — short, specific, fun. Mention the actual piece name.]
- [Step 2]
- [Step 3]
- [Step 4]
- [Step 5 — final step, describe what the finished build looks like]

Rules:
- Write exactly 5 steps per idea. No more, no less.
- Steps should be loose guidance, not precise engineering. Think "grab your 2x4 brick and lay it flat as your base" not "place element #3001 at coordinates X,Y".
- Only use pieces from the list. Never suggest pieces they don't have.
- Each idea should use a DIFFERENT combination of pieces.
- Make kids excited. High energy. Like a LEGO-obsessed best friend is talking.
- Do not suggest buying more pieces.
```

---

## Change 2 — Update the response parser in get-bench-ideas.js

The current parser extracts name, difficulty, description, and piecesUsed. Add steps extraction.

Parse the STEPS section by finding the line that starts with "STEPS:" and collecting every line after it that starts with "- " until you hit the next "IDEA" or end of string.

Return this shape from the Netlify function:

```json
{
  "ideas": [
    {
      "name": "Micro Satellite Station",
      "difficulty": "Beginner",
      "description": "Launch your own orbital research platform!...",
      "piecesUsed": ["3001", "3010"],
      "steps": [
        "Grab your 2x4 Brick and lay it flat — this is your station body.",
        "Stand your 1x4 Brick upright on the left stud for a solar panel.",
        "Add any small flat pieces on top as antenna dishes.",
        "Flip it over and add a 1x1 on the bottom as a thruster.",
        "Hold it up and make rocket noises — your satellite is ready for orbit!"
      ]
    }
  ]
}
```

---

## Change 3 — Update renderIdeas() in bench.js

Find the function that builds the HTML for each idea card. Add two new sections inside each card:

### Section A — Piece image strip (goes between the description and the steps)

```javascript
// Build the piece image strip
// piecesUsed is an array of part numbers e.g. ["3001", "3010"]
// benchState.pieces has the full piece objects including part_img_url
// Match each part number in piecesUsed to its piece object in benchState.pieces

const pieceImagesHTML = idea.piecesUsed.map(partNum => {
  const piece = benchState.pieces.find(p => p.part_num === partNum);
  if (!piece) return '';
  return `
    <div class="idea-piece-chip">
      <img src="${piece.part_img_url}" alt="${piece.name}" class="idea-piece-img" />
      <span class="idea-piece-label">${piece.name}</span>
    </div>
  `;
}).join('');
```

Wrap the chips in a div:
```html
<div class="idea-pieces-strip">
  <span class="idea-pieces-label">PIECES YOU'LL USE</span>
  <div class="idea-pieces-chips">
    <!-- chips go here -->
  </div>
</div>
```

### Section B — Steps list (goes below the piece image strip)

```html
<div class="idea-steps">
  <span class="idea-steps-label">HOW TO BUILD IT</span>
  <ol class="idea-steps-list">
    <li>Grab your 2x4 Brick and lay it flat — this is your station body.</li>
    <li>Stand your 1x4 Brick upright on the left stud for a solar panel.</li>
    <!-- etc -->
  </ol>
</div>
```

Build the `<li>` elements by looping through `idea.steps`.

### Full card order (top to bottom):
1. "BRICKBOT BUILD IDEA #1" label + difficulty badge
2. Idea name (bold, large)
3. Description (2 sentences)
4. Piece image strip ("PIECES YOU'LL USE" + photo chips)
5. Steps list ("HOW TO BUILD IT" + numbered steps)
6. Part number tags (the small mono tags already there — keep these)

---

## Change 4 — Add styles to bench.css

Add these new styles. Match the existing design system — white cards, yellow accents, Nunito font:

```css
/* Piece image strip inside idea cards */
.idea-pieces-strip {
  margin: 16px 0 12px;
}

.idea-pieces-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.8px;
  color: var(--muted-gray);
  margin-bottom: 8px;
}

.idea-pieces-chips {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.idea-piece-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: var(--light-gray);
  border-radius: 10px;
  padding: 8px;
  min-width: 64px;
}

.idea-piece-img {
  width: 48px;
  height: 48px;
  object-fit: contain;
  background: white;
  border-radius: 6px;
}

.idea-piece-label {
  font-size: 9px;
  color: var(--muted-gray);
  text-align: center;
  max-width: 64px;
  line-height: 1.3;
}

/* Steps list inside idea cards */
.idea-steps {
  margin: 12px 0 16px;
  background: #f9f9f9;
  border-radius: 10px;
  padding: 12px 16px;
}

.idea-steps-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.8px;
  color: var(--muted-gray);
  margin-bottom: 10px;
}

.idea-steps-list {
  padding-left: 18px;
  margin: 0;
}

.idea-steps-list li {
  font-size: 13px;
  color: #333;
  line-height: 1.6;
  margin-bottom: 6px;
  font-family: 'Nunito', sans-serif;
}

.idea-steps-list li:last-child {
  margin-bottom: 0;
}

/* If piece image fails to load, show a gray placeholder */
.idea-piece-img[src=""],
.idea-piece-img:not([src]) {
  background: #eee;
}
```

---

## Testing Checklist

After making these changes, deploy to Netlify and test:

- [ ] Add 3+ pieces to the bench (try 3001, 3010, 3003)
- [ ] Select a topic (e.g. Space) and click "What can I build?"
- [ ] Each idea card should show piece photo chips with images from Rebrickable
- [ ] Each idea card should show exactly 5 numbered building steps
- [ ] Steps should mention the actual piece names, not generic instructions
- [ ] If a piece image URL is broken, the chip should show a gray box, not a broken image icon
- [ ] Cards still look correct on mobile (chips wrap onto multiple rows if needed)
- [ ] Difficulty badges still show correct colors (green/yellow/red)

---

## How to Tell Claude Code

> "Read BrickBot_BuildIdeas_Upgrade.md. Upgrade the What can I build? feature exactly as described — update the Claude prompt in get-bench-ideas.js to return building steps, update the parser to extract steps, update renderIdeas() in bench.js to show piece image chips and a numbered steps list, and add the new CSS classes to bench.css. Do not touch any other files. When done, deploy to Netlify."

---

*BrickBot — Know your bricks. Build anything. 🤖🧱*
