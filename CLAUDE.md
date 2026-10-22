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

`/sample-report` is drawn here, not embedded (2026-10-22). It embedded one
live demo result from the webapp until that result was deleted with the
demo account's data, and the page showed "Page not found" inside its frame
while the check guarding it passed: it read the 404 as "could not reach".
An embedded result can be taken down by anything that touches the demo
account, and nothing in this repository can see it go.

- **Every figure is the engine's.** `sample-report.json` vendors the request
  (Alex's 43 answers in `demo-answers.json`, mapped to stable ids the way the
  webapp's `lib/quiz/engine-payload.ts` does, country GB) and what the engine
  returned for it against the demo tenant's catalogue: eight picks with their
  tiers, reasons, forms and the one caution, nine macros, two gaps, and the
  report's own words. `node tools/check-sample-report.mjs` refuses when the
  page shows anything the file does not. To change a figure, re-run the
  request and change both.
- **In the UK, Melatonin is out.** The engine's legality gate removes it
  (prescription-only) and Cordyceps takes its place; the guide says so,
  because it is the clearest safety proof on the page.
- **Two spellings are the site's, not the engine's**: the em dash in the
  algae oil's name is a comma, and "Healthy Aging" is "Healthy Ageing". The
  demo catalogue has no prices (none shown) and no photographs (the cards
  carry the site's canister shots, and the page says so).
- **Desktop holds a guide beside the report** (`sample-report.js`), opening
  the part in view, and the hero's index marks it too. Under 1024px the
  guide reads first, all open, and the report follows.
- **The pitch band is the founder's copy of 2026-10-19, as written.** It
  carries outcome claims CONTENT_STATE.md forbids ("Convert more visitors",
  "Increase average order value"); that was raised then and the founder
  specified it anyway. Only its button changed, to the site's "Book a call".

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

`node tools/check-cookie-consent.mjs` is that check for the cookie banner,
and it was needed: five of thirteen pages carried no consent system at all —
`/sample-report`, the page sent in cold outreach, and all four under
`/use-cases`. The eight that had it had had it since they were written, so no
capture of the other five ever showed a banner and no baseline was ever wrong.

It checks THREE parts, not two. Beyond the stylesheet and the script there is
the `#blend-cookie-banner` markup, inline in every page, and
`cookie-consent.js` does not build it — `showBanner()` looks the element up
and returns if it is not there. So a page carrying only the stylesheet and the
script renders no banner on first visit and leaves `window.blendBookDemo()` a
button that silently does nothing, with the two ways round it that the prompt
offers (Calendly in a new tab, and email) inside the message that never
appears.

It resolves the hrefs rather than comparing them, because four of the thirteen
pages are one directory down, where the relative form the root pages use
resolves to `/use-cases/cookie-consent.css` and 404s — silently, since a
missing stylesheet and a missing script complain to nobody. Both path forms
are legal wherever they actually work. One difference is sanctioned and
normalised away: the privacy-policy href, relative on the root pages and
root-relative below them.

It strips HTML comments first. `/sample-report` and `/try` both carry a note
quoting `<script src="cookie-consent.js">` while explaining that a script
element with a src ignores its inline content, and the first version of the
check counted that prose as the include.

There is a fourth part it does **not** check: the `Cookie settings` link in
`.footer-bottom` that calls `blendOpenCookieSettings()`, which the eight
original pages carry and the five do not. It is the only way to change a
choice once made, so it is worth more than tidiness — but the four
`/use-cases` pages carry a different footer and `sample-report.html` has no
`<footer>` at all, and a check cannot demand it of a page with nowhere to put
it. Consent is stored per origin, so the link on any other page still governs
the whole site. When all thirteen footers can carry it, require it here too.

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

## Ratios are measured, not divided in CSS

On 2026-10-22 the homepage hero's pair was scaled to its column with
`transform:scale(tan(atan2(100cqw, 538px)))`, the trick that divides a length
by a length. Chromium and Playwright's WebKit drew it right; the founder's
browser drew the pair four times too big at one width and upside down at
another. A scale that depends on a box's size is set from script (a
ResizeObserver writing a plain number into a custom property), with stepped
media-query values as the no-script fallback. Check anything width-driven in
both engines, and across a sweep of widths, not at three.

## Before merging

- `node tools/check-prices.mjs`
- `node tools/check-checkout.mjs`
- `node tools/sync-science-facts.mjs --check`
- `node tools/check-wordmark.mjs`
- `node tools/check-nav.mjs`
- `node tools/check-screens.mjs`
- `node tools/check-cookie-consent.mjs`
- `node tools/check-sample-report.mjs`
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
