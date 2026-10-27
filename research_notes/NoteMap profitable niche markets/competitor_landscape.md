# Competitive Landscape: Visual Canvas / Spatial Note-Taking Apps (as of Sept 2026)

Research notes for NoteMap/ScriptumOS (infinite canvas of rich-text cards + arrows, boards; Next.js/Supabase web + native macOS; free = 3 boards, Pro = unlimited).

Method caveat: Reddit pages could not be fetched directly (fetch tool blocked old.reddit.com, and `site:reddit.com` searches returned nothing useful), so user sentiment comes from Product Hunt, Hacker News, the Obsidian forum, Apple Community, and review aggregators that quote Reddit. Revenue figures from GetLatka, Fueler and similar sites are **third-party estimates, not disclosed numbers**, and are marked as such.

---

## Q1. Competitor map: pricing, size, audience, praise, complaints

### Takeaway
The category splits into (a) team whiteboards (Miro, FigJam, Whimsical, Canva, Excalidraw, tldraw), which are huge, cheap or free per seat, and dominated by incumbents; (b) personal "visual knowledge" canvases (Heptabase, Milanote, Scrintal, Kosmik, Muse, Kinopio, Obsidian Canvas, AFFiNE), which are small, mostly bootstrapped businesses making roughly $0.1M–$3M ARR at $8–$15/month; and (c) AI-first capture/knowledge tools (Tana, Mem, Recall, Fabric, mymind, Flowith) that increasingly add canvas as a feature. The best-run personal-canvas businesses (Heptabase and Milanote at an estimated $1–3M ARR, and Kinopio as a solo-founder business) serve a clear audience: researchers and students, creatives, or indie "tools for thought" fans.

### Cited Findings

**Personal / knowledge canvases (NoteMap's direct set)**

- **Heptabase** (see Q6 for the deep dive). Pro is $8.99/mo billed annually ($11.99 monthly), Premium is $17.99/mo annually ($23.99 monthly), and Premium+ is $53.99/mo annually ($71.99 monthly). There is no free plan, only a 7-day trial. — [Heptabase pricing](https://heptabase.com/pricing); [ToolChase](https://toolchase.com/tool/heptabase/); [Heptabase wiki changelog/newsletter](https://wiki.heptabase.com/newsletters/2025-12-10)
- **Milanote** has a free plan capped at "100 notes, images or links" and "10 file uploads", with unlimited shared boards and no time limit. Professional is $9.99/mo billed annually or $12.50 monthly. Team is $49/mo billed annually. — [Milanote plans](https://milanote.com/plans/). (Some aggregators list $12.50 as the annual price. The official page shows $9.99 annual.)
  - Size: bootstrapped (Melbourne), with an estimated $2.8M ARR in 2024 (up from $1.7M in 2023), 35,000 customers, 23 employees and roughly $80 ACV. These are **GetLatka estimates**. — [GetLatka](https://getlatka.com/companies/milanote). Milanote took a $780k seed in 2017 as the "Evernote for creatives". — [TechCrunch 2017](https://techcrunch.com/2017/04/18/milanote-bags-780k-seed-to-tool-up-its-evernote-for-creatives/) (this conflicts with GetLatka's "$0 funding").
  - Complaint: on r/graphic_design, "Milanote is nice but the billing is very expensive" (quoted via a competitor blog). — [refern.app](https://www.refern.app/blog/milanote-too-expensive-one-time-alternative). The free-plan cap is widely described as too restrictive. — [Storyflow](https://storyflow.so/blog/best-milanote-alternatives-2026)
- **Scrintal** (Stockholm) sells freemium plans from about $5/mo. — [Capterra](https://www.capterra.com/p/216983/Scrintal/). Its pricing page now promotes **Gobu.ai**, "our new AI research assistant". — [Scrintal pricing](https://scrintal.com/pricing). Gobu is "built on Scrintal's canvas and writing tools", targets students and researchers reading academic PDFs, and "your entire Scrintal library is already synced" into it. — [Scrintal GitBook](https://scrintal.gitbook.io/scrintal-support-docs/what-is-gobu); [gobu.ai](https://gobu.ai/). Scrintal closed its Slack community on May 30, 2024 and said it had "no plans to shut down". — [Productive Matters](https://productivematters.substack.com/p/scrintal-shuts-down-community)
- **Kosmik** (Paris) raised a €3.3M seed (Dec 2023) led by Creandum, with Alven, Kima, Betaworks, Amjad Masad and others. — [EU-Startups](https://www.eu-startups.com/2023/12/paris-based-kosmik-raises-e3-3-million-to-overhaul-the-traditional-files-and-folders-desktop/). Its current pricing page shows Pro at $11.99/mo annually or $14.99 monthly with a 1-week trial, and an Ambassador tier at $16.99/$20.99 ("coming soon"). — [Kosmik pricing](https://www.kosmik.app/pricing). Aggregators still describe a free tier with 50 AI credits per month, which is **conflicting and possibly outdated**. — [Kosmik blog](https://www.kosmik.app/blog/scrintal-alternatives)
  - Positioning shift: the homepage title is now "Create Moodboard In Seconds With AI". It started as an "overhaul the desktop" canvas with a built-in browser and PDF reader and is now marketed to designers as an AI moodboard tool. — [kosmik.app](https://www.kosmik.app/); [UX Lift](https://www.uxlift.org/tools/kosmik-create-moodboard-in-seconds-with-ai/)
- **Muse** (iPad/Mac) raised $2M, had 7 employees at peak, and reached about $120k ARR by mid-2022. It was handed to solo developer Adam Wulf in fall 2023, who shipped Muse 3. — [Adam Wiggins retrospective](https://adamwiggins.com/muse-retrospective/). Current pricing could not be verified (see Gaps).
- **Kinopio** (solo developer Pieter "pketh") is free up to 100 cards with a 5MB upload limit, then a subscription, plus a **$200 lifetime plan** priced at "~3× the yearly price because that was the average churn length". — [Kinopio pricing help](https://kinopio.club/help/how-much-does-kinopio-cost/); [Lifetime plan post](https://kinopio.club/blog/posts/lifetime-plan/). Infrastructure costs about $303/mo in total (Netlify $40, Railway $50–60, ToDesktop $60, and others). — [Kinopio architecture & costs](https://kinopio.club/kinopio-architecture-and-costs-JOGXFJ0FEMpS3crbh6U9k). The founder's framing: "~$3000/mo coming in every month is way less anxiety-inducing than making $6,000 in a good month". — [pketh.org](https://pketh.org/)
- **Obsidian Canvas** is free inside Obsidian. Obsidian makes money from Sync ($4/mo annual, its largest line), Publish, the $25 Catalyst tier and the $50/yr commercial license, and became "free for work" on Feb 20, 2025. — [eesel](https://www.eesel.ai/blog/obsidian-pricing); [Obsidian pricing](https://obsidian.md/pricing)
  - Size: about 1.5M active users and "7 full-time employees, ~1 million users per employee" (kepano, 2025). — [kepano on X](https://x.com/kepano/status/1953867671302537474). Revenue is **disputed**: GetLatka estimates about $2M, while a viral April 2026 post claimed $25M. OperatorBook argues the $2–4M band is most defensible and calls $25M unverified. — [OperatorBook](https://www.operatorbook.dev/stories/obsidian-revenue-estimates-2m-to-25m); [BigGo ($25M claim)](https://finance.biggo.com/news/iVboYp0Bga3fZL9MJEv_)
  - Complaint: Canvas lags past roughly 200 nodes or with large text cards, even on i9/RTX 4090 machines. One user: "the canvas feature is so integral to my work that I have to bounce between other apps". The thread (Sept 2024 to Dec 2025) has no official fix. — [Obsidian forum](https://forum.obsidian.md/t/hope-the-official-team-can-optimize-canvas-performance-with-a-summary-of-multiple-test-contents-attached/88023)
- **Scapple** (Literature & Latte, maker of Scrivener) costs $20.99 as a one-time purchase on Mac or Windows ($14.40 education), with no subscription. — [selfpublishing.com](https://selfpublishing.com/scapple-review/); [L&L store](https://www.literatureandlatte.com/store/scapple)
- **Walling** costs $8/mo for Premium (unlimited, OCR) and $8/member/mo for Team (shared walls, permissions). — [Walling pricing](https://walling.app/pricing)
- **Napkin** (the note app, not Napkin AI) costs $6/mo or $50/yr on the App Store. A review flagged no updates for 4 months, "suggesting the app may be abandoned" (unverified). TechCrunch covered it in Sept 2024 as a note app "not about making you more productive". — [App Store](https://apps.apple.com/us/app/napkin-ideas/id6470183297); [TechCrunch](https://techcrunch.com/2024/09/27/napkin-is-a-note-taking-app-that-is-not-about-making-you-more-productive/)
- **AFFiNE** (open source, local-first docs + "edgeless" canvas) has a free cloud tier with 10GB, up to 3 members per workspace and 7-day history. A lifetime "Believer" plan costs $499.99. Self-hosted Team is $10/seat/mo (10+ seats). The editor is MIT-licensed and the self-hosted backend is source-available. — [AFFiNE pricing](https://affine.pro/pricing); [GitHub](https://github.com/toeverything/affine)
- **Logseq whiteboards** were removed from the new DB version ("will hopefully be available as a plugin"). They still work in the Markdown version. — [Logseq docs: db-version-changes](https://github.com/logseq/docs/blob/master/db-version-changes.md)

**AI-first / PKM tools that overlap**

- **Capacities** has a permanent free plan (unlimited notes/objects, 5GB, no AI), Pro at about $9.99/mo, and Believer at about $12.49/mo. — [Capacities pricing](https://capacities.io/pricing); [SpotSaaS](https://www.spotsaas.com/product/capacities/pricing)
- **Tana** raised a $14M Series A (Tola Capital, with Lightspeed and Northzone) for $25M total, and had a waitlist of 160k+ during stealth. — [PR Newswire](https://www.prnewswire.com/news-releases/tana-raises-25m-to-unlock-the-power-of-human-ai-collaboration-302365963.html). Pricing: Pro about $20/mo (meeting agent, MCP) and Max about $80/mo. It has moved toward AI meeting notes. — [Costbench](https://costbench.com/software/note-taking/tana/)
- **Reflect** has a single plan at $10/mo or $100/yr (14-day trial) that includes AI and encryption. — [Costbench](https://costbench.com/software/note-taking/reflect/)
- **Mem** raised $23.5M at a $110M post-money valuation, led by the OpenAI Startup Fund (Nov 2022), with $28.6M total including a16z. — [TechCrunch](https://techcrunch.com/2022/11/10/ai-powered-note-taking-app-mem-raises-23-5m-openai). Mem 2.0 (early 2026) "fixed real speed and stability complaints". — [SolidAITech](https://www.solidaitech.com/2026/07/mem-ai-note-taking-app-vs-mem0-api.html). A critical Medium piece calls it "The $40M Second Brain Failure" (opinion, low reliability). — [Medium](https://medium.com/@theo-james/mem-ai-the-40m-second-brain-failure-burning-the-worlds-money-5f3176a34cbd)
- **Recall** has a free plan, Plus at $10/mo annually ($12 monthly) and Max at $38/mo annually ($48 monthly), and offers "augmented browsing". — [Recall pricing](https://www.recall.it/pricing)
- **mymind** is free up to 100 cards, with paid plans from about $5.99–6.99/mo. It is bootstrapped with "zero outside funding" by choice. — [mymind pricing essay](https://mymind.com/mymind-pricing-why-pay-for-an-app-when-others-are-free); [Futurepedia](https://www.futurepedia.io/tool/mymind)
- **Fabric** ("the workspace that thinks with you") has a generous free plan and paid tiers from about $5–8/mo. Funding was not found. — [Fabric pricing](https://fabric.so/pricing-and-plans-for-individuals)
- **Craft** has a free plan and paid plans from about $5/user/mo. — [Research.com](https://research.com/software/reviews/craft-docs). Craft is a paying tldraw SDK licensee, so its canvas is built on tldraw. — [tldraw Series A post](https://tldraw.dev/blog/announcing-tldraw-series-a)
- **Xmind** (mind maps) has a free tier and Pro from about $4.92/mo. — [SaaSpartout](https://saaspartout.com/marketplace/xmind/)
- **Flowith** is an AI agent on an infinite canvas where "AI conversations become visual nodes you can branch, merge, rearrange". It topped Product Hunt in June 2025 and claims over 1M users. — [eesel review](https://www.eesel.ai/blog/flowith-review)

**Team whiteboards (horizontal incumbents)**

- **Miro** has 90M+ users and 250k organizations, with about $600M revenue per GetLatka/Sacra estimates. Starter is $8/member/mo annually or $10 monthly. — [Sacra](https://sacra.com/c/miro/); [GetLatka](https://getlatka.com/companies/miro). Complaints: boards "become slow and difficult to navigate when filled with many elements", and the AI credit allowance is "capped tightly with no rollover". — [eesel on Miro AI](https://www.eesel.ai/blog/miro-ai); [Capterra](https://www.capterra.com/p/128955/Miro/reviews/)
- **FigJam** Starter is free with 3 collaborative FigJam files and unlimited personal drafts. Paid seats cost about $3–5/editor/mo for a FigJam-only seat, or $12–15 with Figma Professional (sources conflict). — [Costbench](https://costbench.com/software/diagramming/figjam/); [Capterra](https://www.capterra.com/p/265222/FigJam/pricing/)
- **Whimsical** Free allows 50 board objects and 50 doc blocks per month, 7-day history and watermarked exports. Pro is $10/editor/mo and Business $20 (17% annual discount). It is free for students and educators. — [Whimsical pricing](https://whimsical.com/pricing)
- **Canva Whiteboards** are free with **unlimited boards** in a free Canva account, compared with the 3-board caps at Miro and FigJam. — [SaaSworthy](https://www.saasworthy.com/product/canva-whiteboards); [Canva](https://www.canva.com/online-whiteboard/)
- **Excalidraw / Excalidraw+** Free gives 1 infinite scene, unlimited collaborators, E2EE and limited AI. Plus is $6/user/mo with unlimited scenes, cloud storage and extended AI. — [Excalidraw+ pricing](https://plus.excalidraw.com/pricing). It is bootstrapped and revenue-funded with $0 raised. — [Jason Bosco on X](https://x.com/jasonbosco/status/1793647996598370776). Revenue has not been disclosed.
- **tldraw** raised a $10M Series A (Lux, Definition) in April 2025, for about $12M total. It made **$1M in its first year of SDK license sales** (ClickUp, Padlet, Craft, Jam) and has 50k+ GitHub stars. — [tldraw blog](https://tldraw.dev/blog/announcing-tldraw-series-a). SDK 4.0 commercial license: $6,000/yr per team (100-day trial). — [BigGo](https://biggo.com/news/202509190115_tldraw_SDK_4.0_Licensing_Debate)
- **Apple Freeform** is free on Apple devices. Complaints include sync losing strokes ("~20% of strokes sometimes absent"), boards deleted during sync, PDF export that "hang[s] without error", no image export, and no folder system. — [MakeUseOf](https://www.makeuseof.com/reasons-apple-freeform-app-isnt-for-everyone/); [Apple Community](https://discussions.apple.com/thread/254662248)
- **Microsoft Whiteboard**: the standalone apps and personal-account Whiteboard are being retired. Migration deadline is Sept 25, 2026, legacy boards are deleted Oct 16, 2026, and the standalone app is deprecated Nov 30, 2026. Work and school accounts keep Whiteboard in Teams and OneDrive. — [gHacks](https://www.ghacks.net/2026/08/03/microsoft-whiteboard-retires-legacy-whiteboards-and-standalone-app-by-september-2026/); [Microsoft Support](https://support.microsoft.com/en-us/whiteboard/retirement-standalone-microsoft-whiteboard-apps)

### Inferences
- Personal-canvas pricing clusters tightly at **$8–15/mo** (Heptabase $8.99–11.99, Milanote $9.99–12.50, Kosmik $11.99–14.99, Walling $8, Capacities $9.99, Reflect $10). NoteMap's Pro price should sit in this band. Pricing below it signals "hobby" and pricing above it needs AI-credit justification.
- NoteMap's free limit of "3 boards" is the same number Miro and FigJam use. Canva now offers unlimited boards free, so a board cap alone is a weak paywall against free team whiteboards. For a notes product, a count of items or cards (Milanote 100, Kinopio 100, mymind 100) is the common personal-canvas pattern.
- tldraw selling its canvas as an SDK (Craft, ClickUp and Padlet all license it) means canvas rendering itself is a commodity. Differentiation has to come from workflow and audience, not from having a canvas.
- The team-whiteboard segment is not a place for a solo developer. Miro has $600M revenue and 90M users, and Canva, FigJam and Excalidraw give the core feature away.

### Gaps
- Current Muse (post-Wulf) pricing, user counts and revenue: the fetch was rate-limited and searches returned the unrelated "Meta Muse".
- Revenue figures for Kosmik, Scrintal, Walling, Kinopio, Capacities, Reflect, Recall, Fabric, AFFiNE and Craft were not found.
- The Microsoft Loop canvas/whiteboard component had no distinct product information.
- Canva Whiteboards has no separate user or revenue data.
- No direct Reddit threads could be retrieved (tool restriction).

---

## Q2. Who has shut down, pivoted or struggled, and why

### Takeaway
Few pure canvas startups have hard-shut down. The common pattern is a slow shrink into a solo or indie business (Muse, Kinopio-style), or a pivot toward a vertical or AI angle (Scrintal to Gobu for academic research, Kosmik to AI moodboards for designers, tldraw from consumer demos to an enterprise SDK). Big tech is retreating from free consumer whiteboards (Google Jamboard, Microsoft Whiteboard personal accounts). The recurring cause of failure is generic positioning combined with the difficulty of explaining a new document type, not the technology.

### Cited Findings
- **Muse**: raised $2M, grew to 7 staff, and had "tens of thousands of active users" but only about $120k ARR by mid-2022. — [Wiggins retrospective](https://adamwiggins.com/muse-retrospective/)
  - The crash: in Q1 2022, weekly active users "dropped by almost half over the course of a month or two". Wiggins asks whether "Muse was a zero-interest rate phenomenon". — [same](https://adamwiggins.com/muse-retrospective/)
  - The team never narrowed from general-purpose to a vertical (designers, writers, academics), making "marketing difficult even over and above the problem of explaining canvas software". — [same](https://adamwiggins.com/muse-retrospective/)
  - "120k ARR is a one-person business, not a team effort." — [same](https://adamwiggins.com/muse-retrospective/)
  - The B2B/multiplayer pivot (2022–23) failed because of a steep learning curve, adoption depending on one champion, and no web or Windows version, no Notion or Google Docs integrations, and no permissions. — [same](https://adamwiggins.com/muse-retrospective/)
  - "Apple platforms are great, but you have to be on the web." The lack of simple web sharing limited virality. — [same](https://adamwiggins.com/muse-retrospective/)
  - Refusing standard rating prompts cost them: adding the "rate this app" dialog moved ratings from 3.9 to 4.7 stars. — [same](https://adamwiggins.com/muse-retrospective/)
  - Distribution that worked: 10-second demo videos on Twitter, the Metamuse podcast, App Store featuring, YouTubers (Keep Productive, Shu Omi) and Product Hunt. Press, banner ads and the newsletter did not work. — [same](https://adamwiggins.com/muse-retrospective/)
  - HN commenters: "Inventing a new document type is really really hard" (antidnan); "That they were an iPad/Mac only app likely limited their appeal" (rchaud); "Of course I'd never touch something that was Apple only" (stevage); "It was hard for me to come across muse… something about SEO was not working" (pilgrim0). — [HN thread, Feb 2024](https://news.ycombinator.com/item?id=39408507)
- **Scrintal**: closed its Slack community in May 2024. — [Productive Matters](https://productivematters.substack.com/p/scrintal-shuts-down-community). It now points users to Gobu.ai, an AI research assistant for academic papers built on the same canvas. — [Scrintal GitBook](https://scrintal.gitbook.io/scrintal-support-docs/what-is-gobu). This amounts to a vertical and AI repositioning, not a shutdown.
- **Kosmik**: the €3.3M seed pitch was to "overhaul the traditional files-and-folders desktop". — [EU-Startups 2023](https://www.eu-startups.com/2023/12/paris-based-kosmik-raises-e3-3-million-to-overhaul-the-traditional-files-and-folders-desktop/). The product is now branded "Create Moodboard In Seconds With AI". — [kosmik.app](https://www.kosmik.app/). The free tier appears to have been replaced by a 1-week trial. — [Kosmik pricing](https://www.kosmik.app/pricing)
- **tldraw**: Make Real (Nov 2023) went viral, with "thousands of incredible posts, TikToks, and videos" within 72 hours, and remained a free open-source experiment. — [tldraw Substack](https://tldraw.substack.com/p/make-real-the-story-so-far). tldraw then focused on the SDK business rather than "independent consumer applications". — [tldraw Series A](https://tldraw.dev/blog/announcing-tldraw-series-a)
- **Google Jamboard** was retired on Jan 1, 2025, with data deleted Dec 31, 2024. — [Wikipedia](https://en.wikipedia.org/wiki/Jamboard)
- **Microsoft Whiteboard** personal accounts and standalone apps are being retired (Sept–Nov 2026). — [gHacks](https://www.ghacks.net/2026/08/03/microsoft-whiteboard-retires-legacy-whiteboards-and-standalone-app-by-september-2026/)
- **Logseq** removed whiteboards from its DB rewrite. — [Logseq docs](https://github.com/logseq/docs/blob/master/db-version-changes.md)
- **Mural**, a pandemic-era whiteboard, had multiple rounds of layoffs, per employee reviews citing loss of a Microsoft contract. This is **low-reliability, Glassdoor-sourced**. — [Glassdoor](https://www.glassdoor.com/Reviews/Mural-rounds-of-layoff-Reviews-EI_IE2034974.0,5_KH6,22.htm)
- **Napkin** (note app): a user review suggests it may be abandoned (no updates for 4 months). Unverified. — [App Store](https://apps.apple.com/us/app/napkin-ideas/id6470183297)

### Inferences
- Lessons for NoteMap:
  1. Muse's own diagnosis was a lack of vertical focus, so pick one audience.
  2. Being on the web matters, and NoteMap already has a web app.
  3. Canvas products earn about $100/yr per customer, so they work as solo or small-team businesses, not venture-scale ones. $120k ARR is a good outcome for one person.
  4. Short demo videos and creator/YouTuber coverage beat press.
  5. Use standard growth hygiene such as rating prompts.
- The retirement of Microsoft Whiteboard (personal) and Jamboard frees up a pool of casual users who need a free or cheap replacement right now, with September–November 2026 migration deadlines. That is a possible short-term acquisition hook, though those users are low-willingness-to-pay consumers.
- The pivots of funded players (Kosmik to designers, Scrintal to academics) show that even well-funded generic canvases converged on verticals.

### Gaps
- No confirmed full shutdown of a VC-backed personal-canvas startup was found in 2024–2026. Searches surfaced only Big Tech retirements.
- Post-pivot traction for Scrintal/Gobu and Kosmik is unknown.

---

## Q3. What users of horizontal canvas tools complain about most

### Takeaway
The dominant complaint across tools is **performance on large boards** (Heptabase, Obsidian Canvas, Miro), followed by **weak mobile** (Heptabase, Freeform drawing only on iOS), **sync and data-loss fear** (Freeform), **pricing and paywall friction** (Milanote, AI credits), **platform lock-in** (Apple-only Muse and Freeform), and a **card-first structure that forces premature organization**. AI is now a growing expectation rather than a complaint, though credit caps annoy users.

### Cited Findings
- **Performance at scale**
  - Heptabase: "Whiteboards with 100s of cards and pdf highlights are slow and laggy"; "Performance gap between Hepta and MarginNote is huge". — [Product Hunt reviews](https://www.producthunt.com/products/heptabase/reviews). Another review notes the landing page advertises "blazing-fast speed" while large whiteboards lag. — [ToolChase](https://toolchase.com/tool/heptabase/)
  - Obsidian Canvas: lag above about 200 nodes and with large text cards, with "choppy scrolling, and frame rate drops" even on RTX 4090 machines. — [Obsidian forum](https://forum.obsidian.md/t/hope-the-official-team-can-optimize-canvas-performance-with-a-summary-of-multiple-test-contents-attached/88023)
  - Miro: "boards can become slow and difficult to navigate when filled with many elements or used by multiple people at once". — [eesel](https://www.eesel.ai/blog/miro-ai)
- **Mobile**: Heptabase "mobile apps have less functionality than the desktop version… primarily optimized for larger screens". — [ToolChase](https://toolchase.com/tool/heptabase/). In Freeform, "drawing and writing features are only available on iPadOS and iOS". — [MakeUseOf](https://www.makeuseof.com/reasons-apple-freeform-app-isnt-for-everyone/)
- **Sync and reliability**: Freeform users report missing pen strokes, boards deleted during sync and hanging PDF exports. — [Apple Community](https://discussions.apple.com/thread/254662248); [MakeUseOf](https://www.makeuseof.com/reasons-apple-freeform-app-isnt-for-everyone/)
- **Pricing and paywalls**: "Milanote is nice but the billing is very expensive" (r/graphic_design, via [refern.app](https://www.refern.app/blog/milanote-too-expensive-one-time-alternative)). Miro's AI credits are "capped tightly with no rollover". — [eesel](https://www.eesel.ai/blog/miro-ai). Heptabase Pro AI "stops until they reset or users add their own API key". — [Heptabase wiki](https://wiki.heptabase.com/newsletters/2025-12-10). Kinopio added a lifetime plan "based on popular demand". — [Kinopio](https://kinopio.club/help/how-much-does-kinopio-cost/)
- **Platform lock-in (Apple-only)**: "Of course I'd never touch something that was Apple only" (HN on Muse). — [HN](https://news.ycombinator.com/item?id=39408507). Freeform "only works on Apple devices". — [MakeUseOf](https://www.makeuseof.com/reasons-apple-freeform-app-isnt-for-everyone/)
- **Structure friction**: "A card-based system asks users to commit to structure before they've earned it." Heptabase is also criticized for "lackluster to-do management" and a smaller plugin ecosystem than Obsidian (e.g., Zotero). — [Slashspace (competitor marketing)](https://www.slashspace.ai/compare/heptabase-alternative); [Effortless Academic](https://effortlessacademic.com/note-taking-tools-obsidian-vs-heptabase-compared/)
- **Aesthetics and output quality**: "the end result didn't look as nice to me as output I made elsewhere, which discouraged me from using it" (HN on Muse). — [HN](https://news.ycombinator.com/item?id=39408507)
- **Data longevity and export**: Jamboard and Microsoft Whiteboard retirements force export-or-lose deadlines ("legacy whiteboards… will be permanently deleted"). — [gHacks](https://www.ghacks.net/2026/08/03/microsoft-whiteboard-retires-legacy-whiteboards-and-standalone-app-by-september-2026/). Whimsical Free forces watermarked exports. — [Whimsical](https://whimsical.com/pricing)

### Inferences
- The two most-repeated technical complaints are performance above roughly 200 cards and weak mobile. Both are achievable differentiators for NoteMap, which has virtualized rendering and a native macOS app. "Stays fast at 2,000 cards" is a concrete, demo-able claim.
- Open export (Markdown/JSON, and Obsidian's `.canvas` format, JSON Canvas) directly answers lock-in fear, which the Big Tech retirements amplify.
- Being Apple-only is a known liability. NoteMap being web plus macOS avoids Muse's trap, but it lacks iOS and Android capture, which is Heptabase's weak spot too.

### Gaps
- Direct Reddit quotes (r/PKMS, r/Heptabase, r/ObsidianMD, r/macapps) could not be retrieved. Quotes above come from HN, Product Hunt, forums and secondary blogs quoting Reddit.
- No quantitative survey ranking these complaint categories was found.

---

## Q4. AI-native entrants and features: what has been added and how it's received

### Takeaway
AI on the canvas is now table stakes. Heptabase (chat with whiteboards, AI tutor, tiered credits), Miro AI, Excalidraw AI, Kosmik AI tagging, Scrintal/Gobu PDF analysis, Flowith (AI conversations as nodes) and tldraw's Make Real/Computer all ship it. The reception is positive when AI works *on the user's own material* (chat with board or PDF, summarizing), and it cuts context-switching to ChatGPT or NotebookLM. The friction is credit-based pricing. The AI-first viral demos (Make Real) produced attention but not a consumer business.

### Cited Findings
- Heptabase launched "Chat with your whiteboards" (July 2025) and then restructured in Dec 2025. Pro gets a monthly pool of Gemini credits. The new Premium plan gives "unlimited usage of fast, basic models like Gemini 2.5 Flash and GPT-4o mini", about 10× the Pro credits for advanced models, and unlimited PDF parsing. — [Heptabase newsletter 2025-07-23](https://wiki.heptabase.com/newsletters/2025-07-23); [2025-12-10](https://wiki.heptabase.com/newsletters/2025-12-10)
  - Heptabase says it received "overwhelmingly positive feedback", with users reporting they "no longer need to switch between Heptabase and other tools like NotebookLM or ChatGPT". This is **vendor-reported**. — [Heptabase wiki](https://wiki.heptabase.com/changelog)
  - The lifetime license was reportedly retired in the Dec 2025 restructure (secondary source, unconfirmed by the primary page). — [Litmus review](https://litmustools.com/review/heptabase/)
- Competitors attack incumbents for *insufficient* AI: "constant context-switching between research in Heptabase and AI conversations in ChatGPT or Claude… fragmented by design". — [Slashspace (competitor marketing)](https://www.slashspace.ai/compare/heptabase-alternative)
- Flowith (AI chats as canvas nodes, "Agent Neo") topped Product Hunt in June 2025 and claims 1M+ users. — [eesel](https://www.eesel.ai/blog/flowith-review)
- tldraw Make Real (GPT-4V sketch-to-website) went viral in Nov 2023. Rate limits forced users to bring their own API key, and it remained a free experiment. — [tldraw Substack](https://tldraw.substack.com/p/make-real-the-story-so-far). tldraw computer (with Google DeepMind) is "an experimental application where users create workflows from blocks". — [HackScience](https://www.hackscience.education/the-computer-you-draw-inside-tldraws-natural-language-os/). The company's revenue comes from the SDK. — [tldraw](https://tldraw.dev/blog/announcing-tldraw-series-a)
- Miro AI auto-structures brainstorms into diagrams and mind maps. The complaint is tight credit caps with no rollover and "its scope stops at the canvas". — [eesel](https://www.eesel.ai/blog/miro-ai)
- Scrintal spun its canvas into Gobu, an AI research agent that breaks papers into "methodology, key concepts, results, limitations". — [gobu.ai](https://gobu.ai/); [Chuck Frey](https://chuckfrey.medium.com/gobu-this-new-visual-ai-tool-streamlines-research-like-nothing-ive-seen-before-bd5e1d9c9baf)
- Kosmik: AI auto-tagging and a visual-similarity "AI finder" for designers' references. — [UX Lift](https://www.uxlift.org/tools/kosmik-create-moodboard-in-seconds-with-ai/)
- Tana moved up-market with AI meeting agents and MCP at $20–80/mo. — [Costbench](https://costbench.com/software/note-taking/tana/). Mem pivoted to AI-organized notes and needed a 2.0 rewrite to fix speed and stability. — [SolidAITech](https://www.solidaitech.com/2026/07/mem-ai-note-taking-app-vs-mem0-api.html)
- Excalidraw offers "limited" AI free and "extended" AI in Plus at $6/mo. — [Excalidraw+ pricing](https://plus.excalidraw.com/pricing)

### Inferences
- AI's commercial role in this category is **tier differentiation and ARPU expansion**. Heptabase went from a single ~$9–12 plan to $9/$18/$54 tiers driven by AI credits. For a solo developer, bring-your-own-key or a small credit pool on Pro plus a higher AI tier mirrors this without margin risk.
- The well-received AI features are grounded in the user's content (chat with this board, summarize these cards, explain this PDF). Generic generation is commoditized by ChatGPT and Claude.
- An AI-native canvas angle NoteMap could own: "AI proposes the arrows". This means auto-suggesting links or relations between cards and clustering, which uses the card-plus-arrow model directly. No source showed a competitor centering on this (see Gaps).

### Gaps
- No independent (non-vendor) data on AI feature adoption or retention in canvas apps was found.
- No direct evidence found for community backlash to Heptabase's Dec 2025 pricing change (Reddit inaccessible).
- Auto-linking specifically (AI-suggested edges between cards) was not documented for any competitor in sources found. This absence is not proof it doesn't exist.

---

## Q5. Saturation vs. gaps, and whether a generic canvas is viable for a solo developer in 2026

### Takeaway
A **generic "infinite canvas for notes" is saturated and weakly monetizable** for a solo developer. Free options (Obsidian Canvas, Canva, Freeform, Excalidraw, tldraw, AFFiNE) cover casual use, Heptabase owns "visual learning/research", Milanote owns "creatives", and even funded generic players (Muse, Kosmik, Scrintal) retreated to indie scale or verticals. Viable paths are a **vertical wedge** (a specific profession or workflow with its own templates, import/export and vocabulary) or an **explicit technical differentiator** (performance at scale, local-first/open format, native Mac quality) sold to a specific community. Realistic ceilings for well-executed indie canvases are roughly $100k–$3M ARR.

### Cited Findings
- **Scale benchmarks for indie/small canvases**: Muse about $120k ARR with 7 staff (2022). — [Wiggins](https://adamwiggins.com/muse-retrospective/). Heptabase about $1.2M (2024 estimate) to $2.4M run-rate (Starter Story). — [GetLatka](https://getlatka.com/companies/heptabase.com); [Starter Story](https://www.starterstory.com/heptabase-breakdown). Milanote about $2.8M ARR (2024 estimate). — [GetLatka](https://getlatka.com/companies/milanote). Kinopio is solo, running on about $303/mo infrastructure. — [Kinopio](https://kinopio.club/kinopio-architecture-and-costs-JOGXFJ0FEMpS3crbh6U9k)
- **Free and commoditized horizontal floor**: Canva offers unlimited free boards. — [SaaSworthy](https://www.saasworthy.com/product/canva-whiteboards). Obsidian Canvas is free. — [Obsidian](https://obsidian.md/pricing). Freeform is free. — [Storyflow](https://storyflow.so/blog/best-milanote-alternatives-2026). Excalidraw is free with 1 scene. — [Excalidraw+](https://plus.excalidraw.com/pricing). AFFiNE is free and open source. — [AFFiNE](https://affine.pro/pricing). tldraw licenses the canvas engine itself. — [tldraw](https://tldraw.dev/blog/announcing-tldraw-series-a)
- **Verticals that worked or that funded players pivoted into**:
  - Creatives and designers: Milanote. — [TechCrunch](https://techcrunch.com/2017/04/18/milanote-bags-780k-seed-to-tool-up-its-evernote-for-creatives/). Kosmik moodboards. — [kosmik.app](https://www.kosmik.app/)
  - Students, researchers and learners of complex topics: Heptabase. — [Starter Story](https://www.starterstory.com/heptabase-breakdown). Scrintal/Gobu for academics. — [gobu.ai](https://gobu.ai/)
  - Writers: Scapple, a $20.99 one-time purchase from the Scrivener maker. — [L&L](https://www.literatureandlatte.com/store/scapple)
  - Filmmakers and creative directors: Storyflow markets mood boards to them and undercuts Milanote at $7.99/mo annually. — [Storyflow](https://storyflow.so/blog/best-mood-board-tools-2026)
- Muse's retrospective explicitly names the failure to pick among "designers, writers, academics" as a core problem. — [Wiggins](https://adamwiggins.com/muse-retrospective/)
- **HN appetite remains** for new canvas notes apps (Show HNs in Jan, Jun and Jul 2026, e.g., KindleBox and a "non-Euclidean Poincaré disk" canvas). The July 2025 "Infinite Canvas for Notes" thread got only light engagement ("Feels very Figma-y"). — [HN 46689420](https://news.ycombinator.com/item?id=46689420); [HN 48372138](https://news.ycombinator.com/item?id=48372138); [HN 44581126](https://news.ycombinator.com/item?id=44581126). This shows constant new supply and crowded attention.
- **Disruption windows**: Microsoft Whiteboard personal-account cutoff (Sept 25, 2026) and Jamboard retirement (Jan 2025). — [Innvesti](https://innvesti.com/reports/microsoft-whiteboard-personal-shutdown-alternatives-2026/); [Wikipedia](https://en.wikipedia.org/wiki/Jamboard). Logseq users lost whiteboards in the DB version. — [Logseq docs](https://github.com/logseq/docs/blob/master/db-version-changes.md). Obsidian Canvas power users are hitting the ~200-node performance wall. — [Obsidian forum](https://forum.obsidian.md/t/hope-the-official-team-can-optimize-canvas-performance-with-a-summary-of-multiple-test-contents-attached/88023)

### Inferences
- **Saturated**: team whiteboards (Miro, FigJam, Canva, Whimsical, Excalidraw); generic "visual second brain" for PKM hobbyists (Heptabase, Obsidian+Canvas, Capacities, AFFiNE, Scrintal); AI chat canvases (Flowith, Heptabase AI); moodboards for designers (Milanote, Kosmik, Storyflow).
- **Open or under-served gaps** (inferred from complaint patterns and absent players):
  1. **Performance-at-scale canvas** for heavy users (Obsidian Canvas and Heptabase refugees with 500–5,000 cards). This is a technical wedge that is easy to demo.
  2. **Profession-specific argument or causal mapping with cards and arrows**: legal case theory, investigative journalism and OSINT link charts, qualitative research coding, product/UX research synthesis, novel plotting, and tabletop RPG worldbuilding. Arrows between rich-text cards are the core of all of these, and none has a dominant modern cloud-synced tool in the sources reviewed. (This is inference. Validate against the parallel niche research notes.)
  3. **Open-format and interoperability angle**: first-class JSON Canvas and Markdown export and import, so Obsidian and Logseq users can adopt without lock-in fear. This directly addresses the complaints behind the Big Tech retirements.
  4. **Web plus native Mac with fast sync**, the combination Muse lacked and Freeform does unreliably.
- **Viability verdict**: a generic horizontal "infinite canvas for notes" priced at $8–12/mo competes with free incumbents and with Heptabase's head start and AI tiers. With no distribution advantage, expect Muse-like outcomes (tens of thousands of free users, low-six-figure ARR at best). A vertical positioning, even on the *same core product* with vertical templates, copy and SEO, is the pattern every surviving player converged on and is the recommended route. Horizontal can remain the product while marketing goes vertical.

### Gaps
- No market-size data specific to "personal visual note-taking" (as opposed to the whiteboard market) was found.
- Verticals such as legal, OSINT and qualitative research were not researched for incumbents here. They are likely covered in sibling files (`professional_other_niches.md`).
- The conversion rates of free to paid users for canvas apps were not found (Obsidian estimate: about 3% assumed by OperatorBook).

---

## Q6. Heptabase deep dive: pricing, growth, audiences, remaining complaints

### Takeaway
Heptabase is the category's clearest commercial success and NoteMap's closest analogue. It is YC-backed with about $1.7–2.2M in seed funding, and was profitable on revenue for years with a team of about 6–8. Estimated revenue is $1.2M ARR (2024) to about $2.4M run-rate (Starter Story, undated), on a no-free-plan model with a 7-day trial. It has captured students, researchers and "learners of complex topics", and in Dec 2025 moved to AI-credit tiers ($8.99/$17.99/$53.99 per month annual). Its users still complain about large-whiteboard performance, weaker mobile, to-do handling, UI friction and a lack of plugins or integrations.

### Cited Findings
- **Pricing (2026)**: Pro $8.99/mo annual or $11.99 monthly ($107.88/yr), with unlimited notes, whiteboards and collaborators, PDF highlights, YouTube transcripts, and a Gemini-only AI agent with 100 credits per month. Premium $17.99 annual or $23.99 monthly, with unlimited PDF OCR, unlimited basic-model Q&A, GPT/Claude/Gemini, AI tutor and 1,800 credits. Premium+ $53.99 annual or $71.99 monthly, with 8,100 credits and 33% off extra credits. — [Heptabase pricing](https://heptabase.com/pricing); [ToolChase](https://toolchase.com/tool/heptabase/); [Heptabase wiki](https://wiki.heptabase.com/newsletters/2025-12-10)
- No free plan; there is a 7-day trial. — [SaaSworthy](https://www.saasworthy.com/product/heptabase); [Starter Story](https://www.starterstory.com/heptabase-breakdown)
- **Funding**: about $1.7M seed in 2022 from YC, HOF Capital, Kleiner Perkins, Moving Capital and others. Another source says $2.2M total. The company "has not spent any investor money over the past two years", with expenses funded by revenue. — [GetLatka](https://getlatka.com/companies/heptabase.com); [YC](https://www.ycombinator.com/companies/heptabase)
- **Revenue and users** (estimates that conflict):
  - GetLatka: $1.2M revenue in 2024 with 30,000 active paid users. — [GetLatka](https://getlatka.com/companies/heptabase.com)
  - Starter Story: "$200K/month", a $2.4M run-rate, 7-figure ARR within 2 years, profitable, about 6 employees. — [Starter Story](https://www.starterstory.com/heptabase-breakdown)
  - Note: 30k paid users × roughly $100/yr works out to about $3M, so GetLatka's two figures are internally inconsistent. Treat the range as about $1–3M ARR.
- **Founders and team**: founded 2021 by Alan Chan (CEO), Ethan Wu and Yeefun Lin. The team was about 8 people. — [GetLatka](https://getlatka.com/companies/heptabase.com); [Ness Labs interview](https://nesslabs.com/heptabase-featured-tool)
- **Build and go-to-market**: 26 months of alpha and beta (8 months closed alpha plus 18 months public beta) and 300+ iterations. Growth came from organic Discord and Telegram communities about visual note-taking, word of mouth, and an **affiliate program launched in late 2023 that contributes about 10% of revenue**. — [Starter Story](https://www.starterstory.com/heptabase-breakdown)
- **Audience**: "Researchers, students, and professionals managing complex information and deep learning tasks". — [Starter Story](https://www.starterstory.com/heptabase-breakdown). YC tagline: "An intelligent, visual knowledge base for learning complex topics". — [YC](https://www.ycombinator.com/companies/heptabase). Paying users came from 61 countries. — [GetLatka/interview summary](https://getlatka.com/companies/heptabase.com)
- **Praise** (Product Hunt, 4.6/5 from 34 reviews): "Most powerful visual learning tool I've ever used"; "Level of detail and understanding of human-computer interaction that went into this product is insane"; "Developers are responsive… hundreds of improvements". — [Product Hunt](https://www.producthunt.com/products/heptabase/reviews)
- **Complaints**:
  - Performance: "Whiteboards with 100s of cards and pdf highlights are slow and laggy". — [Product Hunt](https://www.producthunt.com/products/heptabase/reviews)
  - Mobile: "less functionality than the desktop version". — [ToolChase](https://toolchase.com/tool/heptabase/)
  - Workflow: "Lackluster to-do management"; "rough UI/UX"; "friction in daily use". — [Product Hunt](https://www.producthunt.com/products/heptabase/reviews)
  - Ecosystem: no plugin ecosystem such as Zotero integration, compared with Obsidian. — [Effortless Academic](https://effortlessacademic.com/note-taking-tools-obsidian-vs-heptabase-compared/)
  - No free tier, and AI credit caps on Pro. — [Heptabase wiki](https://wiki.heptabase.com/newsletters/2025-12-10)

### Inferences
- Heptabase proves that about $100/yr per person for a card-and-whiteboard knowledge tool can reach seven-figure ARR with a small team, **when positioned at a specific job** (learning or researching complex topics) and grown through community, affiliates and a long public beta.
- Heptabase's weaknesses map directly onto opportunities for NoteMap: speed on large boards, a free tier (Heptabase has none, which gives NoteMap a lower-friction entry point), open export, mobile capture, and integrations (Zotero, Readwise, Obsidian).
- Competing head-on for "students and researchers learning complex topics" means fighting an entrenched, loved, fast-shipping incumbent with AI tiers. A different vertical, or a clearly different job (for example argument mapping or case building rather than learning), is safer.

### Gaps
- Heptabase's 2025–2026 revenue and user counts from a primary source (founder statement) were not found. The Starter Story article is undated in the extract.
- Geographic audience mix (reportedly strong in Taiwan and East Asia) could not be verified because the search budget was exhausted and the Business Next article redirect failed.
- Reddit-specific churn reasons and reaction to the Dec 2025 pricing restructure could not be retrieved.
