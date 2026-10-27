# Pricing, Retention and Go-to-Market for a Solo-Developer Canvas/Note-Taking SaaS (NoteMap / ScriptumOS)

Research date: 2026-09-29. Where a source is older, its date is flagged inline. Several "2026 statistics" pages found in search are vendor/SEO aggregators with unclear methodology; they are flagged as such and should be treated as directional only.

## 1. Benchmarks: free-to-paid conversion, churn by segment, annual vs monthly mix

### Takeaway
A good self-serve freemium product converts 3-5% of signups to paid (6-8% is great), while free trials convert 8-12% (15-25% great); on mobile, hard paywalls convert ~5x better than freemium at Day 35 but 1-year retention is nearly identical. Low-ARPA (<$10/mo) B2C/prosumer SaaS runs ~8-9% monthly MRR churn, so pushing users onto annual plans is the single most documented churn lever.

### Cited Findings
**Free-to-paid conversion**
- Freemium self-serve (Canva, Trello, Typeform-type): 3-5% = good, 6-8% = great; freemium with sales-assist: 5-7% good, 10-15% great; free trial: 8-12% good, 15-25% great. Conversion defined as % of new accounts paying within first 6 months. Survey of 1,000+ products (with Kyle Poyar/OpenView and Pendo). Published Aug 1, 2023. — [Lenny's Newsletter](https://www.lennysnewsletter.com/p/what-is-a-good-free-to-paid-conversion)
- Same study: visitor-to-signup is ~9% for freemium vs ~5% for free-trial products; about one-third of freemium companies convert 2.5-5% (the largest cohort). — [Lenny's Newsletter](https://www.lennysnewsletter.com/p/what-is-a-good-free-to-paid-conversion)
- RevenueCat State of Subscription Apps 2026 (115,000+ apps, $16B revenue): hard paywall Day-35 download-to-paid conversion 10.7% vs 2.1% for freemium (~5x); revenue per install at Day 60 $3.09 (hard paywall) vs $0.38 (freemium); but 1-year retention 27% (hard paywall) vs 28% (freemium) — statistically negligible. — [RevenueCat blog, 2026](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)
- RevenueCat 2026: trials of 17-32 days convert 42.5% vs 25.5% for trials under 4 days; 55.4% of 3-day-trial cancellations happen on Day 0. — [RevenueCat blog, 2026](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)
- RevenueCat 2026: productivity apps use monthly billing for 77% of subscriptions (vs gaming 82% weekly, health & fitness 68% annual). — [RevenueCat State of Subscription Apps 2026](https://www.revenuecat.com/state-of-subscription-apps)
- RevenueCat 2026: AI-powered apps earn 41% higher Year-1 LTV ($30.16 vs $21.37) but have 36% worse 12-month retention ("churn 30% faster" in summary copy). — [RevenueCat blog, 2026](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026); [RevenueCat report page](https://www.revenuecat.com/state-of-subscription-apps)

**Churn by segment**
- ChartMogul: companies with ARPA $0-10/month have 8.9% monthly gross MRR churn; ARPA <$25 has median gross MRR churn 8.2% and net MRR churn 6%. Top-quartile net retention for ARPA <$10 is only 65.1%, and only 2.7% of ARPA <$10 businesses exceed 100% NRR (ChartMogul data from 2023 reports). — [ChartMogul churn benchmarks](https://chartmogul.com/blog/churn-basics-and-benchmarks/); [ChartMogul SaaS Retention Report 2023](https://chartmogul.com/reports/saas-retention-report/)
- ChartMogul attributes the higher churn in low-ARPA B2C to "knee-jerk buying by individual customers and fewer upselling and cross-selling opportunities." — [ChartMogul](https://chartmogul.com/blog/churn-basics-and-benchmarks/)
- RevenueCat 2026 (mobile): ~35% of all annual-plan cancellations happen in the first month; overall Year-1 annual churn ~72% (worse than ~56% in 2025). Billing failures cause 14% of cancellations on the App Store vs 31% on Google Play. — [RevenueCat blog, 2026](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)

**Annual vs monthly**
- ProfitWell (analysis of ~3,000 SaaS companies): annual contracts show ~30% better retention than monthly; quarterly ~20% better. Patrick Campbell: "Annual contracts are essentially interest-free loans from your customers." (ProfitWell data, pre-Paddle acquisition, undated ~2019-2021). — [ProfitWell/Paddle](https://www.profitwell.com/recur/all/why-annual-plans-are-crucial-for-reducing-your-churn)
- Claims that annual billing cuts involuntary churn "up to 95%" and annual customers have NPS 19 points higher appear in search summaries attributed to ProfitWell; I could not verify these at the primary source. — [search result summary of ProfitWell/Baremetrics](https://baremetrics.com/blog/annual-vs-monthly-pricing-better-retention)
- Making annual the default plan toggle reportedly keeps 40-60% of customers on annual vs under 20% when monthly is the default (secondary benchmark site, methodology unclear). — [Unlock SaaS benchmarks](https://unlocksaas.com/benchmarks/annual-vs-monthly-discount)

### Inferences
- A NoteMap Pro at ~$8/month sits squarely in ChartMogul's highest-churn ARPA band; expect ~8-9%/month churn on monthly plans (average customer life ~11-12 months) unless annual mix is pushed high.
- The RevenueCat hard-paywall vs freemium result suggests the free tier mainly affects *top-of-funnel volume*, not long-run retention — so NoteMap should choose free vs trial based on acquisition channel, not retention fears.
- Given the AI-churn finding, any AI features should be positioned as an add-on/usage tier rather than the core reason to pay.

### Gaps
- No note-app-specific public free-to-paid numbers (Notion, Milanote, Miro do not publish these).
- Paddle/ProfitWell's latest (2025-2026) B2C vs B2B churn split was not found at a primary URL; ChartMogul's segment numbers are from 2023.
- Could not verify the Baremetrics primary numbers on annual vs monthly churn.

## 2. Freemium gates that work for note/canvas apps (competitor evidence)

### Takeaway
Canvas/visual competitors overwhelmingly gate on *quantity of content* (items/cards/blocks) rather than boards, and document-first/local apps gate on *sync* or *services*. NoteMap's "3 boards" gate mirrors Miro, but Miro's gate is team-oriented; a solo user can cram everything into 3 boards, so an item/card cap (Milanote 100, Kinopio 100) or sync gate is a stronger forcing function for individuals.

### Cited Findings
- **Milanote**: Free forever with 100 notes/images/links, 10 file uploads, unlimited shared boards. Individual $9.99/mo annual or $12.50/mo monthly (~20% annual discount). Team $49/mo (annual) for up to 50 people. No student discount listed. — [Milanote plans](https://milanote.com/plans/)
- **Kinopio** (solo indie canvas): all features free up to 100 cards and 5 MB upload limit; pricing is grandfathered, accidental renewals refunded, no dark patterns; offers student/financial-need discounts. — [Kinopio Help](https://kinopio.club/help/how-much-does-kinopio-cost/)
- **Miro**: free plan allows 3 editable boards (unlimited boards can be created but only the 3 most recent stay editable/active) with unlimited team members. — [Miro Help Center: Free Plan](https://help.miro.com/hc/en-us/articles/360017730373-Free-Plan); [Miro community thread](https://community.miro.com/ask-the-community-45/free-plan-won-t-let-me-create-a-4th-board-i-thought-boards-were-unlimited-28959)
- **Heptabase** (visual whiteboard notes): no free plan. Pro $8.99/mo (unlimited notes/whiteboards, 100 AI credits/mo), Premium $17.99/mo (1,800 AI credits, GPT/Claude/Gemini, unlimited PDF parsing), Premium+ $53.99/mo (8,100 credits); ~25% yearly savings. — [Heptabase pricing](https://heptabase.com/pricing)
- **Obsidian**: core app free and unlimited (free for commercial use since Feb 2025); revenue from Sync ($4/mo annual, $5/mo monthly), Publish ($8/mo annual, $10 monthly per site), Catalyst one-time $25, optional Commercial license $50/user/yr. Students, faculty and nonprofit staff get 40% off Sync/Publish. — [Obsidian pricing](https://obsidian.md/pricing); [eesel summary of commercial-license change](https://www.eesel.ai/blog/obsidian-pricing)
- **Craft**: free plan limited by blocks (reported as 1,000 blocks; another source says 1,500); Pro ~$5/mo or $48/yr. — [Craft pricing](https://www.craft.do/pricing); [ProPicked summary](https://propicked.com/business/craft-docs/pricing)
- **Bear**: free version blocks iCloud sync across devices; Bear Pro reported at about €16/year for sync, themes, export options (secondary source). — [SelectHub comparison](https://www.selecthub.com/note-taking-software/bear-app-vs-craft-docs/)
- **Heptabase AI tiering**: price ladder is driven by AI credit volume, i.e. AI is a usage-metered upsell layer above a flat core price. — [Heptabase pricing](https://heptabase.com/pricing)

### Inferences
- Gate candidates ranked for NoteMap (inference from above): (1) cross-device sync / native macOS app access (Bear, Obsidian model — high willingness to pay among Mac users and cheap to explain); (2) card count (Milanote/Kinopio, ~100 cards — forces the upgrade at the "I'm invested" moment); (3) AI credits as a second tier (Heptabase); (4) publish/share-as-website (Obsidian Publish). Board caps work best when paired with collaboration (Miro) — less effective for solo users.
- Export should NOT be gated: it underpins trust (see Q6) and PKM users are sensitive to lock-in.
- Version history is a plausible Pro gate (Obsidian bundles it with Sync).

### Gaps
- Notion's current free-tier limits and Things' pricing not verified in this pass.
- No published data comparing conversion rates across gate types for note apps.

## 3. Lifetime deals, one-time purchase vs subscription, subscription fatigue, Setapp

### Takeaway
Marketplace LTDs (AppSumo) trade long-term revenue for a cash spike and a high-support, deal-seeking cohort; a self-sold lifetime plan priced at ~3x annual (Kinopio) is a safer way to capture subscription-averse Mac/PKM users. Setapp gives 70% of a member's fee split by usage — a supplemental, not primary, channel.

### Cited Findings
- **AppSumo terms (primary)**: AppSumo says partners get 95% (minus 5% processing) of revenue from new buyers the partner brings, and 70% goes to AppSumo on sales to AppSumo's existing customers (i.e. vendor keeps ~30%). — [AppSumo blog: Does AppSumo really take 70%?](https://appsumo.com/blog/appsumo-myths); [AppSumo revenue share breakdown](https://appsumo.com/blog/breaking-down-appsumo-revenue-share)
- Secondary sources describe AppSumo Marketplace ~70/30 (AppSumo/vendor) for early codes, improving toward 50/50, and Select plan ~30/70; exact terms are negotiated. — [LaunchBuff](https://launchbuff.com/blog/how-to-get-featured-on-appsumo)
- A $59 AppSumo LTD reportedly nets the vendor ~$17.70; AppSumo refund rates cited at ~16-17%; LTD buyers described as deal-driven with more support tickets and feature requests; "~40% of AppSumo LTDs fail within three years" (competitor/blog source, methodology unclear — treat as anecdotal). — [Autoposting.ai AppSumo review 2026](https://autoposting.ai/blog/appsumo-review)
- **Kinopio's self-sold lifetime plan** (Dec 2025 post): prices 2022 $6/mo, $60/yr, $200 lifetime; 2025 $8/mo, $80/yr, $250 lifetime. Lifetime priced at ~3x yearly because that was the average churn length; aimed to be <10% of new customers; subscription = "low-variability/high-tail income," lifetime = "high-variability/short-tail," treated as supplementary. Added because customers asked for alternatives to subscriptions. — [pketh.org: Why Sell Lifetime Plans](https://pketh.org/lifetime-plans.html)
- **Plottr** (vertical, novelists): offers subscriptions (from ~$15/mo reported) and a lifetime option reported at $150-$199 (sources differ). — [AuthorFlows Plottr pricing](https://www.authorflows.com/blogs/plottr-pricing); [Automateed](https://www.automateed.com/plottr-pricing)
- **Subscription fatigue — Ulysses case (2017)**: Ulysses' switch to subscription triggered a "carpet-bombing of 1-star reviews" on the iOS App Store, though the situation improved afterward; the developers argued one-time App Store sales only reward acquiring new users and paid upgrades create spiky revenue. Ulysses now $5.99/mo or $49.99/yr. — [TidBITS, Aug 2017](https://tidbits.com/2017/08/10/ulysses-writing-app-moves-to-subscription-pricing/); [Max Seelemann, Building Ulysses (Medium)](https://medium.com/building-ulysses/why-were-switching-ulysses-to-subscription-47f80b07a9cd)
- **Setapp economics (official docs)**: Setapp shares 70% of each member's fee among the apps that member uses, weighted by usage and a price-tier multiplier based on the app's outside price; Partners who refer a user get an additional guaranteed 20% of that user's fee (up to 90% total). For single-app sales via Setapp, Setapp takes 15% on subscriptions and 25% on one-time sales. Payouts monthly. — [Setapp docs: Distributing revenue](https://docs.setapp.com/docs/distributing-revenue); [Setapp Membership revenue](https://docs.setapp.com/docs/setapp-membership-revenue); [Monetizing your app](https://docs.setapp.com/docs/monetizing-an-application-with-setapp)
- Setapp case studies: average Setapp client lifetime value cited as 24 months; one developer said Setapp is ~1/5 of their total revenue alongside Mac App Store and direct sales. No public $ figures. — [Setapp case study: Downie](https://setapp.com/developers/downie); [Setapp developers](https://setapp.com/developers)

### Inferences
- For NoteMap, a self-sold lifetime tier at ~3x annual (e.g. ~$200-250 if annual is ~$70-80) captures subscription-averse Mac users without AppSumo's 70% cut and deal-hunter support load. Cap it or make it time-limited to keep it <10% of sales.
- Because NoteMap has ongoing cloud costs (Supabase sync), any lifetime deal should cover a defined sync allowance, not unlimited storage forever.
- Setapp fits the native macOS app as an awareness/supplement channel; its usage-based split rewards daily-use apps, which a note canvas could be.

### Gaps
- No verified AppSumo seller postmortem for a note/canvas app specifically.
- No published Setapp payout figures per active user.
- No hard survey data on PKM-user subscription fatigue (only anecdotes/review backlash).

## 4. Niche/vertical pricing examples

### Takeaway
Vertical visual-planning tools (Plottr for novelists, LegendKeeper for TTRPG worldbuilders) charge equal to or above horizontal tools ($9-15/mo) with no or minimal free tier, and grow via passionate community (Patreon, author podcasts). Heptabase positioned for "learning complex topics" and reached seven-figure ARR while profitable.

### Cited Findings
- **LegendKeeper** (worldbuilding/TTRPG canvas + wiki + maps): $9/mo or $90/yr, 14-day free trial, plus a Commercial tier; grew from side project over 3 years 4 months supported by Patreon subscribers; "thousands of happy users and established MRR" (no exact figure). — [LegendKeeper pricing](https://www.legendkeeper.com/pricing/); [Adam Waselnuk: joining LegendKeeper](https://www.adamwaselnuk.com/articles/joining-legendkeeper)
- **Plottr** (visual outlining for novelists): built by a software engineer/author; monthly from ~$15 and lifetime ~$150-199; marketed through indie-author media (Indie Author Magazine, ALLi podcast). — [AuthorFlows](https://www.authorflows.com/blogs/plottr-pricing); [ALLi podcast](https://selfpublishingadvice.org/podcast-using-plottr/); [Indie Author Magazine](https://indieauthormagazine.com/technology-plottr/)
- **Heptabase** (visual notes for learners/researchers): Starter Story reports ~$200K/month (~$2.4M ARR) with ~6 employees and profitable; Latka estimates $1.2M revenue in 2024 with 30,000 paid users — the two sources conflict (both are third-party estimates). Raised $1.7M seed (YC, Kleiner, HOF) in 2022 but states expenses have been revenue-funded. — [Starter Story](https://www.starterstory.com/heptabase-breakdown); contradicted by [Latka](https://getlatka.com/companies/heptabase.com); [Meet Global interview](https://meet-global.bnext.com.tw/articles/view/47705)
- **Milanote** positions as "the notes app for creative work" and builds a large template library by profession (creative briefs, agency workflows, website planning, marketing plans). — [Milanote templates](https://milanote.com/templates)

### Inferences
- Going vertical lets NoteMap drop the free tier to a trial (LegendKeeper model) and charge $9-15/mo, because the buyer has a specific job (e.g. plotting a novel, a legal case map, a research literature map). The vertical also gives an obvious community and media channel.
- Candidate verticals whose incumbents validate price: fiction writers (Plottr), TTRPG/worldbuilding (LegendKeeper), researchers/students (Heptabase).

### Gaps
- No public before/after data showing a specific app's conversion change after going niche.
- Did not find Dovetail-type or legal canvas indie pricing data in this pass.

## 5. Go-to-market for a solo dev: getting to first $1k-$10k MRR

### Takeaway
The best-documented comparable (Heptabase) grew through direct outreach in niche Discord/Telegram communities, word-of-mouth, and later an affiliate program (~10% of revenue). Product Hunt drives spiky traffic but few paying customers; Reddit works only with sustained genuine participation because most subreddits restrict self-promotion; programmatic template pages (Milanote) are a long-term SEO asset.

### Cited Findings
- **Heptabase early GTM**: founder "actively reached out to individuals discussing related topics such as 'visual,' 'whiteboard,' and 'mindmap'" in Discord and Telegram groups; growth primarily by word of mouth; affiliate program launched late 2023 at creators' request now ~10% of revenue; no paid ads mentioned. — [Starter Story](https://www.starterstory.com/heptabase-breakdown)
- Heptabase early phase: 1,000+ early-bird users and "40x revenue growth" in 3 months, then stable profitability. — [Meet Global/Bnext interview](https://meet-global.bnext.com.tw/articles/view/47705)
- **Habit Pixel** (solo dev habit app): launched May 2025 on App Store/Google Play, announced on X and Reddit May 10-17; ~1,000 active users and first sale by May 19; $1K MRR after 8 months. — [Indie Hackers](https://www.indiehackers.com/post/from-0-to-1k-mrr-in-8-months-bootstrapping-habit-pixel-as-a-solo-dev-684b6c056d)
- **Product Hunt**: successful launches drive 5,000-50,000 visitors in 48 hours but signup rates of 1-3% are typical; one cited case: 340 upvotes, 89 signups, 3 paying customers vs 67 paying customers from sustained Indie Hackers engagement; "89% of founders surveyed would not launch on PH again" (aggregator stats, methodology unclear). — [Shno PH statistics 2026](https://www.shno.co/marketing-statistics/product-hunt-launch-statistics); [Awesome Directories](https://awesome-directories.com/blog/indie-hackers-launch-strategy-guide-2025/)
- **Reddit rules**: Reddit retired the official 10% self-promo rule in 2016 but moderators still apply a 9:1 ratio mental model; a 2026 study of 49 founder-targeted subreddits found 61% ban self-promotion or allow it only under 9:1, 39% ban it outright. Founder-friendly: r/SideProject, r/IndieBiz, r/startups weekly threads, r/AlphaAndBetaUsers. — [OneUp Today study](https://oneup.today/blogs/reddit-selfpromo-rules-study-2026); [Redship](https://redship.io/blog/reddit-self-promotion-rules)
- **Programmatic template SEO**: Milanote hosts profession-specific template pages (e.g. /templates/creative-briefs/seo-brief, /templates/agencies, /templates/marketing/marketing-plan); its traffic is driven by searches like mood/vision board, relationship mapping, website planning (traffic estimate ~163K monthly visits, third-party estimate). — [Milanote templates](https://milanote.com/templates); [InstantDomainSearch traffic estimate](https://instantdomainsearch.com/directory/milanote.com)
- **Setapp Partner referrals** as affiliate-like channel: developers earn ~$2 extra per referred Setapp user (case study). — [Setapp: Downie case study](https://setapp.com/developers/downie)

### Inferences
- Recommended sequence (inference): pick one vertical → join 5-7 communities where that vertical asks "how do I organize X" → personally onboard first 20-50 users → ship templates for that vertical as SEO landing pages → affiliate program for creators (YouTube PKM/writing channels) once retention is proven → Product Hunt/HN as one-off spikes, not the strategy.
- For native macOS, Setapp and Mac App Store are discovery channels; direct Stripe web sales keep margin.

### Gaps
- No verified Mac App Store featuring impact data found.
- No verified TikTok/YouTube creator-partnership conversion numbers for note apps (beyond Heptabase's 10% affiliate share).
- No specific note/canvas indie IH interview with a first-$1k MRR breakdown was found.

## 6. Retention tactics specific to note apps

### Takeaway
Evidence from indie note apps favors trust-building (easy cancel, grandfathered pricing, open export, refunds) and community (Discord) over lock-in; Obsidian's business is built on files you own plus paid convenience services. Hard evidence on streaks/digests for note apps was not found.

### Cited Findings
- Kinopio: subscriptions easily cancelled, pricing grandfathered, receipts emailed, accidental renewals refunded, no cancellation fees or dark patterns; student and financial-need discounts. Founder's philosophy: "a happy customer is better than an unhappy one." — [Kinopio Help](https://kinopio.club/help/how-much-does-kinopio-cost/); [pketh.org](https://pketh.org/lifetime-plans.html)
- Obsidian: local-first markdown files, free core; monetizes sync/publish convenience rather than data lock-in. — [Obsidian pricing](https://obsidian.md/pricing); [Wikipedia: Obsidian](https://en.wikipedia.org/wiki/Obsidian_(software))
- Heptabase uses a community Discord server and in-app user communication as core channels. — [Starter Story](https://www.starterstory.com/heptabase-breakdown)
- LegendKeeper was sustained by Patreon community for its early years. — [Adam Waselnuk](https://www.adamwaselnuk.com/articles/joining-legendkeeper)
- Involuntary churn from billing failures is a meaningful share of cancellations (14% on App Store in 2026), so dunning/card-update flows matter. — [RevenueCat 2026](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)

### Inferences
- For NoteMap: offer full export (JSON + Markdown/PNG) as a trust feature; retention should come from accumulated structure (boards/links) plus sync convenience, not export gating.
- Enable Stripe Smart Retries/dunning emails and annual default to attack the involuntary-churn slice.
- Onboarding templates per vertical double as SEO pages and activation aids.

### Gaps
- No published data on weekly email digests, streaks or integrations reducing churn in note apps specifically.

## 7. Payment/pricing mechanics: PPP, student discounts, annual discount, trial vs freemium, reverse trial

### Takeaway
"Two months free" (~17%) is the classic annual discount, but actual published practice averages 20-27%; competitors sit at 20-25% (Milanote ~20%, Heptabase 25%, Obsidian 20%). Reverse trials reportedly lift freemium conversion 10-40%. Student discounts of ~40% (Obsidian) are common in PKM. PPP evidence is mostly from vendors selling PPP tools.

### Cited Findings
- Annual discount: industry "two months free" ≈16.7%; one study of pricing pages found average 27% / median 25% off for yearly; another across 41 tools found average 24% / median 20%, with 15 in the 18-22% band. — [SuffDigital data study](https://www.suffdigital.com/resources/data-studies/saas-annual-billing-discount); [SaaS Dealer (41 tools)](https://www.saasdealer.com/blog/annual-billing-discount-measured)
- Competitor annual discounts: Milanote $12.50 → $9.99 (~20%) [Milanote](https://milanote.com/plans/); Obsidian Sync $5 → $4 (20%) [Obsidian](https://obsidian.md/pricing); Heptabase "25% savings" yearly [Heptabase](https://heptabase.com/pricing); Kinopio $8/mo vs $80/yr (~17%) [pketh.org](https://pketh.org/lifetime-plans.html); LegendKeeper $9/mo vs $90/yr (~17%) [LegendKeeper](https://www.legendkeeper.com/pricing/).
- Student/education: Obsidian 40% off Sync/Publish for students, faculty, nonprofit. — [Obsidian pricing](https://obsidian.md/pricing); Kinopio offers student/financial-need discounts — [Kinopio Help](https://kinopio.club/help/how-much-does-kinopio-cost/)
- Reverse trial: Elena Verna reports reverse trials (full premium access for a limited time, then downgrade to free) increased freemium-to-premium conversion by 10-40% in her work. — [Amplitude blog by Elena Verna](https://amplitude.com/blog/reverse-trial); [Elena Verna: Reverse Trials Examples](https://www.elenaverna.com/p/reverse-trials-examples)
- Trial vs freemium: see Q1 — trials convert ~8-25% vs freemium 3-8% (Lenny, 2023); hard paywall 10.7% vs freemium 2.1% on mobile (RevenueCat 2026), with similar 1-year retention.
- PPP: vendor-reported 20-70% sales lift from lower-income regions (ParityDeals claim), a LATAM case with +65% conversions after 35% discounts, and a creator with 30% of revenue from parity-priced sales. These are from PPP tool vendors/marketing blogs — treat as directional. — [Fungies](https://fungies.io/ppp-pricing-saas-boost-global-revenue-2026); [EvenDeals](https://www.evendeals.com/blog/does-parity-pricing-increase-sales)

### Inferences
- For NoteMap: annual = 10x monthly (two months free) or ~20% off, displayed as default; a 14-day reverse trial of Pro that drops to a free tier (instead of pure freemium) is well-supported; 40% student discount matches PKM norms; PPP via Stripe coupons by country is low-effort but evidence is weak — test it.

### Gaps
- No independent (non-vendor) controlled data on PPP outcomes for indie SaaS.
- No note-app-specific reverse-trial case study found.
