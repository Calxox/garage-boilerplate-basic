import { CloudantV1 } from '@ibm-cloud/cloudant'
import { IamAuthenticator } from 'ibm-cloud-sdk-core'

/**
 * IBM Cloudant — sole entry point (mirrors src/lib/objectStorage.ts and,
 * longer-term, replaces src/lib/firebase.ts's adminDb/Firestore usage).
 *
 * Lazy singleton: the client is only constructed on first use, so importing
 * this module (or anything that imports it) never throws just because the
 * CLOUDANT_* env vars aren't set yet — the error surfaces at the first
 * actual call instead, same reasoning as objectStorage.ts and the
 * frontend's lazy Firebase admin init.
 *
 * Auth model: IBM Cloud IAM API key (CLOUDANT_APIKEY against CLOUDANT_URL),
 * not the legacy Cloudant username/password pair.
 *
 * Cloudant is document-based like Firestore, but flat: there's no nested
 * collection hierarchy, just named databases full of JSON documents. Each
 * logical "collection" (e.g. users) should get its own Cloudant database —
 * create it once with ensureDatabase() before writing to it.
 */

export interface CloudantDocument {
  _id?: string
  _rev?: string
  [key: string]: unknown
}

let client: CloudantV1 | undefined

function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `${name} is not set — copy .env.example to .env, fill in your IBM Cloudant ` +
        'service credentials, then run `pnpm run env:sync` (see docs/ENV-VARS.md)',
    )
  }
  return value
}

function getClient(): CloudantV1 {
  if (client) return client

  const url = getRequiredEnv('CLOUDANT_URL')
  const apikey = getRequiredEnv('CLOUDANT_APIKEY')

  const authenticator = new IamAuthenticator({ apikey })
  const newClient = new CloudantV1({ authenticator })
  newClient.setServiceUrl(url)

  client = newClient
  return client
}

/** Create a database if it doesn't already exist. Safe to call repeatedly. */
export async function ensureDatabase(dbName: string): Promise<void> {
  const cloudant = getClient()
  try {
    await cloudant.getDatabaseInformation({ db: dbName })
  } catch (error) {
    const status = (error as { status?: number }).status
    if (status !== 404) {
      throw new Error(
        `Failed to check Cloudant database '${dbName}': ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
    try {
      await cloudant.putDatabase({ db: dbName })
    } catch (createError) {
      throw new Error(
        `Failed to create Cloudant database '${dbName}': ${
          createError instanceof Error ? createError.message : String(createError)
        }`,
      )
    }
  }
}

/**
 * Create or update a document. Pass `_id` (and `_rev`, if updating an
 * existing document) inside `doc`. Returns the new revision id.
 */
export async function putDocument(dbName: string, doc: CloudantDocument): Promise<string> {
  const cloudant = getClient()
  try {
    const response = await cloudant.postDocument({ db: dbName, document: doc })
    if (!response.result.ok || !response.result.rev) {
      throw new Error(`Cloudant did not confirm the write (result: ${JSON.stringify(response.result)})`)
    }
    return response.result.rev
  } catch (error) {
    throw new Error(
      `Failed to write document '${doc._id ?? '(auto-id)'}' to Cloudant database '${dbName}': ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

/** Retrieve a document by id. Throws if it doesn't exist. */
export async function getDocument(dbName: string, docId: string): Promise<CloudantDocument> {
  const cloudant = getClient()
  try {
    const response = await cloudant.getDocument({ db: dbName, docId })
    return response.result
  } catch (error) {
    throw new Error(
      `Failed to retrieve document '${docId}' from Cloudant database '${dbName}': ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

/** Delete a document. Requires the current `_rev` (fetch it via getDocument first). */
export async function deleteDocument(dbName: string, docId: string, rev: string): Promise<void> {
  const cloudant = getClient()
  try {
    await cloudant.deleteDocument({ db: dbName, docId, rev })
  } catch (error) {
    throw new Error(
      `Failed to delete document '${docId}' from Cloudant database '${dbName}': ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}
