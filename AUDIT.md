# blend-technologies.com — Site Audit

_2026-07-30. Audited against `CLAUDE.md` and `PRODUCT_FACTS.md`. Findings verified against the live deploy, not local files._

---

## 1. Verdict

The craft level is high and the proof assets are genuinely strong: `/sample-report` and the live quiz on `/try` show a working product, which does more for legitimacy than any claim could. Every number on the site now traces to `PRODUCT_FACTS.md` with one exception, and the recent comparative-claims work has removed the legal exposure that was there a week ago.

The single biggest weakness is the conversion path. Four different primary actions compete across the site (**Try it yourself** ×11, **Start free trial** ×8, **Try the live demo** ×7, **Book a demo** ×4) with no hierarchy between them, so a director who is convinced has to decide what to do next instead of being told.

A note on the brief: **"80+ nutrients modeled per person" is not live.** Zero occurrences across all pages. It was corrected in an earlier pass and `/sample-report` now reads "42 Nutrients personalised per person" with the 83-per-food reference sub-line, matching `PRODUCT_FACTS`.

---

## 2. Findings

| Page | Issue | Sev | Recommendation |
|---|---|---|---|
| `use-cases/shopify.html` | A `1g` dose badge on Omega-3 Fish Oil survived the site-wide dose removal. Every other dose figure was stripped for regulatory reasons; this one used a bare `g` and escaped the `mg\|mcg\|IU` sweep. | 🔴 | Replace with `Essential`, matching the identical card on `index.html`. |
| Sitewide | Four competing primary CTAs, no hierarchy. `Start free trial` and `Try the live demo` and `Try it yourself` are three labels for what a visitor reads as one intent. | 🔴 | Pick one primary verb sitewide. Recommend **Try it yourself** → `/try`, with **Book a demo** as the single secondary. Retire `Start free trial` as a button label; keep it as pricing-section copy. |
| `index.html` (Science) | **"20+ user signals"** does not appear in `PRODUCT_FACTS.md`. The file lists `20+ safety checks` as a safe phrasing, which maps to the verified 21 safety gates, but there is no verified user-signals count. | 🔴 | Either get Health Algorithm to add a verified row, or swap the tile to **"20+ safety checks"**, which is verified and arguably a stronger claim. |
| `_marquee-preview.html`, `_marquee-preview-v2.html` | Both return **HTTP 200** on the production domain. They are `noindex,nofollow` and absent from the sitemap, so SEO risk is low, but they are leftover working files publicly reachable on the live site. | 🟡 | Delete from the repo. Confirmed unlinked from any page. |
| `index.html` | The word **"persona" appears 15 times in visible copy** while the core positioning is "no persona buckets". The word we attack is the word we use most. | 🟡 | Rename the customer-example section language to "profiles" or "customers". Keep "persona" only where it names the thing being rejected. |
| `index.html` | **14 FAQ questions** on the homepage. Long FAQ walls read as pre-empting objections rather than answering them. | 🟡 | Keep the 6 that a first-time visitor asks. Move the rest to a `/faq` page. |
| `use-cases/index.html` | Thin hub. 18K, one H2, three cards and a CTA. It exists to route to three pages rather than to say anything. | 🟡 | Either give it a real argument, or drop it and link the three pages directly from the nav. |
| `use-cases/` (3 deep pages) | `compare`, `shopify` and `supplement-brands` are 30–33K each and overlap heavily. "Deterministic" appears 9× on supplement-brands, 4× on compare, 4× on shopify. Two of the three lead on "not a decision tree". | 🟡 | They serve different search intents so keep all three, but each needs one argument the others do not make. See §3. |
| `index.html` | 109K file size. **Not a content problem** — visible copy is only 1,864 words. The weight is inlined CSS and SVG. | 🟢 | Leave the architecture alone. If Lighthouse suffers, extract the shared stylesheet; do not cut sections. |
| `sample-report.html` | `140,000+` data points tile. Actual figure is 146,740, so the claim rounds down and `PRODUCT_FACTS` explicitly lists `140,000+` as a safe phrasing. | 🟢 | No action. Correct as written. |

---

## 3. Information architecture

### Current

```
/                          homepage, 11 sections, 1,864 words
/try                       live quiz embed          ← proof
/sample-report             3-persona report replica ← proof
/product-example           single product page
/use-cases/                thin hub
  /compare                 vs tag-based tools
  /shopify                 Shopify angle
  /supplement-brands       the science angle
/privacy  /terms           legal
_marquee-preview*.html     orphans, live on prod
```

### Assessment

**The homepage is not doing too much.** 1,864 words across 11 sections is a normal B2B homepage. The 109K is inlining, not bloat. Do not break sections into pages to solve a problem that is really a build-tooling question.

**The use-cases split is half earning its keep.** The three deep pages target genuinely different searches — comparison shopping, platform fit, technical diligence — which is worth having. But they were written from the same source material and repeat the same three arguments. The hub page above them adds a click without adding an idea.

### Proposed

Two structural changes, both small:

```
/                          unchanged
/try                       unchanged  ← the one CTA target
/sample-report             unchanged
/faq                       NEW: the 8 questions pulled off the homepage
/use-cases/                DROP the hub, link the three from nav directly
  /compare                 own argument: honest feature comparison
  /shopify                 own argument: integration and time-to-live
  /supplement-brands       own argument: the science and safety layer
/privacy  /terms           unchanged
                           _marquee-preview* DELETED
```

Reasoning: removing the hub takes a click out of the path to three pages that already do the persuading. A `/faq` page gives the long tail somewhere to live and gives the homepage its focus back.

---

## 4. Positioning readiness

**The goal:** leader in personalized quizzes as a category, supplements as the first vertical.

**What already works.** The roadmap section is a real asset and does more than most sites manage. It states Health LIVE, Beauty Q4 2026, Food Q2 2027, Fashion under exploration, and closes with "Your vertical? Talk to us about your catalog." That frames supplements as a starting point rather than the whole business, and it does so without claiming anything untrue.

**What traps us as a supplement tool.** Not the copy. The architecture.

| Blocker | Why it blocks |
|---|---|
| No vertical namespace in the URL structure | `use-cases/supplement-brands` is a page, not an instance of a pattern. Adding beauty means inventing a new URL convention or bolting on a sibling. |
| `/sample-report` is hardcoded to supplements | The strongest proof asset only proves the supplement case. A beauty prospect sees vitamins and infers the product is not for them. |
| Nav says nothing about verticals | Nothing signals that a category exists above supplements. |
| Science section is nutrition-specific | "Nutrient-gap math", "upper-limit gating" are the differentiators today and category-specific by nature. |

**What it would take.** Roughly, in dependency order:

1. **Namespace the verticals.** Move to `/for/supplements`, `/for/beauty`. Turns the vertical page into a template. Redirect the old URL. Half a day including redirects.
2. **Parameterise the sample report.** The page already renders from a `SAMPLE_CUSTOMERS` constant, so the hard part is done. It needs a second dataset and a vertical switch, not a rewrite. Blocked on having a beauty catalogue and scoring layer, so this follows the product, not the site.
3. **Split the science section into two layers.** A category-neutral layer (deterministic scoring, every SKU scored, auditable reasons, safety gating) and a vertical layer (nutrient-gap math, RDIs, upper limits). Today they are interleaved. Separating them means a new vertical swaps the second layer only.

Do 1 and 3 before there is a second vertical. Both are cheap now and expensive later.

---

## 5. Quick wins

Ranked. All under 30 minutes.

1. **Fix the `1g` dose on `use-cases/shopify.html`.** Regulatory, and the only survivor of a sweep that cleared every other page. 2 min.
2. **Resolve "20+ user signals".** Swap to the verified "20+ safety checks" or get the row added. Currently the only number on the site that fails the `PRODUCT_FACTS` rule. 5 min for the swap.
3. **Delete the two `_marquee-preview` files.** Unlinked, noindexed, but live on the production domain. 2 min.
4. **Unify the CTA label.** One primary verb sitewide. Mechanical find-and-replace once the verb is chosen. 20 min.
5. **De-"persona" the homepage copy.** 15 uses of the word the positioning rejects. 15 min.

---

## 6. Bigger bets

| Bet | Effort | Why |
|---|---|---|
| **Move the "Same catalog. Three different plans." section above the fold-adjacent area** | 1–2 h | It is the most persuasive thing on the site and currently sits fourth. One catalogue producing three divergent outputs is the argument; it should arrive before the feature list. |
| **Split the science section into category-neutral and vertical layers** | Half a day | Prerequisite for the second vertical. Cheap now, expensive after a beauty page exists. |
| **Namespace verticals under `/for/<vertical>`** | Half a day inc. redirects | Same reasoning. Do it while there is one vertical to migrate. |
| **A `/faq` page and a leaner homepage FAQ** | 2 h | Homepage focus, plus the long tail gets somewhere to rank. |
| **Extract shared CSS to one stylesheet** | Half a day | 12 pages each inline a near-identical `:root` and component set. Fixes the 109K weight, and means a design change stops being a 12-file edit. |

---

## 7. Explicitly not recommended

**A logo wall or any social proof.** There are no customers. Anything here would be invented, and `PRODUCT_FACTS` rules it out. **What I would put in that slot instead:** the live output strip. Take the three-persona section, move it up, and let it run as the proof band — same catalogue, three different plans, real algorithm output. Proof of substance rather than proof of adoption. A prospect who sees the engine work does not need to be told someone else bought it.

**Breaking the homepage into multiple pages.** The 109K looks alarming but the page is 1,864 words. Splitting would add navigation cost to solve a build problem.

**Founder story, "why I built this", or any first-person register.** Company voice throughout. It reads as smaller, not more human.

**Animation beyond what exists.** The hero already has a choreographed sequence that earns its place by showing the mechanism: goals tick, then the plan resolves. More motion elsewhere would be decoration. The one interactive element I would add instead is a **vertical switcher on the sample report** — click Beauty, watch the same engine produce a different report. That earns its complexity because it demonstrates the category claim rather than asserting it. It is blocked on having a second vertical, so it is a 2027 item.

**Rewriting the three use-cases pages from scratch.** They overlap, but they target real and distinct search intent. Give each one argument the others do not make; do not consolidate.

**Chasing the last 2px of header-height asymmetry in the split cards.** Real, measured, and invisible to everyone but us.

---

## Open items requiring another lane

- **"20+ user signals"** needs either a verified `PRODUCT_FACTS` row from Health Algorithm, or the swap to "20+ safety checks".
- **Comparison-table claims decay.** Rows 3–5 on `/use-cases/compare` are true because no competitor documents nutrient-gap math, interaction checks or upper-limit gating. If one ships a safety layer, the table becomes misleading. Worth a recheck each quarter.
