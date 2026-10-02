# Auth Page — Password Strength Meter + Generator

## Task
Add password strength classification (fraca/média/forte) with visual meter + strong password suggestion button on the registration form.

## What Was Done

### File: `src/pages/Auth.tsx` (commit `29642ab`)

#### Password Strength Meter
- **5-criteria scoring system** (0-5 points):
  1. Length ≥ 8 characters
  2. Mixed case (uppercase + lowercase)
  3. Contains digits
  4. Contains special characters (!@#$%&*)
  5. Length ≥ 12 characters

- **3 levels with visual indicators:**
  | Score | Level | Color | Icon |
  |-------|-------|-------|------|
  | 0-1 | Fraca | Red | ShieldAlert |
  | 2-3 | Média | Yellow | Shield |
  | 4-5 | Forte | Green | ShieldCheck |

- **UI components:**
  - Colored background card appears when user types password
  - Icon + label ("Senha Fraca/Média/Forte")
  - 5-bar progress indicator (fills based on score)
  - Bullet list of improvement tips (only shows missing criteria)
  - Tips are in Portuguese, actionable: "Use pelo menos 8 caracteres", "Misture letras maiúsculas e minúsculas", etc.

#### Strong Password Generator
- **Button**: "🔐 Sugerir senha forte" below the password field
- **Algorithm**: Uses `crypto.getRandomValues()` (CSPRNG — cryptographically secure)
  - Generates 16-character passwords
  - Guarantees at least 1 lowercase, 1 uppercase, 1 digit, 1 special char
  - Excludes ambiguous chars: l,1,I,o,0,O (to prevent user confusion)
  - Shuffles output so pattern isn't predictable
- **One-click fill**: Clicking the button fills the input AND triggers React state update + strength meter re-evaluation

#### Technical Details
- New state: `registerPassword` (controlled input for strength tracking)
- `PasswordInput` component extended with optional `value`/`onChange` props (backward compatible — login still works without them)
- Strength recalculates on every keystroke (no debounce needed for this simplicity)
- No external dependencies — pure TypeScript + lucide-react icons already in project

## Build
- `npm run build` ✅ passed (5.20s, only chunk size warning)
- Committed and pushed: `29642ab`
