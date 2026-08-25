# FIRMA23 UI reference catalog

Status: approved design and dependency decisions. References are interaction and
composition inputs, never trusted drop-in code.

## Catalog

| Reference | Decision | FIRMA23 placement and constraints |
| --- | --- | --- |
| [Statistics Card 1](https://21st.dev/@sean0205/components/statistics-card-1) | Adapt | Compact exact metrics on Projects and Profiles. No fake deltas, decorative color or uniform money/status treatment. |
| [Progress Metric Card](https://21st.dev/@makviesainte/components/progress-metric-card) | Preserve | Existing `FinanceMetricCard` is the truthful adaptation. No chart until real history; no Recharts or Lucide. |
| [Statistics Card 7](https://21st.dev/@sean0205/components/statistics-card-7) | Extract | Use comparison density for project counts and member outcomes, without colored trends. |
| [Advanced Stats](https://21st.dev/@uilayout.contact/components/advanced-stats) | Preserve | Existing finance composition already contains its useful hierarchy. Reject chart, scroll reveals and invented analytics. |
| [Folder Interaction](https://21st.dev/@0xUrvish/components/folder-interaction) | Adapt | Admin intake document packet. CSS motion follows selected and processed evidence; never decorative completion. |
| [File Tree](https://21st.dev/@justinlevinedotme/components/file-tree) | Extract | Collapsible source/evidence outline. Never present source documents as a fake local filesystem. |
| [AI Input](https://21st.dev/@aghasisahakyan1/components/ai-input) | Defer | Requires an AI command/action contract. AI may draft or explain, never approve or mutate finance. |
| [Registration Stepper](https://21st.dev/@ravikatiyar162/components/registration-stepper) | Adapt | Intake phases: Documento, Extracción, Revisión, Confirmación. Completion derives from state; no Framer or Lucide. |
| [Order Tracking](https://21st.dev/@javierdev0/components/order-tracking) | Extract | Semantic process timeline for milestones, intake and provenance. Remove commerce language and invented timestamps. |
| [File Card Collections](https://21st.dev/@urmauur/components/file-card-collections) | Adapt | Selected source file and intake evidence cards. No fake size, author, status or remote icons. |
| [Scroll Area with Sheet](https://21st.dev/@bundui/components/scroll-area2) | Defer | Evidence/document drawer only after an accessible shared dialog exists. No Radix install or nested cards. |
| [PDF Viewer](https://21st.dev/@extend-hq/components/pdf-viewer) | Defer/spike | Evaluate private URLs, workers/CSP, bundle, SSR, mobile, selection and accessibility. Visual lanes cannot land a dependency. |
| [Success Note](https://21st.dev/@shugar/components/note/success) | Adapt | Shared inline notice for synthetic, unavailable, processing and confirmed states. Success follows authority response only. |
| [HeroUI Table](https://21st.dev/@hero_ui/components/heroui-table/custom-cells) | Extract | Sorting and custom-cell reference only. Do not install HeroUI or its styles. |
| [Project Data Table](https://21st.dev/@ravikatiyar162/components/project-data-table) | Extract | Projects desktop records, recomposed as mobile rows. No Framer, CVA, Lucide or remote avatars. |
| [Server Management Table](https://21st.dev/@isaiahbjork/components/server-management-table) | Extract | Dense operational status/action grammar. Reject server copy, realtime claims and demo start/stop actions. |
| [Project Detail View](https://21st.dev/@kavikatiyar/components/project-detail-view) | Adapt | Project header, services, opportunities and rule history from existing models. No dark dashboard transplant. |
| [Project Pulse Tracker](https://21st.dev/@ruixen.ui/components/project-pulse-tracker) | Adapt | Opportunity milestones and assigned crew. Project health waits for a real aggregate model; no invented health score. |
| [Kanban Board](https://21st.dev/@dhileepkumargm/components/ultra-quality-kanban-board) | Defer | Requires audited task mutation and mobile drag alternatives. `localStorage` is never operational authority. |
| [Animated Beam](https://21st.dev/@dillionverma/components/animated-beam) | Adapt later | `/admin/compute` provenance after `integration_connections` exists. Static/degraded/disconnected states do not animate as live. |
| [Loading State](https://21st.dev/@theshanelevine/components/loading-state) | Adapt | AI intake and connector processing. Keep pixel-grid wave; omit elapsed time without a real start timestamp. |
| [Material Dropdown](https://21st.dev/@easemize/components/material-ui-dropdown-menu) | Extract | Keyboard and drill-down behavior only. No MUI, Radix, ripple engine, cinematic sweep or dependency. |
| [Privacy Switches](https://21st.dev/@cnippet.dev/components/v-switch-12) | Adapt later | Compute consent and connector capabilities. Toggle calls an authorized boundary; it never grants access locally. |
| [GitHub Shooter](https://21st.dev/@jahirulislamrayhan07/components/retro-space-shooter-git-hub-calendar) | Reject V1 | Optional experiment only after privacy/artifact contracts. Commits never create XP, earnings or rank. |
| [8-bit Game Progress](https://21st.dev/@theorcdev/components/8bit-game-progress) | Adapt later | Member level/XP after versioned `xp_events`. Use hand-authored pixel styling, not 8bitcn/CVA/tw-animate. |
| [8-bit Stats](https://21st.dev/@theorcdev/components/8bit-advanced2) | Extract later | Player progress grammar. Never create token, spend, LOC or commit leaderboards. |
| [Glass Profile Card](https://21st.dev/@beratberkayg/components/glassmorphism-profile-card) | Extract | Identity focal hierarchy only. Reject glass, blur, neon, photos, remote avatars and Framer Motion. |
| [Dashboard 1](https://21st.dev/@ravikatiyar162/components/dashboard-1) | Preserve | Existing Revenue Rail and compact crew concepts are the accepted extraction. Reject hours, fake people, count-up money and springs. |
| [Community Support](https://21st.dev/@preetsuthar17/components/community-support-block) | Defer | Community/chat is post-MVP and requires moderation, persistence and permissions. |
| [3D Pin](https://21st.dev/@manuarora700/components/3d-pin) | Reject | Gradient and hover-only interaction conflict with the system and have no operational target. |

## Extraction rules

- Read and audit complete reference source before implementation.
- Use FIRMA23 routes, copy, view models, permissions and repository data.
- Remove foreign branding, fake metrics, demo routes, placeholder people,
  `console.log` actions and invented financial information.
- Prefer existing React, Tailwind, Geist, `cn()`, tokens and hand-authored icons.
- Do not create `components/ui` by default and do not initialize shadcn.
- Components do not import `src/data/**`; financial rules stay in repositories
  and fixtures.
- No reference authorizes a runtime dependency.

## Shared decisions

- Metrics stay purpose-specific: `OperationalHeader`, `FinanceMetricCard` or
  route-local `dl` compositions.
- One future Integrator-owned `ProcessTimeline` may serve intake, milestones and
  provenance after repeated real demand.
- One responsive record grammar serves desktop tables and mobile lists.
- Revenue Rail is allocation-only; operational and XP progress remain separate.
- A shared menu or notice pattern lands only through Integrator ownership after
  repeated route requests.

## Later triggers

| Deferred area | Trigger before implementation |
| --- | --- |
| AI command input | Frozen command/action contract with authorization and audit behavior. |
| Evidence sheet | Accessible shared dialog primitive and two route requests. |
| PDF viewer | Private-document spike passes SSR/CSP, bundle, keyboard and mobile gates. |
| Kanban | Audited task mutation boundary plus non-drag mobile controls. |
| Compute connections | `integration_connections` and truthful connection-state model exist. |
| Privacy switches | Authorized capability and consent mutation boundary exists. |
| XP/player progression | Versioned `xp_events` and anti-gaming rules exist. |
| Community/chat | Persistence, moderation and permission model approved. |
| Historical charts | Two complete comparable periods in a frozen model. |

## Prohibited dependencies

V1 adds zero runtime dependencies. Explicitly prohibited: Framer Motion,
`motion`, Lucide, Recharts, HeroUI, MUI, Radix dropdown/progress, CVA,
`tw-animate`, `next-themes` and remote demo assets.
