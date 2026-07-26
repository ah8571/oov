# Metro Dev Build Cheat Sheet

## Start the dev server
```powershell
cd C:\Code\emmaline
npm run dev:mobile
```

On phone: 
## Metro keyboard shortcuts (press these in the Metro terminal)
| Key | Action |
|-----|--------|
| `a` | Open Android (builds + launches the app on connected device) |
| `r` | Reload the app |
| `m` | Toggle dev menu on device |
| `j` | Open debugger in browser |
| `?` | Show all commands |

## If Metro is already running but phone isn't connected
- Press `a` in the Metro terminal
- Or run in a separate terminal:
```powershell
cd C:\Code\emmaline\mobile
npx expo run:android
```
On phone: exp://192.168.1.153:8081

## Restart fresh
```powershell
# Kill Metro (Ctrl+C in its terminal), then:
cd C:\Code\emmaline
npm run dev:mobile
# Wait for QR code, then press a
```

## Build a new dev APK (if code changes need a rebuild)
```powershell
cd C:\Code\emmaline\mobile
npx eas build --profile development --platform android
```
