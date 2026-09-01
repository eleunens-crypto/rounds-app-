15:20:58.696 Running build in Washington, D.C., USA (East) – iad1
15:20:58.697 Build machine configuration: 2 cores, 8 GB
15:20:58.862 Cloning github.com/eleunens-crypto/rounds-app- (Branch: main, Commit: 83574da)
15:20:59.881 Cloning completed: 1.019s
15:20:59.987 Restored build cache from previous deployment (2Eq9mjDzdYwexFbB4xmoNsyhbKCa)
15:21:00.270 Running "vercel build"
15:21:00.305 Vercel CLI 59.3.0
15:21:00.707 Installing dependencies...
15:21:02.067 
15:21:02.067 up to date in 1s
15:21:02.067 
15:21:02.067 164 packages are looking for funding
15:21:02.067   run `npm fund` for details
15:21:02.069 npm warn allow-scripts 3 packages have install scripts not yet covered by allowScripts:
15:21:02.070 npm warn allow-scripts   sharp@0.34.5 (install: node install/check.js || npm run build)
15:21:02.071 npm warn allow-scripts   tesseract.js@7.0.0 (postinstall: opencollective-postinstall || true)
15:21:02.071 npm warn allow-scripts   unrs-resolver@1.11.1 (postinstall: napi-postinstall unrs-resolver 1.11.1 check)
15:21:02.071 npm warn allow-scripts
15:21:02.071 npm warn allow-scripts Run `npm approve-scripts --allow-scripts-pending` to review, or `npm approve-scripts <pkg>` to allow.
15:21:02.101 Detected Next.js version: 16.2.5
15:21:02.109 Running "npm run build"
15:21:02.226 
15:21:02.227 > rounds-app@0.1.0 build
15:21:02.227 > next build
15:21:02.227 
15:21:02.874   Applying modifyConfig from Vercel
15:21:03.008 ▲ Next.js 16.2.5 (Turbopack)
15:21:03.008 
15:21:03.040   Creating an optimized production build ...
15:21:11.371 ✓ Compiled successfully in 8.0s
15:21:11.371   Running TypeScript ...
15:21:26.040 Failed to type check.
15:21:26.041 
15:21:26.043 ./app/table/page.tsx:399:64
15:21:26.043 Type error: Property 'errCantReadPhoto' does not exist on type '{ seatsCappedGuest: (n: number) => string; backToRundo: string; welkomSub: string; cafeAfterQ: string; seeWhatItDoes: string; partyTagline1: string; partyTagline2: string; partyStep1: string; ... 612 more ...; itemsAddedCheck: (n: number) => string; } | { ...; }'.
15:21:26.043   Property 'errCantReadPhoto' does not exist on type '{ seatsCappedGuest: (n: number) => string; backToRundo: string; welkomSub: string; cafeAfterQ: string; seeWhatItDoes: string; partyTagline1: string; partyTagline2: string; partyStep1: string; ... 612 more ...; itemsAddedCheck: (n: number) => string; }'.
15:21:26.044 
15:21:26.044   397 |       resolve(res.includes(",") ? res.split(",")[1] : res)
15:21:26.044   398 |     }
15:21:26.044 > 399 |     reader.onerror = () => reject(new Error(STRINGS[getLang()].errCantReadPhoto))
15:21:26.044       |                                                                ^
15:21:26.044   400 |     reader.readAsDataURL(file)
15:21:26.044   401 |   })
15:21:26.044   402 | }
15:21:26.103 Next.js build worker exited with code: 1 and signal: null
15:21:26.154 Error: Command "npm run build" exited with 1
