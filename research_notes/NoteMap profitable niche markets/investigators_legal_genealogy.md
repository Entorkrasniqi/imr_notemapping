# Investigation-style niches ("evidence board" users) as paying customers for NoteMap/ScriptumOS

Research date: 2026-09-29. Scope: investigative journalists, OSINT analysts, private investigators (PIs), lawyers/paralegals/litigation support, insurance-fraud/compliance/due-diligence investigators, true-crime hobbyists/podcasters, genealogists.

**Method limits (read first):** Reddit could not be read directly. reddit.com blocks this research agent's fetcher and search domain filter (HTTP 403 / "domain not accessible"), so **no verbatim Reddit quotes are included**. Subreddit sizes come from GummySearch snapshots, whose date is unknown. G2 also returned 403. User quotes come from Capterra, Software Advice, the Websleuths forum and Hacker News instead. The session's web-search budget ran out partway through, so some items (MyHeritage pricing, Miro/Milanote pricing, Graphistry pricing, the Bellingcat community size, true-crime podcast audience stats) are listed as gaps.

---

## 1. Which tools does each segment use, and what do they cost?

### Takeaway
There is a sharp price cliff. Professional link-analysis and case-chronology tools cost **~$360 to $19,000+ per seat per year** (Maltego, i2, Sentinel Visualizer, CaseFleet, CaseMap+ AI). Everything under that is either a generic whiteboard/notes tool (Obsidian, Miro, Scrintal, Excel, OneNote) or a very small hobbyist "detective board" app at $0 to $10/month. Few products sit in the $10 to $50/month "prosumer investigator" band, and those that do are small and new (SleuthStack, FactBox, Hunchly, espectrosint).

### Cited Findings

**OSINT / intelligence link analysis**
- **Maltego (Jan 2026 pricing page):** Basic is free (Graph Community Edition, 200 credits/mo; Basic+ gets 1,000 credits/mo and is free for government/organisational email holders). **Entry Standard is €3,000/yr** (10,000 credits/mo plus Hunchly). **Professional Standard is €7,500/yr** (up to 5 users, per-seat billing; 20k to 40k credits/mo; includes Maltego Search, commercial data and Hunchly). Enterprise is contact-sales and adds Maltego Monitor and **Maltego Evidence**. Pro and Enterprise include "Maltego Cases". — [Maltego pricing](https://www.maltego.com/pricing/)
- **Hunchly (web-capture tool for online investigations, now owned by Maltego Technologies):** free tier. **Classic is $169/yr or €149/yr** and stores data locally so users can "work with your findings offline". Multi-licence bulk discounts are available and Classic can be converted to cloud storage. — [Hunchly pricing](https://hunch.ly/pricing). Older pricing was $129.99/yr for 1 licence and $349.99/yr for 3 — [eInvestigator](https://www.einvestigator.com/hunchly-online-evidence-collection/) (undated, likely pre-2024).
- **i2 Analyst's Notebook (i2 Group, formerly IBM/Harris):** base version from **$7,160**, Premium from **$19,200** (figures published by competitor FMS; page undated) — [FMS comparison](https://www.fmsasg.com/i2/Analysts_Notebook/comparison.asp). SelectHub lists "$9,060 per user annually" — [SelectHub](https://www.selecthub.com/p/data-visualization-tools/i2-analyst-s-notebook/). i2 now sells perpetual, subscription and monthly-term licences, plus a "subscription bundle" (Analyst's Notebook plus hosted data connectors plus TextChart) aimed at "rapidly increasing demand for affordable technology". No price is disclosed. — [i2 Group](https://i2group.com/articles/subscription-bundle)
- **Sentinel Visualizer (FMS), an i2 competitor:** Standard is **$2,999** perpetual single-PC and Professional is $3,599. With 1-year support they are $3,598 / $4,298. Networked multi-user versions are $6,397 (Premium) and $9,197 (Ultimate). — [FMS](https://www.fmsasg.com/i2/Analysts_Notebook/comparison.asp)
- **Kumu (network mapping, recommended by GIJN):** Basic workspace is free with public projects unlimited, but **each private project costs $9/mo**. Pro workspace is $10/mo **plus $20/mo per private project**. Enterprise starts at **$20,000/yr per 5-seat package**. Annual billing is 20% off. — [Kumu docs](https://docs.kumu.io/frequently-asked-questions/what-pricing-plans-does-kumu-have)
- **Linkurious:** "2 pricing editions, starting at €490" (aggregator; unverified on the vendor page) — [G2 via search](https://www.g2.com/products/linkurious/pricing)
- **Cheaper OSINT alternatives (July 2026):** espectrosint is free, with Pro at **$29/mo (~$348/yr)**. SpiderFoot, Recon-ng, theHarvester, Sherlock and Maigret are free/open source. Lampyre offers a Maltego-style graph on pay-as-you-go credits. Intelligence X is ~$2,000/yr. Shodan membership is ~$49. Social Links is custom enterprise-priced. — [espectrosint](https://www.espectrosint.com/blog/maltego-alternatives) (a vendor's comparison piece, so self-interested)
- **OSINTracker:** free, browser-based link-analysis graph (Cytoscape.js). Data stays in browser IndexedDB ("no investigation data ever leaves your machine"). Exports HTML/Markdown/CSV/JSON/PNG. Pitched at "OSINT analysts, journalists, researchers, and investigators" with "audit trails and source attribution". — [OSINTracker](https://www.osintracker.com/), [OSINT Newsletter tools library](https://tools.osintnewsletter.com/osint-tools/osintracker)
- **Obsidian (free for personal use, local) is widely repurposed for OSINT.** It has paid courses ("OSINT Documentation with Obsidian" — [myosint.training](https://www.myosint.training/courses/osint-documentation-with-obsidian)) and paid Gumroad templates ("Obsidian OSINT Workflows — Intelligence Mapping for the Local Analyst" — [Gumroad](https://numbpilled.gumroad.com/l/obsidianosint)). Guides say Canvas lets you "design entire investigation maps, similar to Maltego but local and faster" — [search summary of Medium guides](https://medium.com/@neonmaxima/how-i-turned-obsidian-into-a-black-ops-intelligence-hub-and-why-you-should-too-a1534b39ec5e). One guide praises that Obsidian "stores everything locally on your device. No cloud, no subscriptions, no data leaving your machine." — [Sherlockeye](https://sherlockeye.io/blog/using-obsidian-for-osint)

**Investigative journalism**
- GIJN's recommended network tools are **NodeXL** (Excel add-in), **Gephi** (free, open source) and **Kumu.io** ("visualizing social media connections, company structures, and creating family trees... embedded and updated through Google Sheets"). — [GIJN visualization tools](https://gijn.org/resource/visualization-tools/), [GIJN social network analysis](https://gijn.org/stories/power-social-network-analysis-investigative-journalism/)
- IRE membership: "more than 3,000 members"; Professional membership is **$75/yr**. — [IRE](https://www.ire.org/about-ire/), [Join IRE](https://www.ire.org/join-ire/)

**Legal / litigation support**
- **CaseMap is NOT discontinued but classic is in legacy mode.** LexisNexis moved development to the cloud in 2022 and in **March 2025 rebranded CaseMap Cloud as "CaseMap+ AI"**, folding in TextMap and TimeMap and adding generative AI. Classic v13/14 get support but no updates, and no hard EOL date has been announced. — [CaseFleet comparison](https://www.casefleet.com/comparisons/casemap-alternative) (competitor source), [LawSites 2022](https://www.lawnext.com/2022/02/at-long-last-casemap-moves-to-the-cloud.html). Classic CaseMap is Windows-only per CaseFleet's comparison table.
- **CaseMap+ AI pricing:** "Pricing available upon request" — [Software Advice](https://www.softwareadvice.com/legal/casemap-profile/). FactBox estimates **$50 to $100/user/month** — [FactBox](https://getfactbox.com/alternative/best-alternatives-to-excel-for-case-chronologies-in-2026) (competitor estimate).
- **CaseFleet (fact chronology plus evidence linking):** Starter **$30/user/mo** (20 documents per case, chronology building). **Advanced AI $140/user/mo** month-to-month, with 22% off annually (~$109). Enterprise is custom for 20+ users. Includes "bank-level encryption" and HIPAA BAA for an extra fee; SSO is Enterprise only. — [CaseFleet pricing](https://www.casefleet.com/pricing). An older snapshot listed Standard at $75/user/mo annual and Advanced AI at $140 annual / $180 monthly — [search summary of CaseFleet pricing/Capterra](https://www.capterra.com/p/155618/CaseFleet/pricing/). Prices appear to have been restructured in 2026.
- **FactBox:** $49/mo, unlimited cases. **TrialLine:** "$59/user/month". Opus 2 and Everchron are enterprise-only with no public price. — [FactBox](https://getfactbox.com/alternative/best-alternatives-to-excel-for-case-chronologies-in-2026)
- **Aeon Timeline 3** markets a "Legal & Investigations" solution (case timelines, chronology, case facts and documents). It costs **$65 perpetual** plus an optional **$35/yr** updates plan, on up to 5 devices (Mac/Windows/iOS). — [Aeon pricing](https://www.aeontimeline.com/pricing)
- **Clio Manage** (practice management, the per-seat benchmark): EasyStart **$49/user/mo**, Essentials $89/user/mo. As of July 2026 Clio hid most pricing, and one aggregator gives the range as "$39–$139/user/month". — [search summary of CostBench/LawNext directory](https://costbench.com/software/ai-legal-tools/clio/)
- **MyCase** $49/$69/$89 per user/mo (Solo/Pro/Business) — [search summary, Deelo blog](https://www.deelo.ai/blog/best-private-investigator-software-2026)
- **TrialPad** is an iPad courtroom presentation app (exhibits, annotation, whiteboard) rather than a chronology tool — [WisBlawg](https://wisblawg.law.wisc.edu/2013/06/18/trialpad-and-other-apps-for-legal-professionals/) (2013)

**Private investigators / insurance SIU**
- PI case-management tools: **Case Jacket** has a free plan (2 users, 25 cases, 10 GB). **Deelo** is from $19/seat/mo. CROSStrax, Tracers and Thomson Reuters CLEAR don't publish prices. — [search summary of Deelo/CROSStrax blogs](https://www.crosstrax.co/software-for-solo-investigators/)
- Insurance SIU uses enterprise fraud platforms: Quantexa (graph-based linking), Shift Technology, FRISS, Verisk, LexisNexis Risk Solutions, Carpe (SIU case management with "network analysis", "ring hunter") and OWL Intelligence. — [search summary incl. Carpe](https://carpe.io/solutions/case-management/), [Owl Intel](https://owlintel.ai/industry-solutions/insurance-fraud-siu-investigation/)

**True crime / armchair sleuths**
- **SleuthStack**, explicitly a "digital detective board" for web sleuths, podcasters and investigators: Solo Sleuth free (**3 case files**, 500 MB). **Super Sleuth $10/mo** (unlimited cases). **Sleuth Squad $25/mo** (team, AI). Features include a timeline builder, evidence locker, "Clue Kanban", victimology profiles, source manager with citation metadata and "Smart Connections" AI. It claims "SOC 2 Compliant... End-to-End Encryption" and "thousands of investigators" (no hard number). — [SleuthStack](https://sleuthstack.com/). Its free-tier cap of 3 cases is the same shape as NoteMap's 3 boards.
- **Detective Board (detectiveboard.io):** browser corkboard with red string, "free to start", public board gallery (904 public boards). Audience is true crime, fiction writers, D&D and students. No paid price shown. — [detectiveboard.io](https://www.detectiveboard.io/)
- **Cluero** (iOS/iPad "Vision Board", red string and push pins): Pro is $1.99/mo, $5.99/yr or $9.99 lifetime, with 1 rating. — [App Store](https://apps.apple.com/app/id6755574982)
- **CrazyWall** is an open-source "digital evidence board" — [GitHub](https://github.com/0xsha/CrazyWall). Creately, imageonline.io and Cloudairy offer free "evidence board maker" templates — [Creately](https://creately.com/lp/evidence-board-maker/), [imageonline](https://imageonline.io/detective-board/). Figma has a Community "Conspiracy Board" file — [Figma](https://www.figma.com/community/file/886063882645672741/conspiracy-board).
- **Tyler Technologies "Link Analysis"** is a digital investigation board for police (B2G) — [Police1](https://www.police1.com/police-products/investigation/computer-digital-forensics/articles/tyler-technologies-launches-digital-evidence-board-software-9lqSsD5MwM3rXQjS/)
- What sleuths actually use, per the Websleuths thread "does anyone use a program for all of their websleuth research?" (2018–19): Excel, OneNote, Evernote (for the web clipper), Scrivener/yWriter and Photobucket — [Websleuths](https://www.websleuths.com/forums/threads/does-anyone-use-a-program-for-all-of-their-websleuth-research.394800/). A Websleuths member also built a Chrome extension to track and organise NamUs cases — [Websleuths](https://websleuths.com/threads/new-tool-for-websleuths-chrome-extension-to-track-and-organize-namus-cases.743454/)

**Genealogy**
- **Ancestry World Explorer:** $39.99/mo monthly, $29.99/mo on annual ($319/yr). **All Access** is $59.99/mo, or $479/yr. — [search summary of Family History Daily / Groupon 2026](https://familyhistorydaily.com/genealogy-help-and-how-to/ancestry-best-membership/)
- **Ancestry scale:** "more than three-million paying customers" (2018); US$1B revenue (2022); acquired by Blackstone for $4.7B (Dec 2020); DNA network 25M+ (2023). — [Wikipedia](https://en.wikipedia.org/wiki/Ancestry.com)
- **RootsMagic 11** (released Sept 2025): **$39.95 new / $29.95 upgrade**, a one-time purchase — [RootsMagic](https://www.rootsmagic.com/rootsmagic/buy), [Genea-Musings](https://www.geneamusings.com/2025/12/rootsmagic-announces-version-11-upgrade.html)
- **Family Tree Maker 2024** (Mackiev, Mac/Windows) syncs with Ancestry; its price is not on the product page — [Mackiev](https://www.mackiev.com/ftm/). A search summary said FTM's last update was 2019 v24.2.2 (Sept 2023); **this conflicts** with Mackiev's own page showing FTM 2024. Trust the primary source.
- **Evidentia 3+** is software for the evidence-analysis side of genealogy (Genealogical Proof Standard). It works like CaseMap for genealogists: "record sources, extract claims, evaluate evidence, work toward written conclusions". It is a one-time purchase, **$48 bundle** with its book, with a 14-day trial, and integrates with RootsMagic, Legacy and FamilySearch. — [Evidentia](https://evidentiasoftware.com/product/the-software-and-the-book/)
- Genealogists already use **mind maps** (XMind, Coggle, MindMup, Obsidian Canvas) for research logs, brick walls, DNA-match clustering and migration tracing. Obsidian Canvas "functions almost like a living investigation board". — [Norwegian Genealogy blog](https://martinroe.com/blog/the-best-free-mind-mapping-software-for-genealogy-research/), [Family Tree Magazine](https://familytreemagazine.com/research/the-big-picture-using-mind-mapping-to-organize-research-ideas/), [Evidentia mind maps](https://evidentiasoftware.com/mind-maps/)

**General visual-notes competitors**
- **Scrintal** (visual cards with links, the closest analog to NoteMap): Pro **$9.99/mo**, free plan since June 2025. It targets researchers, educators and writers. — [search summary, Scrintal/Capterra](https://scrintal.com/pricing)

### Inferences
- Pricing splits into three tiers: **free hobby boards** ($0 to $10), **specialist prosumer** ($10 to $50/mo: SleuthStack, FactBox, espectrosint, Hunchly ~$14/mo equivalent), and **professional/enterprise** ($30 to $1,600/user/mo). NoteMap's current generic "3 boards free / Pro unlimited" model puts it in the hobby tier against many free or nearly free clones. To earn professional prices it needs vertical features, not just more boards.
- "Detective/evidence board" as a *consumer* category already has at least 5 low-end entrants (SleuthStack, detectiveboard.io, Cluero, CrazyWall, template makers). It is crowded at the bottom and thin on real professional-grade features.

### Gaps
- Graphistry, Miro, Milanote, Trello and MyHeritage 2026 prices could not be verified: search budget ran out, Milanote's pricing page returned 404, and MyHeritage geo-redirected.
- Gramps (free, open source) could not be confirmed: its site returned 403.
- Casetext was acquired by Thomson Reuters and folded into CoCounsel (from training knowledge, not verified this session). CoCounsel pricing is not verified.
- No public CaseMap+ AI list price was found; the FactBox $50 to $100 estimate is unverified.

---

## 2. What do users complain about? (real quotes)

### Takeaway
Across segments, the complaints are consistent:
- **Pro tools are too expensive and too hard.** Maltego and i2 have steep learning curves and per-seat prices over €1,500/yr.
- **Legal chronology tools are clunky and slow.** CaseMap+ AI draws "clunky", "slow", "broken source links".
- **Spreadsheets break down.** Excel can't link to sources or model relationships.
- **Hobbyists juggle generic tools.** Excel, OneNote and Evernote clippers are used side by side with no single board.

Reddit quotes could not be retrieved; the quotes below come from Capterra, Software Advice, Websleuths and Hacker News.

### Cited Findings
**Legal: CaseMap+ AI (Software Advice, 3.7/5 over 21 reviews; value for money 2.9/5)** — [Software Advice](https://www.softwareadvice.com/legal/casemap-profile/)
- "Inferior to CaseMap 14" / "slowed me down" / "Clunky, inconsistent shell" lacking Adobe integration — Kamee V., law practice
- "Text Source links are not working", which forced manual searches through 700+ pages — Randall M.
- "Takes so long to create facts" and "data storage failed us" — Deanna F., law practice
- "Convoluted process" for basic operations like adding documents — Michael P.
- CaseFleet's summary of CaseMap reviews cites "performance regressions," "slow document uploads," and opaque, sales-led pricing — [CaseFleet](https://www.casefleet.com/comparisons/casemap-alternative) (competitor)

**Legal: CaseFleet (Capterra)** — [Capterra](https://www.capterra.com/p/155618/CaseFleet/reviews/)
- Pro: "ability to create a factual chronology of a case by piecing together information" — Stephen S., Principal Attorney
- Pro: "best program I have found to manage evidence" — Deanna F., Paralegal
- Con: "visual timeline representation graphic was difficult to use if chronology incomplete" — Mark L., Legal consultant
- Con: "price point is somewhat high" — Stephen S., Principal Attorney
- Con: "Word doc is unmanageable and you have to convert to PDF" (exports) — Bryan S., trial counsel
- Con: wants "inline editing for all fields in list view rather than having to go into source" — David B., Attorney
- Con: "Customer support hours are limited depending on your time zone" — Risa B., Paralegal Manager

**Legal: why Excel fails for chronologies** (FactBox, a vendor): "No clickable link to the actual document"; can't filter by witness/issue/source at once; "uncontrolled versioning"; "Cannot model relationships, hierarchies, or connections"; reports need manual reformatting. — [FactBox](https://getfactbox.com/alternative/best-alternatives-to-excel-for-case-chronologies-in-2026)

**OSINT: Maltego**
- "People leave Maltego mainly over cost and its steep learning curve"; "Transforms, entities, and machines take time to master"; "Java desktop app plus data-hub configuration creates friction for simple queries". — [espectrosint](https://www.espectrosint.com/blog/maltego-alternatives) (competitor, July 2026)
- A Hacker News counterpoint (2020): in professional shops, "organisations use data-sources which are so exclusive and expensive that they dwarf Maltego, so nobody is concerned with the cost of a Maltego license." — [HN comment](https://news.ycombinator.com/item?id=22716921). **So price pain is felt by individuals and small shops, not agencies.**
- Hacker News (2022), a volunteer CIO at a human-trafficking nonprofit building their own investigations platform "because the options out there are either poor or very expensive." — [HN comment](https://news.ycombinator.com/item?id=30171755)
- Hacker News (2014) on i2 vs Palantir: "less automated data analytics and more chart drawing and semantic knowledge base management" — [HN comment](https://news.ycombinator.com/item?id=8327969). The core of these costly tools is chart drawing plus structured notes, which a canvas app could approximate.

**True crime (Websleuths, 2018–19)** — [Websleuths thread](https://www.websleuths.com/forums/threads/does-anyone-use-a-program-for-all-of-their-websleuth-research.394800/)
- "I have excel spreadsheets. I used to use notebooks or whatever it was called but excel is much better for me." — Tssiemer
- "I use OneNote... I love how I can easily collapse/expand things like bulleted lists." — Whiskers16
- Evernote's "main selling point for me (for all that I use the free version) is its web clipper functionality" — DangerousBeans. Note the phrase "the free version": this user is not paying.
- "I prefer Evernote, the web clipper is a fantastic tool for this sort of research." — Jane Gault

### Inferences
- **Top legal pain points:** fact entry is slow, links from a fact to the exact page of its source break, exports are poor (Word/PDF), and legacy tools are Windows-only. A fast Mac-native canvas with reliable source links and clean exports targets real pain.
- **Web capture/clipping is the most-cited need** among sleuths (Evernote clipper) and OSINT users (Hunchly exists for exactly this). A canvas without a browser clipper is a weaker fit.
- Hobbyists explicitly lean on free tiers, which signals low willingness to pay.

### Gaps
- No verbatim quotes from r/OSINT, r/Journalism, r/Lawyertalk, r/paralegal, r/Genealogy, r/UnresolvedMysteries, r/TrueCrimeDiscussion or r/privateinvestigators: Reddit is blocked for this agent. The report writer should flag this or the founder should read those threads manually.
- No G2 reviews (403) and no i2 Capterra reviews (404).

---

## 3. Unmet needs and the features a canvas app would need

### Takeaway
The recurring gaps are:
- **Per-card source provenance.** Each fact or card should link to the exact document/page/URL it came from.
- **Timeline and relationship board in one view.** Chronology tools lack a graph and graph tools lack a chronology.
- **Web capture with archiving and hashing.**
- **Local-first or encrypted storage.**
- **One-click court- or editor-ready exports** (chronology table, report).
- **Small-team collaboration at per-seat prices far below €7,500/yr.**

### Cited Findings
- Litigators want "source document connections with instant access", "multi-dimensional filtering by witness, issue, date, and tags", "hierarchical issue mapping", "automated report generation for depositions and motions" and "real-time team synchronization" — [FactBox](https://getfactbox.com/alternative/best-alternatives-to-excel-for-case-chronologies-in-2026)
- CaseFleet's core pitch is that every fact links "to a citation in its source document"; they also advertise an interactive visual timeline where CaseMap only offers static export, and cross-platform Mac/Windows/mobile access — [CaseFleet](https://www.casefleet.com/comparisons/casemap-alternative)
- Insurance-fraud/SIU software requirements: every upload, edit and note "automatically timestamped and logged with the user identity"; "immutable audit trails for court admissibility"; GPS-stamped mobile uploads; "court-ready document generation"; role-based access; **SOC 2 Type II** — [CROSStrax](https://www.crosstrax.co/case-management-software-for-insurance-fraud-investigators/)
- Solo PIs need a case hub, evidence tracking with chain of custody, client portals, mobile field notes, "SOC 2 Type II certification standard" and time tracking/billing — [CROSStrax solo PIs](https://www.crosstrax.co/software-for-solo-investigators/)
- OSINT tools emphasise "exportable evidence structures", "audit trails and source attribution" and "briefing packs" (OSINTracker) — [OSINT Newsletter](https://tools.osintnewsletter.com/osint-tools/osintracker). Hunchly's Classic tier stresses local storage and offline work — [Hunchly](https://hunch.ly/pricing)
- Obsidian's draw for OSINT is local-first privacy plus linking, and people are paying for courses and templates to bend it into an investigation tool — [Sherlockeye](https://sherlockeye.io/blog/using-obsidian-for-osint), [myosint.training](https://www.myosint.training/courses/osint-documentation-with-obsidian)
- Guides describe the value of Obsidian for journalists as connecting "what was found, where it came from, what it appears to show, what remains unverified, and how each fragment supports or weakens a publishable finding" — [search summary of OSINT/Obsidian guides](https://shadowdragon.io/resources/osint-techniques/). This describes card-level **verification status** fields.
- Genealogy's analogous need is claims extracted from sources, evidence evaluation and conflicts surfaced (Evidentia) — [Evidentia](https://evidentiasoftware.com/product/the-software-and-the-book/)
- SleuthStack's feature list (timeline builder, evidence locker, source manager with citation metadata, lead Kanban, victimology profiles) shows what hobbyists are being sold — [SleuthStack](https://sleuthstack.com/)

**Feature checklist for NoteMap, derived from the above (inference):**
1. Card-level source fields: URL, document + page, date captured, reliability/verification status (verified / unverified / disputed), plus tags for person/org/place/event.
2. Typed entity cards and labelled arrows, e.g. "owns", "called", "met", for a lightweight link chart.
3. A dated-card timeline view generated from the same cards, exportable as a chronology table (CSV/Word/PDF) with a source citation column.
4. Browser clipper: save a page or selection as a card with screenshot, archived copy and SHA-256 hash plus timestamp for provenance.
5. Filters and "lenses" by entity, issue, witness and tag.
6. Export to PDF report/briefing pack and PNG/SVG chart.
7. Encryption at rest, optional end-to-end encryption or local-only boards, and audit log of edits.
8. Small-team sharing with roles.

### Inferences
- Items 1, 3 and 6 are the smallest additions that turn NoteMap from a whiteboard into a tool for fact chronologies and investigation boards. They serve journalists, PIs, paralegals and genealogists at once.
- Items 4 and 7 (hashing, audit logs, E2EE) are what separates hobby use from professional use (court/SIU). Building them is feasible for a solo developer, but *certifying* them (SOC 2) is not cheap. See Section 4.

### Gaps
- No direct source was found on redaction needs.
- Rigorous user-research data on combining timeline and graph was not found. It is inferred from the separate existence of chronology tools (CaseFleet, Aeon) and link tools (Maltego, i2).

---

## 4. Willingness to pay, budgets, per-seat norms and compliance barriers

### Takeaway
Legal buyers are used to **$30 to $140/user/month** and small firms do pay it. OSINT/PI individuals will pay **~$150 to $350/yr** for a focused tool (Hunchly, espectrosint Pro) but balk at Maltego's €3,000 to €7,500. Hobbyists and genealogists cluster at **$0 to $10/mo** or one-time purchases ($40 to $65). Genealogists are the exception: they pay Ancestry ~$320 to $480/yr, but for *records*, not software. Compliance expectations (SOC 2 Type II, audit trails, HIPAA BAAs) are real in legal and SIU and are a meaningful barrier for a solo developer.

### Cited Findings
- **Legal per-seat norms:**
  - Clio $49 to $89+/user/mo (range $39 to $139) — [CostBench](https://costbench.com/software/ai-legal-tools/clio/)
  - MyCase $49 to $89 — [Deelo blog](https://www.deelo.ai/blog/best-private-investigator-software-2026)
  - CaseFleet $30 to $140 — [CaseFleet](https://www.casefleet.com/pricing)
  - TrialLine $59; FactBox $49/mo flat — [FactBox](https://getfactbox.com/alternative/best-alternatives-to-excel-for-case-chronologies-in-2026)
  - One CaseFleet reviewer (managing partner): "saved thousands each month with CaseFleet", but another found the "price point is somewhat high" — [Capterra](https://www.capterra.com/p/155618/CaseFleet/reviews/)
- **Small-firm tech adoption (ABA 2024 TechReport, released Mar 2025):** 73% of firms use cloud-based legal tools. Solos use remote access at 62%. Solos and 2–9 attorney firms "generally have fewer security features and policies" than larger firms. 60% of firms have formal cybersecurity policies. — [ABA TechReport via search summary](https://www.americanbar.org/groups/law_practice/resources/tech-report/2024/2024-solo-and-small-firm-techreport/) (the page itself returned 403; figures are from the search snippet)
- **Security norms:** CaseFleet advertises encryption in transit and at rest, an optional HIPAA BAA and SSO for Enterprise — [CaseFleet](https://www.casefleet.com/pricing). PI and SIU vendors cite **SOC 2 Type II** as the "standard" — [CROSStrax](https://www.crosstrax.co/software-for-solo-investigators/), [CROSStrax SIU](https://www.crosstrax.co/case-management-software-for-insurance-fraud-investigators/). Even the $10/mo hobby tool SleuthStack claims "SOC 2 Compliant" and "End-to-End Encryption" — [SleuthStack](https://sleuthstack.com/). Kumu reserves "sensitive data or specific geographic storage requirements" for its $20k+/yr Enterprise tier — [Kumu](https://docs.kumu.io/frequently-asked-questions/what-pricing-plans-does-kumu-have)
- **PI economics:** 43,600 US private detective/investigator jobs in 2024; median pay **$52,370** (May 2024); 6% projected growth for 2024–34 — [BLS OOH](https://www.bls.gov/ooh/protective-service/private-detectives-and-investigators.htm). PI case-management tools span free (Case Jacket) to $19/seat/mo (Deelo) — [search summary](https://www.deelo.ai/blog/best-private-investigator-software-2026)
- **OSINT individuals:** Hunchly at $169/yr is the de facto paid individual tool. espectrosint Pro is $29/mo. Maltego's lowest paid tier is €3,000/yr. — [Hunchly](https://hunch.ly/pricing), [espectrosint](https://www.espectrosint.com/blog/maltego-alternatives), [Maltego](https://www.maltego.com/pricing/)
- **Journalists:** IRE dues are $75/yr, and GIJN recommends mostly free tools (Gephi, NodeXL, Kumu's free tier) — [IRE](https://www.ire.org/join-ire/), [GIJN](https://gijn.org/resource/visualization-tools/)
- **Genealogists:** Ancestry $319 to $479/yr; RootsMagic $39.95 one-time; Evidentia $48 one-time; Aeon (used by some) $65 plus $35/yr — sources above. RootsTech in-person is $99 for 3 days, and online is free — [FamilySearch](https://www.familysearch.org/en/blog/rootstech-2026-registration)
- **Hobbyists:** SleuthStack $10 to $25/mo; Cluero $1.99/mo or $9.99 lifetime — [SleuthStack](https://sleuthstack.com/), [App Store](https://apps.apple.com/app/id6755574982)

### Inferences
- **Realistic price points for NoteMap per segment:**
  - Legal/litigation support: $25 to $60/user/mo if it produces a sourced chronology export.
  - OSINT/PI/freelance journalist: $12 to $25/mo ($120 to $250/yr) to match or undercut Hunchly and espectrosint.
  - True-crime hobbyists: $5 to $10/mo with high churn.
  - Genealogists: expect one-time or low-annual pricing culture ($30 to $60/yr).
- **Compliance barrier:** a formal SOC 2 Type II audit typically costs five figures and requires continuous controls (general industry knowledge, not verified in this session). Law firms and SIU/insurers increasingly ask for it in procurement. Solo attorneys, paralegals, freelance journalists and PIs usually buy by credit card without security questionnaires. A solo developer should target *individual professionals* first, and offer E2EE or local-only boards as the "security story" instead of certifications.

### Gaps
- No survey data on how much solo PIs or freelance journalists spend per year on software was found.
- No data on how law firms enforce security questionnaires or SOC 2 for small vendors. The ABA page was 403.
- Churn/retention figures for any of these tools were not found.

---

## 5. Community sizes and channels

### Takeaway
The consumer "sleuth" audience is huge but low-paying: r/UnresolvedMysteries has 4.5M members, r/TrueCrimeDiscussion 1.3M, r/RBI 874k, and Websleuths 243k registered users. The professional audiences are smaller but reachable: r/OSINT ~250k, r/Lawyertalk ~203k, r/paralegal ~80k, r/Journalism ~127k, IRE 3,000+ members, and 43,600 US PIs. Genealogy is large (r/Genealogy ~209k; Ancestry has 3M+ payers).

### Cited Findings
- **Subreddits (GummySearch snapshots; the snapshot date is unknown and likely 2025, so treat as approximate):** — [GummySearch](https://gummysearch.com/r/OSINT/)
  - r/UnresolvedMysteries 4.5M
  - r/TrueCrimeDiscussion 1.3M
  - r/cybersecurity 1.5M
  - r/LawSchool 947k
  - r/RBI (Reddit Bureau of Investigation) 874k
  - r/UnsolvedMysteries 559k
  - r/OSINT 251k (another search summary gives 246k)
  - r/Genealogy 209k (207k elsewhere)
  - r/Lawyertalk 203k
  - r/AncestryDNA 172k
  - r/Journalism 127k
  - r/paralegal 80k
  - r/Ancestry 26k
  - r/PrivateInvestigator 5k
  - The r/privateinvestigators count could not be retrieved.
  - Cross-checks: [GummySearch r/UnresolvedMysteries](https://gummysearch.com/r/UnresolvedMysteries/), [GummySearch r/Genealogy](https://gummysearch.com/r/Genealogy/)
- **Websleuths:** 243,518 registered members (Oct 2025), ~633k threads and 18.6M posts; founded 1999 and owned by Tricia Griffith, who hosts a weekly podcast. Registrations were ~137k in 2018. — [Wikipedia](https://en.wikipedia.org/wiki/Websleuths)
- **CrimeCon:** a true-crime fan convention; CrimeCon 2027 is in Orlando, Sept 24–26, 2027 — [CrimeCon](https://www.crimecon.com/5-essential-tools-for-the-armchair-detective)
- **IRE:** 3,000+ members — [IRE](https://www.ire.org/about-ire/). **GIJN** publishes tool guides — [GIJN](https://gijn.org/resource/visualization-tools/)
- **OSINT newsletters and training:** Project OSINT Substack — [Project OSINT](https://projectosint.substack.com/p/project-osint-tuesday-5-may-2026); the OSINT Newsletter tools library — [osintnewsletter](https://tools.osintnewsletter.com/osint-tools/osintracker); myosint.training — [link](https://www.myosint.training/courses/osint-documentation-with-obsidian); the Bellingcat Online Investigation Toolkit, which lists tools like Hunchly — [Bellingcat toolkit](https://bellingcat.gitbook.io/toolkit/more/all-tools/hunchly)
- **Legal-tech media:** LawSites/LawNext (Bob Ambrogi) — [LawSites](https://www.lawnext.com/2022/02/at-long-last-casemap-moves-to-the-cloud.html); the ABA Law Practice Division TechReport — [ABA](https://www.americanbar.org/groups/law_practice/resources/tech-report/)
- **Genealogy:** RootsTech (Salt Lake City plus online; "millions of participants from over 200 countries" in 2025 per FamilySearch) — [FamilySearch](https://www.familysearch.org/en/blog/rootstech-2026-registration); Family Tree Magazine; Genea-Musings; Cyndi's List mind-mapping page — [Cyndi's List](https://www.cyndislist.com/charts/mind-mapping/)

### Inferences
- The true-crime audience is the biggest top-of-funnel for content marketing, e.g. publishing a "case board" of a famous cold case as a shareable NoteMap board. Monetisation per user will be low.
- r/OSINT, the Bellingcat toolkit (listing requests), OSINT newsletters, and LawSites/paralegal communities are cheap, targeted channels for the higher-value professionals.

### Gaps
- Bellingcat Discord/community size, OSINT Discord sizes, OSINT Twitter/X reach, true-crime podcast audience numbers, CrimeCon attendance, genealogy Facebook group sizes and RootsTech 2026 attendance were all not retrieved: the search budget was exhausted.

---

## 6. Which segment is most promising for a solo developer, and what are the barriers?

### Takeaway
A **"sourced case board" for individual professional investigators** looks most promising. The core targets are freelance and small-newsroom **investigative journalists, OSINT analysts and solo PIs**, with **paralegals/solo litigators** as a second target through a chronology export. The reasons:
- they have a clear pain and an obvious price gap (between free Obsidian/OSINTracker and €3,000+ Maltego);
- they buy individually by credit card without SOC 2 procurement;
- they value Mac-native, local-first or encrypted tools.

True-crime hobbyists are a large but low-paying acquisition channel. Genealogists are large but anchored to one-time pricing and tree-centric tools. Insurance SIU and larger law firms are enterprise sales with compliance gates that are unsuitable for a solo founder.

### Cited Findings (supporting evidence)
- Price gap: Maltego €3,000 to €7,500/yr vs Hunchly $169/yr vs free OSINTracker/Obsidian — [Maltego](https://www.maltego.com/pricing/), [Hunchly](https://hunch.ly/pricing), [OSINTracker](https://www.osintracker.com/)
- Individuals are demonstrably paying for workarounds: Obsidian-for-OSINT courses and templates — [myosint.training](https://www.myosint.training/courses/osint-documentation-with-obsidian), [Gumroad](https://numbpilled.gumroad.com/l/obsidianosint)
- Legal chronology incumbents score low on value (CaseMap+ AI 2.9/5 value for money) and are slow and clunky — [Software Advice](https://www.softwareadvice.com/legal/casemap-profile/). Legal buyers already pay $30 to $140/user/mo — [CaseFleet](https://www.casefleet.com/pricing)
- A direct hobbyist competitor with the same freemium shape (3 free cases, $10/$25) already exists — [SleuthStack](https://sleuthstack.com/). Several free boards also exist — [detectiveboard.io](https://www.detectiveboard.io/), [CrazyWall](https://github.com/0xsha/CrazyWall)
- Hobbyists self-report relying on free tiers ("for all that I use the free version") — [Websleuths](https://www.websleuths.com/forums/threads/does-anyone-use-a-program-for-all-of-their-websleuth-research.394800/)
- SIU buyers need SOC 2 Type II, immutable audit trails and claims-system integrations — [CROSStrax](https://www.crosstrax.co/case-management-software-for-insurance-fraud-investigators/). Small carriers buy packaged platforms (Shift, FRISS, Verisk) — [Carpe](https://carpe.io/solutions/case-management/)
- The genealogy software culture is one-time purchase: RootsMagic $39.95, Evidentia $48 — [RootsMagic](https://www.rootsmagic.com/rootsmagic/buy), [Evidentia](https://evidentiasoftware.com/product/the-software-and-the-book/)

### Segment scorecard (inference, based on the findings above)
| Segment | Pain / gap | WTP per user | Reachability | Compliance barrier | Solo-dev fit |
|---|---|---|---|---|---|
| (a) Investigative journalists (freelance/small) | High (sources, verification, connections) | Low–mid ($5–20/mo; often grant/newsroom paid) | Good (GIJN, IRE, Bellingcat toolkit) | Low–medium (source protection → E2EE wanted) | **Good** |
| (b) OSINT analysts (individual/consultant) | High (Maltego gap) | Mid ($12–30/mo) | Good (r/OSINT 250k, newsletters) | Low for individuals, high for agencies | **Best** |
| (c) Private investigators (solo) | Medium–high (reports, link charts) | Mid ($15–40/mo) | Medium (small subreddits, associations) | Medium (clients may ask; SOC 2 cited as "standard") | Good |
| (d) Lawyers/paralegals (solo/small) | High (chronology, sources, exports) | High ($30–140/user/mo) | Medium (conservative buyers) | Medium–high (encryption, BAA, security reviews) | Good if chronology export is excellent; harder sales |
| (e) Insurance SIU / compliance / DD | Medium (served by enterprise platforms) | Very high but enterprise | Poor | **High** (SOC 2 Type II, audit trails, integrations) | Poor |
| (f) True-crime hobbyists / podcasters | Medium (juggling Excel/OneNote/Evernote) | Low ($0–10/mo) | Excellent (millions) | Low | Good for acquisition, weak for revenue |
| (g) Genealogists | Medium (brick walls, evidence analysis) | Low (one-time $40–65 norm) | Good (r/Genealogy, RootsTech) | Low | Moderate: needs GEDCOM/tree integration |

### Inferences
- **Recommended wedge:** market NoteMap as an "evidence board with sources" for OSINT, journalists and PIs at ~$12 to $20/mo. Pair it with a "Legal/Chronology" tier at ~$39 to $59/user/mo once dated cards can export a sourced chronology. Use true-crime public boards as free top-of-funnel content.
- **Barriers:**
  1. Credibility and security. Professionals will ask where the data lives; the cloud sync must offer encryption and ideally E2EE or local-only boards.
  2. Web capture is expected (Hunchly sets the bar).
  3. Free substitutes: Obsidian Canvas, OSINTracker and Kumu public projects.
  4. Legal buyers want integrations with document storage (Clio/NetDocs) and polished Word/PDF exports.
  5. Maltego, CaseMap and CaseFleet are adding AI (entity extraction, summarisation), raising the feature bar.
- NoteMap's native macOS app is a differentiator against Windows-only classic CaseMap and Java-based Maltego. Mac share among journalists and freelancers is plausibly high, but this was not verified.

### Gaps
- No quantitative data on the Mac vs Windows split among investigators or lawyers.
- No retention or churn benchmarks for any of these niches.
- No firsthand evidence (e.g., Reddit threads) of OSINT or journalist users explicitly requesting a "cheap Maltego-like canvas"; the demand is inferred from paid Obsidian courses and templates and from competitor positioning.
