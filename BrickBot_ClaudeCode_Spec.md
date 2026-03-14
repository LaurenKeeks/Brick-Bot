# BrickBot — Claude Code Build Spec
**The LEGO Piece Detective**
*Built by Malakai*

---

## What to build

BrickBot is a free web app where users type in a LEGO part number OR upload a photo of an unknown piece, and instantly get:
- The part name, image, colors it comes in, and every set it ever appeared in
- AI-generated build ideas filtered by age group and topic (powered by Claude)
- A follow-up chat so they can keep asking BrickBot for more ideas

**Live demo of the core interaction:**
> User types `3001` → BrickBot shows the 2x4 Brick (image, 64 colors, 5,000+ sets) → User picks "Ages 9-12" + "Vehicles" → Claude generates 5 vehicle build ideas using that piece as the star → User asks "what if I have 50 in red?" → BrickBot answers

---

## Tech stack

| Tool | Purpose | Cost |
|---|---|---|
| HTML + CSS + Vanilla JS | The entire frontend | Free |
| Rebrickable API | All LEGO part/set/color data | Free (sign up at rebrickable.com) |
| Claude API (`claude-sonnet-4-5`) | Build ideas + photo identification | Pay per use |
| Netlify + Netlify Functions | Hosting + serverless API proxy | Free tier |

**CRITICAL — API key security:** Never put API keys in frontend JS. The browser is public. Use Netlify Functions as a server-side proxy. The browser calls `/api/get-ideas`, the Netlify function runs on the server and calls Claude with the key stored in Netlify environment variables.

---

## File structure

```
brickbot/
  index.html                  ← homepage
  part.html                   ← part results page (dynamic by part #)
  mystery.html                ← photo identification page
  css/
    styles.css
  js/
    app.js                    ← main logic
    api.js                    ← calls to /api/ endpoints
    ui.js                     ← DOM helpers
  netlify/
    functions/
      get-part.js             ← proxy → Rebrickable parts endpoint
      get-sets.js             ← proxy → Rebrickable sets endpoint
      get-colors.js           ← proxy → Rebrickable colors endpoint
      get-ideas.js            ← calls Claude for build ideas
      identify-photo.js       ← calls Claude vision for photo ID
  netlify.toml
```

---

## Design system

### Colors
| Name | Hex | Use |
|---|---|---|
| LEGO Yellow | `#FFD700` | Primary brand, buttons, accents, logo |
| LEGO Red | `#CC0000` | Secondary accents, hover states |
| Dark Navy | `#1A1A2E` | Page background — makes yellow pop |
| White | `#FFFFFF` | Cards, content areas |
| Light Gray | `#F5F5F5` | Input backgrounds, secondary cards |
| Muted Gray | `#888888` | Secondary text, metadata |
| LEGO Blue | `#006DB7` | Links, info, sets section |
| LEGO Green | `#00A650` | Success states, buy buttons |

### Typography
- **Primary font:** Nunito or Poppins (rounded, friendly, readable for kids) — load from Google Fonts
- **Code/part numbers:** JetBrains Mono
- **Minimum body text:** 16px
- **Buttons:** Bold, generous padding, minimum 14px

### Component rules
- **Buttons:** `border-radius: 12px`, yellow fill, black bold text, hover → red
- **Cards:** White background, `box-shadow: 0 2px 12px rgba(0,0,0,0.08)`, `border-radius: 16px`, 24px padding
- **Search bar:** Height 56px minimum, `border-radius: 28px` (pill shape), centered
- **BrickBot speech bubbles:** Yellow left border (`border-left: 4px solid #FFD700`), robot icon, slightly casual tone
- **Part image display:** Minimum 200px, white card background so any brick color pops
- **Color swatches:** 32px circles with a subtle border, color name tooltip on hover
- **Set thumbnails:** 3-column grid on desktop, tappable to expand

### Mascot
A small LEGO minifigure robot with a magnifying glass. Use in the BrickBot ideas section header and loading states. Can be a simple SVG or emoji-style illustration — friendly detective energy.

---

## Page 1 — Homepage (`index.html`)

**One job: get the user to search or take a photo within 5 seconds.**

### Layout top to bottom:
1. **Header** — BrickBot logo (left), nav links: "About" and "How it works" (right)
2. **Hero section** — dark navy background, large centered headline: *"What IS that piece?"*, tagline: *"Know your bricks. Build anything."*
3. **Search area** — two options side by side:
   - Text input with placeholder: `Enter a part number (e.g. 3001)`
   - Camera button: `📷 Take a photo` — opens file picker or camera on mobile
4. **Example chips** — 4 clickable chips below search: `3001 — 2x4 Brick`, `3005 — 1x1 Brick`, `3622 — 1x3 Brick`, `3040 — Roof Tile` — clicking one runs the search
5. **How it works** — 3 steps with icons: *(1) Find your piece or snap a photo → (2) BrickBot looks it up → (3) Get AI build ideas)*
6. **Recent lookups** — show 6 recently looked-up parts with thumbnails: *"People are looking up..."* — cache last 20 lookups in localStorage
7. **Footer** — BrickBot logo, "Built by Malakai", disclaimer: "BrickBot is not affiliated with The LEGO Group®"

---

## Page 2 — Part Results (`part.html?part=3001`)

**URL:** `/part.html?part=3001` (read the part number from the URL query string)

### Sections in order:

#### Part header
- Large part image from Rebrickable (`part_img_url`) on the left
- Right side: part name (big, bold), part number in monospace, category badge (e.g. "Basic Brick"), stat pills: "64 colors" and "5,284 sets"

#### Color swatches
- Label: *"Available in X colors"*
- Horizontally scrollable row of 32px color circles
- Each circle uses the actual color hex (Rebrickable returns the RGB value)
- Hover/tap shows color name (e.g. "Bright Red", "Sand Green")

#### Sets section
- Label: *"Found in X sets"*
- Grid of set thumbnails: set image, set name, year, piece count
- Show first 12, then a "Show all X sets ↓" expand button
- Each set thumbnail links to the official Rebrickable page for that set

#### BrickBot Build Ideas (AI section)
- Yellow-accent card with robot mascot icon
- Header: *"BrickBot says..."*
- **Before generating:** Show two selectors:
  - **Age group** (single select, button group): `Ages 5–8` · `Ages 9–12` · `Ages 13+`
  - **Topics** (multi-select chips): Animals · Vehicles · Buildings · Space · Fantasy · Robots · Nature · Food · Sports
  - Default: Ages 9–12, no topic
  - "Get ideas →" button triggers the Claude API call
- **While loading:** Show animated loading state with BrickBot mascot — *"BrickBot is thinking..."*
- **Results:** 5 idea cards (see AI spec below)
- **Follow-up chat:** Text input below cards — *"Ask BrickBot for more ideas..."* — sends follow-up to Claude with conversation history

#### Buy links
- Row of two buttons:
  - `🔵 Find on BrickLink` → `https://www.bricklink.com/v2/catalog/catalogitem.page?P={part_number}`
  - `🟢 Search Amazon` → Amazon affiliate search link (add your affiliate tag once you have it)

---

## Page 3 — Photo ID (`mystery.html`)

**Goal:** User uploads or takes a photo of an unknown piece, BrickBot identifies it.

### Flow:

**Step 1 — Upload zone**
- Dashed border upload area, camera icon in center
- Instruction text: *"Lay the piece flat on a plain white or light surface for best results"*
- Accept: `image/*`
- On mobile: offer camera + photo library

**Step 2 — Send to Claude Vision**
- Convert image to base64
- POST to `/api/identify-photo` Netlify function
- Show loading state: *"BrickBot is examining your piece..."*

**Step 3 — Show results**
- **Top match card:** Part name, part number, confidence badge (High = green / Medium = yellow / Low = red), part image from Rebrickable (look up by the returned part number)
- **Alternative matches:** Up to 2 "Could also be..." smaller cards
- **CTA button:** `View full details →` loads `part.html?part={part_number}`

**If identification fails:**
> *"BrickBot isn't sure about this one! Try a clearer photo with the piece on a plain white surface. Or check the part number stamped on the bottom of the piece and type it in the search bar."*

---

## Rebrickable API integration

**Base URL:** `https://rebrickable.com/api/v3/lego/`
**Auth header:** `Authorization: key YOUR_API_KEY`

### Endpoints to use:

```
GET /parts/{part_num}/
  Returns: name, part_num, part_img_url, part_url, part_cat_id

GET /parts/{part_num}/colors/?page_size=100
  Returns: array of { color_name, color_rgb, num_sets, num_set_parts }

GET /parts/{part_num}/sets/?page_size=12
  Returns: array of { set_num, name, year, num_parts, set_img_url }
```

### Example Netlify function — `get-part.js`:
```javascript
exports.handler = async (event) => {
  const partNum = event.queryStringParameters.part;
  const response = await fetch(
    `https://rebrickable.com/api/v3/lego/parts/${partNum}/`,
    { headers: { 'Authorization': `key ${process.env.REBRICKABLE_API_KEY}` } }
  );
  const data = await response.json();
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  };
};
```

### Caching:
Cache all Rebrickable responses in `localStorage` for 24 hours.
Cache key: `rb_part_3001`, `rb_colors_3001`, `rb_sets_3001`
Before any API call, check localStorage first.

---

## Claude API integration

### Build ideas — `get-ideas.js` Netlify function:

```javascript
exports.handler = async (event) => {
  const { partName, partNumber, category, ageGroup, topics, conversationHistory } = JSON.parse(event.body);

  const systemPrompt = `You are BrickBot, an enthusiastic LEGO-obsessed AI assistant for kids and fans of all ages. 
You give creative, encouraging, specific build ideas. You speak in a friendly, exciting tone. 
You never suggest buying more pieces — only use what someone might already have.`;

  const userPrompt = `I have a LEGO piece:
Part name: ${partName}
Part number: ${partNumber}
Category: ${category}

Give me exactly 5 creative build ideas using this piece as the STAR of the build.
Target age group: ${ageGroup}
Preferred topics: ${topics.length > 0 ? topics.join(', ') : 'anything fun'}

Format each idea exactly like this:
IDEA 1: [catchy name]
DIFFICULTY: [Beginner / Intermediate / Advanced]
DESCRIPTION: [2-3 sentences, enthusiastic, mention the specific part, tell them what to do with it]

Make kids excited to start building. Be specific about HOW the part is used.`;

  const messages = conversationHistory
    ? [...conversationHistory, { role: 'user', content: userPrompt }]
    : [{ role: 'user', content: userPrompt }];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1200,
      system: systemPrompt,
      messages
    })
  });

  const data = await response.json();
  return {
    statusCode: 200,
    body: JSON.stringify({ ideas: data.content[0].text })
  };
};
```

### Photo identification — `identify-photo.js` Netlify function:

```javascript
exports.handler = async (event) => {
  const { imageBase64, mediaType } = JSON.parse(event.body);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageBase64 }
          },
          {
            type: 'text',
            text: `You are a LEGO part identification expert. Examine this image carefully.
Respond ONLY with valid JSON in this exact format, no other text:
{
  "partName": "exact LEGO part name",
  "partNumber": "part number as string e.g. 3001",
  "confidence": "High or Medium or Low",
  "alternatives": [
    { "partName": "alternative name", "partNumber": "alt part number" },
    { "partName": "alternative name 2", "partNumber": "alt part number 2" }
  ]
}
If you cannot identify the piece at all, return confidence "Low" and your best guesses.`
          }
        ]
      }]
    })
  });

  const data = await response.json();
  const raw = data.content[0].text;
  try {
    const parsed = JSON.parse(raw);
    return { statusCode: 200, body: JSON.stringify(parsed) };
  } catch {
    return { statusCode: 200, body: JSON.stringify({ error: 'Could not parse response', raw }) };
  }
};
```

---

## Netlify config (`netlify.toml`)

```toml
[build]
  functions = "netlify/functions"
  publish = "."

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[functions]
  node_bundler = "esbuild"
```

---

## Environment variables (set in Netlify dashboard)

```
REBRICKABLE_API_KEY=your_rebrickable_key_here
CLAUDE_API_KEY=your_anthropic_key_here
```

Never commit these to GitHub. Set them only in the Netlify dashboard under Site Settings → Environment Variables.

---

## Parsing the Claude build ideas response

The Claude response comes back as plain text. Parse it client-side:

```javascript
function parseIdeas(text) {
  const ideas = [];
  const blocks = text.split(/IDEA \d+:/i).filter(Boolean);
  for (const block of blocks) {
    const nameMatch = block.match(/^(.+?)\n/);
    const diffMatch = block.match(/DIFFICULTY:\s*(.+?)(?:\n|$)/i);
    const descMatch = block.match(/DESCRIPTION:\s*([\s\S]+?)(?=IDEA \d+:|$)/i);
    if (nameMatch && diffMatch && descMatch) {
      ideas.push({
        name: nameMatch[1].trim(),
        difficulty: diffMatch[1].trim(),
        description: descMatch[1].trim()
      });
    }
  }
  return ideas;
}
```

Difficulty badge colors: `Beginner` → green (`#00A650`), `Intermediate` → yellow (`#FFD700`), `Advanced` → red (`#CC0000`).

---

## Error states to handle

| Scenario | What to show |
|---|---|
| Part number not found in Rebrickable | *"BrickBot couldn't find that part number. Double-check the number on the bottom of the piece."* |
| Rebrickable returns no image | Show a gray placeholder with the LEGO brick outline SVG |
| Claude API times out | *"BrickBot is taking a nap — try again in a second!"* with a retry button |
| Photo too blurry / unidentifiable | *"BrickBot needs a clearer photo! Try placing the piece on a white surface with good lighting."* |
| No internet | Serve cached data from localStorage if available, otherwise show offline message |

---

## Monetization hooks (build these in from day 1)

- **Amazon affiliate:** All "Search Amazon" buttons use URL: `https://www.amazon.com/s?k=LEGO+{part_name}&tag=YOUR_AFFILIATE_TAG` — add tag once approved
- **BrickLink links:** `https://www.bricklink.com/v2/catalog/catalogitem.page?P={part_number}` — no affiliate program but good for users
- **Pro tier hooks:** Add a `checkProLimit()` function that checks localStorage for a `brickbot_pro` flag. For v1 launch, this always returns `true` (unlimited). Wire up the limit logic later when you add Stripe.
- **Google Analytics:** Add GA4 tracking tag to all pages. Track events: `part_search`, `photo_upload`, `ideas_generated`, `buy_click`

---

## Build this in order

1. **Start here:** `index.html` with the search bar UI and basic styles. No API yet — just the layout.
2. **Add Rebrickable:** Wire up the part number search to call `/api/get-part`. Show part name and image.
3. **Add colors + sets:** Call `/api/get-colors` and `/api/get-sets`. Render swatches and set grid.
4. **Add Claude build ideas:** Wire up the age/topic selectors and the "Get ideas" button. Call `/api/get-ideas`. Parse and display the 5 idea cards.
5. **Add follow-up chat:** Text input that sends follow-up messages to Claude with conversation history.
6. **Add photo ID:** Build `mystery.html`. Wire up image upload → `/api/identify-photo` → results.
7. **Polish:** Loading states, error states, mobile responsiveness, example chips on homepage.
8. **Deploy:** Push to GitHub, connect to Netlify, set environment variables, buy domain.

---

## Notes for Claude Code

- Keep it vanilla HTML/CSS/JS — no React, no build tools, no complicated setup. This should run directly in a browser with no compilation step.
- Mobile-first — most users will be on a phone photographing a piece they just found.
- Rebrickable API requires the `Authorization: key YOUR_KEY` header (note: it's `key` not `Bearer`).
- The Rebrickable API returns part images as full URLs — just drop them in an `<img src="">` tag.
- For the photo upload, use `FileReader.readAsDataURL()` to get base64, then strip the `data:image/jpeg;base64,` prefix before sending to Claude.
- Test part numbers that work well: `3001` (2x4 brick), `3005` (1x1 brick), `3622` (1x3 brick), `3040` (roof tile), `32525` (Technic beam), `3626` (minifig head).

---

*BrickBot — Know your bricks. Build anything. 🤖🧱*
