16:02:40.624 Running build in Washington, D.C., USA (East) – iad1
16:02:40.625 Build machine configuration: 2 cores, 8 GB
16:02:40.751 Cloning github.com/eleunens-crypto/rounds-app- (Branch: main, Commit: 30aaff0)
16:02:41.644 Cloning completed: 892.000ms
16:02:41.866 Restored build cache from previous deployment (ApamSSBvgsYrNms6KfvMTEUVn3yC)
16:02:42.045 Running "vercel build"
16:02:42.060 Vercel CLI 56.5.0
16:02:42.222 Installing dependencies...
16:02:43.341 
16:02:43.341 up to date in 1s
16:02:43.342 
16:02:43.342 164 packages are looking for funding
16:02:43.342   run `npm fund` for details
16:02:43.370 Detected Next.js version: 16.2.5
16:02:43.375 Running "npm run build"
16:02:43.468 
16:02:43.469 > rounds-app@0.1.0 build
16:02:43.469 > next build
16:02:43.469 
16:02:44.026   Applying modifyConfig from Vercel
16:02:44.091 ▲ Next.js 16.2.5 (Turbopack)
16:02:44.091 
16:02:44.119   Creating an optimized production build ...
16:02:50.670 ✓ Compiled successfully in 6.2s
16:02:50.676   Running TypeScript ...
16:03:01.627 Failed to type check.
16:03:01.627 
16:03:01.629 ./app/party/page.tsx:1268:9
16:03:01.629 Type error: Type '(Drink | { id: string; name: string; emoji: string; cat: string; price: number; cup: boolean; fav: boolean; coins: number; custom: boolean; by: string; })[]' is not assignable to type 'Drink[]'.
16:03:01.629   Type 'Drink | { id: string; name: string; emoji: string; cat: string; price: number; cup: boolean; fav: boolean; coins: number; custom: boolean; by: string; }' is not assignable to type 'Drink'.
16:03:01.630     Type '{ id: string; name: string; emoji: string; cat: string; price: number; cup: boolean; fav: boolean; coins: number; custom: boolean; by: string; }' is not assignable to type 'Drink'.
16:03:01.630       Types of property 'cat' are incompatible.
16:03:01.630         Type 'string' is not assignable to type 'Cat'.
16:03:01.630 
16:03:01.630   1266 |   // De vaste catalogus staat in de code (nul queries per gast). Eigen drankjes komen
16:03:01.630   1267 |   // uit de groep-rij, die we toch al ophalen — dus ook nul extra queries.
16:03:01.630 > 1268 |   const drinks: Drink[] = useMemo(() => [
16:03:01.630        |         ^
16:03:01.630   1269 |     ...DEMO_DRINKS,
16:03:01.630   1270 |     ...customDrinks.map((c) => ({
16:03:01.630   1271 |       id: c.key, name: c.name, emoji: "⭐", cat: "Eigen", price: Number(c.price),
16:03:01.669 Next.js build worker exited with code: 1 and signal: null
16:03:01.707 Error: Command "npm run build" exited with 1
