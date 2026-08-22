# Environment Variables

## One file to edit

All environment variables live in the **root `.env`** — the single source of truth:

```bash
cp .env.example .env    # once
# fill in values, then:
pnpm run env:sync       # also runs automatically before `pnpm run dev`
```

`env:sync` (`scripts/sync-env.js`) generates the files the toolchains require:

```
.env  ──►  frontend/.env.local   (read by Next.js)
      ──►  backend/.env          (read by the Firebase Functions CLI)
```

**Never edit the generated files** — they carry a header saying so, and the next sync overwrites them. All three files are gitignored.

## Variables (defined in root `.env`)

| Variable | Secret | Required | Description |
|---------|--------|----------|-------------|
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | No | Yes | Firebase project id — must match `.firebaserc`. Synced under the same name to both frontend and backend. |
| `FIREBASE_SERVICE_ACCOUNT_KEY_BASE64` | **Yes** | Yes | Base64-encoded service account JSON. Synced to both packages; server-only in each. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | No | Yes | Firebase web app config → `apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | No | Yes | Web app config → `authDomain` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | No | Yes | Web app config → `messagingSenderId` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | No | Yes | Web app config → `appId` |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | No | No | Web app config → `measurementId` (only if Analytics is on) |
| `NEXT_PUBLIC_APP_URL` | No | Yes | Public app URL (`http://localhost:3000` locally) |
| `NEXT_PUBLIC_APP_NAME` | No | Yes | App display name |
| `CORS_ORIGIN` | No | No | Allowed CORS origin for the API (empty = deny all cross-origin) |
| `PORT` | No | No | Local Functions dev server port (default `5001`) |
| `COS_ENDPOINT` | No | Yes* | IBM Cloud Object Storage endpoint URL for your bucket's region |
| `COS_API_KEY_ID` | **Yes** | Yes* | IBM Cloud IAM API key from the Object Storage service credential |
| `COS_INSTANCE_CRN` | No | Yes* | Object Storage instance CRN (`serviceInstanceId`), from the same service credential |
| `COS_BUCKET_NAME` | No | Yes* | Name of the bucket the backend reads/writes hazard imagery to |
| `STITCH_API_KEY` | **Yes** | No | Google Stitch key for the Claude Code MCP (stays in root `.env` only) |

\* Required only once a feature actually calls `lib/objectStorage.ts` — the backend still starts and every other route still works with these unset, same lazy-init reasoning as Firebase.

`NEXT_PUBLIC_*` values are compiled into the browser bundle — that prefix must **never** appear on a secret (a Claude Code hook blocks this).

## Generating the Service Account Key (Base64)

1. Go to **Firebase Console → Project Settings → Service Accounts**
2. Click **Generate new private key** — save the JSON file securely
3. Convert to base64:
   ```bash
   # macOS (BSD base64 — no -w flag)
   base64 -i service-account.json | tr -d '\n'

   # Linux (GNU base64)
   base64 -w 0 service-account.json

   # Windows PowerShell (single quotes around the path)
   [Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\path\service-account.json'))
   ```
4. Paste the result as `FIREBASE_SERVICE_ACCOUNT_KEY_BASE64` in `.env`, run `pnpm run env:sync`
5. Delete the JSON file — it now lives in the env var

**Never commit the service account JSON or the base64 string to version control.**

## Generating IBM Cloud Object Storage Credentials

This project uses the IAM API key auth style (not HMAC):

1. IBM Cloud console → your **Object Storage** instance (create one first if
   it doesn't exist yet — "Create resource" → search "Object Storage")
2. **Buckets** → create a bucket if you don't have one yet → copy its name
   into `COS_BUCKET_NAME`
3. On the bucket's **Configuration** tab (or the instance's **Endpoints**
   page), copy the **public endpoint** for your bucket's region into
   `COS_ENDPOINT` (e.g. `https://s3.au-syd.cloud-object-storage.appdomain.cloud`)
4. Instance's left nav → **Service credentials** → **New credential**
   - Leave **Include HMAC Credential** **unchecked** (this project reads the
     IAM API key + instance CRN, not HMAC access/secret keys)
   - **Add**, then **View credentials** on the new entry
5. From the JSON shown, copy:
   - `apikey` → `COS_API_KEY_ID`
   - `resource_instance_id` → `COS_INSTANCE_CRN`
6. Run `pnpm run env:sync` from the repo root, then verify the real
   connection works:
   ```bash
   pnpm --filter backend run test:cos-connectivity
   ```
   This uploads a small test object to your real bucket, reads it back,
   and deletes it — confirming the credentials actually work, not just
   that they're filled in. See `backend/src/lib/objectStorage.ts` for the
   client itself.

**If your team generated HMAC credentials instead** (checked that box in
step 4), the SDK config shape is different (`accessKeyId`/`secretAccessKey`
rather than `apiKeyId`/`serviceInstanceId`) — flag this in the team channel
before changing `lib/objectStorage.ts`, since it changes the auth code, not
just the env values.

## Production Secrets (GitHub Actions)

The root `.env` is for local development only. For CI/CD, add repository secrets in **GitHub → Settings → Secrets → Actions**:

- All `NEXT_PUBLIC_FIREBASE_*` variables
- `NEXT_PUBLIC_APP_NAME`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_KEY_BASE64`

See `docs/CI-CD.md` for the full list and how they're used.

## Adding a New Variable

Use the `/add-env-var` Claude Code skill — it updates `.env.example`, `scripts/sync-env.js` (so the value reaches the right package), and this file consistently.
