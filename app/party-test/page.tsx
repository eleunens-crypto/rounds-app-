17:07:37.190 Running build in Washington, D.C., USA (East) – iad1
17:07:37.190 Build machine configuration: 2 cores, 8 GB
17:07:37.315 Cloning github.com/eleunens-crypto/rounds-app- (Branch: main, Commit: 83a957d)
17:07:37.855 Cloning completed: 540.000ms
17:07:38.429 Restored build cache from previous deployment (9oGWDab3DwHXGBt89hY76jDxBtRh)
17:07:38.671 Running "vercel build"
17:07:38.689 Vercel CLI 55.0.0
17:07:39.043 Installing dependencies...
17:07:40.583 
17:07:40.583 up to date in 1s
17:07:40.584 
17:07:40.584 164 packages are looking for funding
17:07:40.585   run `npm fund` for details
17:07:40.611 Detected Next.js version: 16.2.5
17:07:40.616 Running "npm run build"
17:07:40.715 
17:07:40.716 > rounds-app@0.1.0 build
17:07:40.717 > next build
17:07:40.717 
17:07:41.316   Applying modifyConfig from Vercel
17:07:41.393 ▲ Next.js 16.2.5 (Turbopack)
17:07:41.394 
17:07:41.424   Creating an optimized production build ...
17:07:49.462 ✓ Compiled successfully in 7.4s
17:07:49.467   Running TypeScript ...
17:08:01.108 Failed to type check.
17:08:01.109 
17:08:01.109 ./app/party-test/page.tsx:812:74
17:08:01.110 Type error: This comparison appears to be unintentional because the types 'string' and 'number' have no overlap.
17:08:01.110 
17:08:01.110   810 | ... string) => { const next = cardPayers.includes(id) ? cardPayers.filter((x) => x !== id...
17:08:01.110   811 | ...{ const all = people.map((p) => p.id); setCardPayers(all); applyCard(all, cardValue) }
17:08:01.110 > 812 | ...mber) => { const r = potRounds.find((x) => x.id === id); if (!r) return; setEditPotId(...
17:08:01.111       |                                               ^
17:08:01.111   813 | ...
17:08:01.111   814 | ...turn
17:08:01.111   815 | ... {
17:08:01.151 Next.js build worker exited with code: 1 and signal: null
17:08:01.206 Error: Command "npm run build" exited with 1
