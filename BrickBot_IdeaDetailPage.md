# BrickBot — Idea Detail Pages
## Claude Code Build Document v1.2

**What this adds:** Each build idea gets its own shareable page  
**New files:** idea.html, css/idea.css, js/idea.js  
**Files to modify:** js/bench.js (add "View full build" button to each card)  
**Do NOT touch:** Everything else  

---

## The Feature

Right now build idea cards appear on bench.html and disappear when the page refreshes. This upgrade gives each idea its own permanent page at a URL like:

```
brickbot.fun/idea.html?name=Mini-Robot-Buddy&pieces=3001,3005&age=Ages+9-12&topics=Robots
```

The idea is regenerated fresh from Claude each time the page loads using the parameters in the URL. This means:
- Every idea is shareable via link
- Kids can bookmark their favorite build ideas
- Each page is indexable by Google over time

---

## Change 1 — Add "View full build →" button to each idea card in bench.js

In the renderBenchIdeas() function, add a button at the bottom of each idea card:

```javascript
// Build the URL for this idea's detail page
const ideaSlug = idea.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
const piecesParam = idea.piecesUsed.join(',');
const topicsParam = encodeURIComponent(benchState.topics.join(','));
const ageParam = encodeURIComponent(benchState.ageGroup);

const ideaURL = `/idea.html?name=${ideaSlug}&pieces=${piecesParam}&age=${ageParam}&topics=${topicsParam}`;
```

Add this button HTML at the bottom of each card, below the part number tags:

```html
<a href="${ideaURL}" class="btn-view-idea">
  View full build →
</a>
```

Style: yellow fill, black bold text, border-radius 10px, full width, centered, 14px font, 14px padding top and bottom. Same as the existing yellow buttons on the site.

---

## New File — idea.html

Full page layout for a single build idea. Loads idea data from URL parameters and regenerates the full idea from Claude on page load.

### URL parameters this page reads:
- `name` — the idea name slug (e.g. "Mini-Robot-Buddy")
- `pieces` — comma-separated part numbers (e.g. "3001,3005,3003")
- `age` — age group (e.g. "Ages 9-12")
- `topics` — comma-separated topics (e.g. "Robots,Space")

### Page layout (top to bottom):

**1. Same nav bar as the rest of the site**
- BrickBot logo left, Home | My Bench | Photo ID right

**2. Back link**
```
← Back to My Bench
```
Small, muted, links to bench.html. Sits above the main content.

**3. Hero section**
- Large idea name as the H1 (convert slug back to readable: "Mini-Robot-Buddy" → "Mini Robot Buddy")
- Difficulty badge (Beginner / Intermediate / Advanced) — colored chip, same as bench.html
- A subline: "A BrickBot build idea using [N] pieces"

**4. Pieces section**
- Heading: "PIECES YOU'LL NEED"
- For each part number in the URL, call the existing get-part Netlify function and show:
  - Large piece image (100px × 100px)
  - Piece name below the image
  - Part number in mono font
  - A "Find on BrickLink →" link
- Display in a responsive grid: 4 per row desktop, 3 tablet, 2 mobile

**5. How to build it — steps section**
- Heading: "HOW TO BUILD IT"
- Numbered list of steps, larger than on the bench card
- Each step in its own row with a yellow step number circle on the left
- Step number circle: 32px diameter, yellow background (#FFD700), black bold number, centered

**6. BrickBot says... — full AI description section**
- The yellow left-border card style from bench.html
- BrickBot mascot icon
- Full enthusiastic description of the build
- If the user wants to go deeper, a text input: "Ask BrickBot a question about this build..." with a Send button
- This calls the Claude API (new Netlify function: ask-brickbot.js) and appends the response below

**7. Share section**
- Heading: "Share this build idea"
- Two buttons side by side:
  - "Copy link" — copies the full URL to clipboard, shows "Copied!" toast
  - "Add pieces to bench →" — saves all pieces from this idea to localStorage under brickbot_bench_pieces and redirects to bench.html

**8. "Try another idea" section**
- Heading: "Want a different idea with these pieces?"
- One yellow button: "Regenerate →"
- Clicking it calls Claude again with the same pieces/age/topics and replaces the page content with the new idea (no page reload — update the DOM in place)
- Show a loading state while Claude is thinking: "BrickBot is thinking of something new..."

**9. Footer** — same as rest of site

---

## New File — js/idea.js

### On page load:
1. Read all URL parameters
2. Convert name slug back to readable text
3. For each part number, call get-part Netlify function and store piece data
4. Call the get-idea-detail Netlify function (new — see below) to get the full idea content
5. Render everything

### Key functions:

**`getIdeaDetail()`**
- POST to /api/get-idea-detail
- Body: { ideaName, pieces (array of piece objects), ageGroup, topics }
- On response: render difficulty, description, steps

**`copyShareLink()`**
- navigator.clipboard.writeText(window.location.href)
- Show toast: "Link copied! Share it anywhere."

**`addPiecesToBench()`**
- Read current brickbot_bench_pieces from localStorage
- Add all pieces from this idea (avoid duplicates)
- Save back to localStorage
- Redirect to bench.html
- bench.html will show "Welcome back! Your bench was saved." toast automatically

**`regenerateIdea()`**
- Show loading state
- Call get-idea-detail again with same parameters
- On response: update the H1, difficulty badge, description, and steps in place
- Smooth fade transition: fade out old content (opacity 0, 200ms), swap, fade in

**`askBrickBot(question)`**
- POST to /api/ask-brickbot
- Body: { question, ideaName, pieces, ageGroup }
- Append response below the input in a chat-style thread
- Each exchange: user question in a gray bubble, BrickBot answer in a yellow bubble

---

## New Netlify Function — get-idea-detail.js

**Location:** `/netlify/functions/get-idea-detail.js`

**What it receives (POST body):**
```json
{
  "ideaName": "Mini Robot Buddy",
  "pieces": [
    { "partName": "Brick 2x4", "partNumber": "3001", "category": "Basic Brick" },
    { "partName": "Brick 1x1", "partNumber": "3005", "category": "Basic Brick" }
  ],
  "ageGroup": "Ages 9-12",
  "topics": ["Robots"]
}
```

**Claude prompt:**

```
You are BrickBot, an enthusiastic LEGO-obsessed AI assistant.

A user wants to build: {idea_name}

They have these LEGO pieces available:
{pieces_list}

Target age: {age_group}
Preferred topics: {topics}

Generate a full build guide for {idea_name} using only the pieces listed above.

Format your response EXACTLY like this:

DIFFICULTY: [Beginner / Intermediate / Advanced]
DESCRIPTION: [3-4 sentences. Enthusiastic. Describe what the finished build looks like and why it's cool.]
STEPS:
- [Step 1 — specific, fun, mentions actual piece names]
- [Step 2]
- [Step 3]
- [Step 4]
- [Step 5]
- [Step 6]
- [Step 7 — final step, describe the finished build and celebrate it]

Rules:
- Exactly 7 steps. More detail than the bench cards — this is the full guide.
- Only use the pieces provided. Never suggest pieces they don't have.
- Mention actual piece names (e.g. "Brick 2x4") not generic terms.
- Make each step feel achievable and fun. End with a celebration.
```

**What it returns:**
```json
{
  "difficulty": "Beginner",
  "description": "Build an adorable little robot friend...",
  "steps": [
    "Grab your Brick 2x4 and lay it flat...",
    "Stack another Brick 2x4 on top...",
    "..."
  ]
}
```

---

## New Netlify Function — ask-brickbot.js

**Location:** `/netlify/functions/ask-brickbot.js`

**What it receives (POST body):**
```json
{
  "question": "What if I don't have a 1x1 brick?",
  "ideaName": "Mini Robot Buddy",
  "pieces": [...],
  "ageGroup": "Ages 9-12"
}
```

**Claude prompt:**

```
You are BrickBot, an enthusiastic LEGO-obsessed AI assistant.

A user is building: {idea_name}
Their pieces: {pieces_list}
Their age group: {age_group}

They have a question: {question}

Answer in 2-4 sentences. Be specific, helpful, and encouraging. 
Only suggest substitutions using common LEGO pieces they might already have.
Do not suggest buying new pieces.
```

**What it returns:**
```json
{
  "answer": "No worries! You could use a 1x2 brick instead and just let it hang over the edge a little — it'll look like your robot has robot ears, which is actually even cooler!"
}
```

---

## New File — css/idea.css

Key styles to add. Match the existing design system exactly:

```css
/* Step number circles */
.step-row {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 20px;
}

.step-number {
  width: 32px;
  height: 32px;
  min-width: 32px;
  background: var(--lego-yellow);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  color: #1a1a1a;
}

.step-text {
  font-size: 16px;
  line-height: 1.7;
  color: #333;
  padding-top: 4px;
}

/* Piece grid on idea page */
.idea-piece-card {
  background: white;
  border: 1px solid #eee;
  border-radius: 16px;
  padding: 16px;
  text-align: center;
}

.idea-piece-card img {
  width: 100px;
  height: 100px;
  object-fit: contain;
  margin-bottom: 8px;
}

.idea-piece-card .piece-name {
  font-size: 13px;
  font-weight: 700;
  color: #222;
  margin-bottom: 4px;
}

.idea-piece-card .piece-num {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--muted-gray);
  margin-bottom: 8px;
}

.idea-piece-card a {
  font-size: 11px;
  color: var(--lego-blue);
  text-decoration: none;
}

/* Chat thread for Ask BrickBot */
.chat-thread {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-bubble-user {
  background: #f0f0f0;
  border-radius: 16px 16px 4px 16px;
  padding: 12px 16px;
  font-size: 14px;
  align-self: flex-end;
  max-width: 80%;
}

.chat-bubble-bot {
  background: #fffbe6;
  border: 1px solid #ffe066;
  border-radius: 16px 16px 16px 4px;
  padding: 12px 16px;
  font-size: 14px;
  align-self: flex-start;
  max-width: 80%;
}

/* Regenerate loading state */
.regenerating {
  opacity: 0.4;
  transition: opacity 0.2s;
  pointer-events: none;
}

/* Share buttons */
.share-row {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.btn-copy-link {
  flex: 1;
  background: white;
  border: 2px solid var(--lego-yellow);
  color: #1a1a1a;
  border-radius: 12px;
  padding: 14px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  text-align: center;
}

.btn-add-to-bench {
  flex: 1;
  background: var(--lego-yellow);
  border: none;
  color: #1a1a1a;
  border-radius: 12px;
  padding: 14px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  text-align: center;
  text-decoration: none;
  display: block;
}
```

---

## Testing Checklist

- [ ] Click "View full build →" on a bench idea card — opens idea.html with correct URL params
- [ ] Piece images load correctly from Rebrickable for each part number
- [ ] 7-step build guide renders with yellow step number circles
- [ ] "Copy link" copies the URL and shows "Copied!" toast
- [ ] Pasting that URL in a new tab loads the same idea
- [ ] "Add pieces to bench →" saves pieces and redirects to bench.html with pieces loaded
- [ ] "Regenerate →" generates a new idea in place with a fade transition
- [ ] "Ask BrickBot a question" input works and shows chat bubbles
- [ ] Page looks correct on mobile
- [ ] Back link returns to bench.html

---

## How to Tell Claude Code

> "Read BrickBot_IdeaDetailPage.md. Build the idea detail page feature exactly as described. Create idea.html, css/idea.css, and js/idea.js. Create two new Netlify functions: get-idea-detail.js and ask-brickbot.js. Modify js/bench.js to add the 'View full build →' button to each idea card. Do not touch any other files. When done, deploy to Netlify."

---

*BrickBot — Know your bricks. Build anything. 🤖🧱*
