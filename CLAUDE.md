# blend-website — working notes

The marketing site: static HTML, one file per page, styles and scripts
inlined per page, deployed by Vercel from `main` with `cleanUrls`. There is
no build step and no package.json; what is in the file is what ships.

## Product UI

**The homepage's product tour (`#product`) carries four hand-rebuilt
copies of the dashboard, and they will drift.** Nothing else on the site
copies the product.

The founder asked for them on 2026-10-21, from screenshots: 01 the quiz
builder (`.bx`), 02 the results builder (`.bx.rx`), 03 Analytics (`.ax`, the
whole page, scrolled to the part each card is about) and 04 Contacts (`.cx`).
Each is the screen's own layout drawn at the width it was captured, 2000px,
and scaled into the frame, so it is sharp at any size and is not an image.
/how-it-works showed three of them again, as short loops (founder,
2026-10-21: "gifs for the how it works"), until each of its steps got its own
film (below); it copies none of their markup now.
Their rules live once, in `product-screens.css`, linked by both pages; the
markup is copied, the homepage is the source, and
`node tools/check-screens.mjs` refuses when a copy differs.
Step 01 of /how-it-works has a fifth, the Catalogue (`.kx`, 2026-10-22),
which is on that page only, so there is no copy to check. It is directed
rather than walked through ("more than just someone strolling around the
webapp"): a camera over the page, `--cx --cy --cs` per beat. Its prices are
in pounds, because `tools/check-prices.mjs` holds every `$` figure on the
site to `pricing.json`, and its product descriptions make no health claims.
Step 02 has a sixth, Match (`.mx`, on the same `.kx` dashboard): Blend AI's
scan, its list of matches and a combined product's Edit page. Its products are
invented and marketing-named, half of them made of more than one ingredient;
what each is matched to, and every goal and "Not suitable for" tag the matched
cards show, are the engine's master references in
`algorithms/personalization/data/product_taxonomy.json`, a combined product's
being all of its ingredients' together. Regenerate them from there if the
references change; never type a restriction in by hand.
Step 03 has a seventh, the Quiz page and its editor (`.qx`, on the same
dashboard): Brand essentials, Typography, Layout and spacing, Answers and
buttons, Transitions, a screen's Content and Style, and Quiz setup. Its preview
is one quiz screen drawn from the brand's variables (`--q-*`), so restyling it
is changing them, as the editor does. Step 04 has an eighth, Recommend
(`.wx`): the results editor's Wellness plan, drawn with the report's own `.rp`
rules, and its Style and Text panels changing the layout, the product cards,
the colours and what a card shows. Three products (founder: "show case 3
products that's enough"), each with a canister photograph, and descriptions in
the authorised wording for its nutrient, not the demo data's claims. It comes
before Launch since 2026-10-22 (founder: "results should go before embed");
the anchors `#recommend` and `#launch` stay with their content, so `#step-4`
is Launch and `#step-5` Recommend. Step 05 has a ninth, Launch (`.lx`):
the Quiz page as Design leaves it, its Embed panel and Publish. Its embed code
and direct link carry an invented quiz id, never a real account's, and the
address it is locked to is yourbrand.com (founder: "make sure you add fake codes
and links"). Step 06 sets the homepage's Analytics (`.ax`) in the same
dashboard (`.vx`), regenerated from the homepage's markup with the states its
film needs: a tile picked, its panel swapped and its number counting up, a
pointer resting on the chart, the Sleep follow-up in Answer insights, Who wants
what by gender. Each does what the product does (`apps/webapp`
`components/dashboard/metric-explorer.tsx`, `answer-insights.tsx`,
`cross-tab-grid.tsx`), so no dashed previous period and no weekly charts. The
question and its answers are the demo quiz's own
(`apps/webapp/supabase/seed/quiz-demo.json`), and every new figure derives from
the page's: the completion-rate chart is the two engagement series pooled over
seven days, and the gender columns sum to the age columns' 1,212. Every film
opens on the whole dashboard, zooms in, and goes back out to it at the end
(founder: "same rule as before", "entire dashboard to end too").
What keeps them honest:

- **Words** come from `apps/webapp/lib/copy.ts`, and **counts** from the
  webapp's own enums (`lib/schemas/theme.ts`: 12 layouts, 4 answer styles,
  6 button styles, 8 transitions). Check there before changing a card.
- **Analytics shows invented numbers that add up**: 1,284 starts, 912
  completions, four products a plan, EUR 27 a product. Purchased stays
  "Coming soon", because purchase tracking is. Never fill in a figure the
  product cannot produce.
- **Contacts shows invented shoppers** on the reserved example domains,
  never a real list, and the button is **Remove**, never Erase. In the
  product, Remove takes someone off the list and out of the export, and a
  full erasure goes to contact@blend-technologies.com. The site must not
  promise more than that.
- **When the dashboard's look changes, the copies are stale.** Nothing here
  can notice. Ask the founder for fresh screenshots and redraw.

The lesson from before still holds: a copy of the product UI drifts from
the product, and nobody who would notice reads this repository. The fragment
that used to sit on `/sample-report` disagreed with its own breakdown for
months; that page now embeds the live report instead. `/how-it-works` dropped
its six screenshots for drawings. `tools/scope-mockups.mjs` and its exports
are deleted, and there is still no pipeline.

`blend-mockups/` still exists and holds exactly one thing: `science/`, the
engine's own exports that `/science` is written from, produced by
`algorithms/personalization/tools/export_science_facts.py` and
`export_engine_trace.py`. The folder keeps its name because those two
exporters write to it by path and they belong to another lane.

## The design system

`docs/DESIGN_SYSTEM.md` in the workspace is the source, agreed with the founder
on 2026-10-20, for this site and for the webapp after it. `theme.css`'s "THE
SYSTEM" block carries its tokens. The three rules, in short: surfaces are
neutral (white, zinc greys, near-black, glass in those tones, nothing beige);
colour means something (green, yellow, red, on small things only, never alone);
gold is Blend (actions and active state, never status or data). Measure
contrast from rendered pixels, never from tokens, especially on glass. The
hero's quiz and plan are a fictional client's theme and are exempt from the
gold rule on purpose.

## Prices

`pricing.json` is where plan prices are written. `index.html` still carries
its own copy in `data-price-*` attributes on each tier;
`node tools/check-prices.mjs` refuses when the two disagree. Run it before
merging anything that touches either.

## The Science page

`/science` states what the engine does, so none of those figures are typed
here. `blend-mockups/science/science-facts.json` is generated from the
engine by `algorithms/personalization/tools/export_science_facts.py` and
arrives with the mockup export;
`node tools/sync-science-facts.mjs` writes the stat strip, the goal rails
and the `GOAL_SUBS` map from it, between `science:*` markers. To change one
of those numbers, change the engine and regenerate — editing the page by
hand will be overwritten, and `--check` refuses a stale page.

Before this existed the strip claimed 30+ scored product attributes where
the scorer reads 25, and the rails showed 37 of the engine's 41 goals under
a heading promising every goal a customer can pick.

## The sample report

`/sample-report` **is** the demo. It embeds a real submission against the
same quiz `/try` runs, so changing that quiz — its questions, its report
sections, their order, the layout, the colours — changes this page with no
work here at all.

It was an inlined export of the report component rendered against a
fixture, and the fixture drifted: every percentage on a product card
disagreed with the breakdown underneath it, for months, and nothing in this
repository could have noticed.

- The URL lives in `demo-report.json` and in the `#reportFrame` iframe.
  `node tools/check-demo-report.mjs` refuses when the two disagree or when
  the embedded URL has stopped being a report.
- **A results link is good for 90 days** (`RESULTS_LINK_TTL_DAYS`,
  `lib/quiz/results-expiry.ts`), checked before the recommendation is ever
  fetched. On day 91 the page becomes one line of grey text and every other
  check still passes — the page returns 200, the iframe loads, and the
  screenshot suite cannot see inside a cross-origin frame. The checker warns
  21 days out and fails after. Replacing it means taking the demo quiz
  again and putting the new URL in both places.
- **The page is two columns**: what Blend is and what this customer told it
  on the left, the report those two produced on the right at half size.
  The report column is a FIXED 576px, not a fraction, so the iframe lays
  out at exactly 1024 and draws at exactly 0.5 — the app turns its macro
  grid from two columns to four at 1024, so a column that follows the
  window shows a tablet layout shrunk instead of the desktop one the
  fullscreen button opens.
- **The answers panel is a shape, not a list.** `api/_demo-summary.mjs`
  builds who, goals, what they reported, how they live and what they eat
  from the live submission; the full 43 rows sit behind a disclosure. It
  printed all 43 in quiz order until 2026-10-19, and quiz order is
  demographics first, so the rows a reader saw were consent, a name and a
  unit choice while everything that produced a recommendation was below
  the fold.
- The panel is served by `/api/demo-answers`, a Vercel edge function, which
  does not exist under a static server — so every local preview and every
  visual-diff capture saw it hidden, and it was reported twice as missing
  while being live the whole time. `demo-answers.json` is the same payload
  vendored; `node tools/sync-demo-answers.mjs` writes it and
  `check-demo-report.mjs` refuses when it drifts from the live submission.
  Never edit it by hand. The sync also refuses to vendor a SMALLER panel
  than the one on disk without `--accept-smaller`, because a matcher that
  stopped fitting the quiz and a quiz that stopped asking look identical,
  and the drift check cannot tell them apart once both sides agree.
- The height comes from the report itself. It posts
  `{source:"blend-report", type:"frame:height"}` on every resize
  (`components/report/embed-auto-height.tsx`), built for brands embedding
  the report on their own site; the page listens for that and checks the
  origin. There is a tall fallback height for the message that never comes.
- The palette swatches are gone with the fragment. A `--quiz-*` custom
  property cannot cross an origin, so there was nothing left for them to
  repaint. The live report wears the demo brand's own colours.

## Agreement between pages

The visual-diff suite compares each page against its own baseline, so
anything that is wrong the same way in every capture of a page is
invisible to it. The wordmark under /use-cases was missing its full stop
on four pages, in the bar and the footer, for months.

`node tools/check-wordmark.mjs` compares the wordmark drawing across
every page and refuses when they disagree. Anything else that is supposed
to be identical everywhere wants a check of the same shape rather than a
baseline.

`node tools/check-css-shape.mjs` guards a different invariant: not "do the
copies agree" but "does this file mean what it says". It carries two rules.
The second: an element the page hides with `hidden` may not be the subject
of an author `display` rule, because `hidden` is `display:none` in the UA
sheet and any author `display` beats it. /sample-report's transcript shipped
open on 2026-10-19 for exactly that — `.answers-all{display:grid}` under a
button offering to show it. The first: /try's embed opened
flush against the nav on 2026-10-18 because the nav consolidation had left
`.footer` behind with no block, and a selector with no `{}` joins the next
prelude — `.try-embed-section` had quietly become `.footer .try-embed-section`
and matched nothing. Valid CSS, no warning, and invisible to a per-page
baseline, which only knows what the page has looked like since.

`node tools/check-checkout.mjs` is the one that protects revenue. On
2026-10-19 every YEARLY checkout on the pricing page was broken and had
been for as long as anyone could tell: the toggle emits `cycle=yearly`,
the app validates against `["monthly", "annual"]`, and the rejection 307s
to `/pricing?error=unknown_plan`, which vercel.json rewrites to `/`. A
customer choosing annual billing was returned to the top of the homepage
with no card taken and nothing said. Every check passed through all of it,
because the link is in the HTML, it looks right, and the end of the
redirect chain is a 200. The check FOLLOWS each link the page can emit and
passes only when it lands on Stripe. `check-prices.mjs` grew the same
instinct: it read only the homepage's tier attributes, so `$299` in a
sentence on /use-cases/compare was invisible to it.

`node tools/check-dashes.mjs` is the same shape again, for punctuation.
The founder's note on 2026-10-19 was "NO HYPHENS NEVER", and a count
settled what it meant: the whole site carried exactly ONE em dash in
visible copy, on the page written that day, and every other page carried
zero. Twelve of thirteen already obeyed a rule nothing enforced. It reads
entities too, which is how it found the two the raw count missed, both
written `&#8212;` in the engine terminal's header on /index and /science
(the second lives in `sync-science-facts.mjs`, since that block is
generated). The en dash stays legal: it is the range character, and the
demo's own quiz answers arrive carrying it.

`node tools/check-nav.mjs` is that check for the bar, and it was needed:
on 2026-10-17 there were **seven distinct nav markups across thirteen
pages** — the logo pointed at four different places, the demo link was
`/try` on six pages and `try.html` on five, and the button said "Try the
demo" on two and "Try it yourself" on ten. Reported by the founder as
"nav is different in every page".

Two differences are sanctioned and normalised away by the check: the
active-page marker, and `#pricing` on the homepage (an anchor already on
the page) against `/#pricing` elsewhere. `/try` is the one whole-page
exception — its nav carries "Book a call", because a demo button there
would point at the page you are on.

## Class names the chrome already uses

The bar toggles `open` on `.nav` to show its menu, and the stylesheets on a
page are one namespace. On 2026-10-21 the homepage's opener section was
`class="open"`, so every `.open{...}` rule written for that section also
landed on the bar the moment a phone opened its menu: 72px of padding and a
tall minimum height pushed the logo and the close button down behind the
sheet. It was live for a day and the founder found it on a phone. Name a
section for what it is (`.opener`), never with a word the chrome uses as a
state (`open`, `active`, `scrolled`, `is-*`). `nav-sheet.spec.mjs` in the
workspace now asserts the bar does not move when its menu opens.

## Before merging

- `node tools/check-prices.mjs`
- `node tools/check-checkout.mjs`
- `node tools/sync-science-facts.mjs --check`
- `node tools/check-wordmark.mjs`
- `node tools/check-nav.mjs`
- `node tools/check-screens.mjs`
- `node tools/check-demo-report.mjs`  (and `sync-demo-answers.mjs` when it refuses)
- `node tools/check-css-shape.mjs`
- `node tools/check-dashes.mjs`
- `node tools/check-product-facts.mjs`
- `python3 ../../tools/check_british_english.py`
- the visual-diff suite in the workspace: `cd ../../tools/visual-diff && npm run check`

All but the last now also run in CI on every PR (`.github/workflows/checks.yml`).
They used to be this list alone, and the site drifted anyway: it claimed "30+
product attributes" about *scoring* while `/science` said 25, and an outside
reviewer found it before we did. A list of commands is not a gate.

## Figures the engine owns

`PRODUCT_FACTS.md` in the workspace is canonical, and CLAUDE.md there says no
lane publishes a figure externally unless it appears in it. This repository is
its own git repository and cannot see that file, so the governed figures are
vendored in `product-facts.json` exactly the way `pricing.json` vendors prices.

- `node tools/sync-product-facts.mjs` regenerates the vendored copy from a full
  workspace checkout.
- `node tools/check-product-facts.mjs` compares the site's prose AND its JSON-LD
  against it, and — whenever the markdown is reachable — checks the vendored
  copy has not gone stale.

It binds a *claim* to a figure rather than matching numbers. 31 and 21 are real
(columns in `supplements_db.json`, `apply_*` functions in `safety.py`); they are
answers to a different question than "what does the engine score". A sentence
about scoring takes the scorer's number.
