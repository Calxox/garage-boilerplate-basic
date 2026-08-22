import * as COS from 'ibm-cos-sdk'

/**
 * IBM Cloud Object Storage — sole entry point (mirrors src/lib/firebase.ts).
 *
 * Lazy singleton: the client is only constructed on first use, so importing
 * this module (or anything that imports it) never throws just because the
 * COS_* env vars aren't set yet — the error surfaces at the first actual
 * call instead, same reasoning as the frontend's lazy Firebase admin init.
 *
 * Auth model: IBM Cloud IAM API key (COS_API_KEY_ID + COS_INSTANCE_CRN),
 * not HMAC. If your team generated HMAC credentials instead when creating
 * the service credential, see docs/ENV-VARS.md for the alternative.
 */

let client: COS.S3 | undefined

function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `${name} is not set — copy .env.example to .env, fill in your IBM Cloud ` +
        'Object Storage service credentials, then run `pnpm run env:sync` (see docs/ENV-VARS.md)',
    )
  }
  return value
}

function getClient(): COS.S3 {
  if (client) return client

  const endpoint = getRequiredEnv('COS_ENDPOINT')
  const apiKeyId = getRequiredEnv('COS_API_KEY_ID')
  const serviceInstanceId = getRequiredEnv('COS_INSTANCE_CRN')

  client = new COS.S3({ endpoint, apiKeyId, serviceInstanceId })
  return client
}

function getBucket(): string {
  return getRequiredEnv('COS_BUCKET_NAME')
}

/** Upload a buffer/string to the configured bucket under `key`. */
export async function uploadObject(
  key: string,
  body: Buffer | string,
  contentType?: string,
): Promise<void> {
  const cos = getClient()
  const bucket = getBucket()
  try {
    await cos
      .putObject({ Bucket: bucket, Key: key, Body: body, ContentType: contentType })
      .promise()
  } catch (error) {
    throw new Error(
      `Failed to upload '${key}' to Object Storage bucket '${bucket}': ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

/** Retrieve an object's body as a Buffer. Throws if the key doesn't exist. */
export async function getObject(key: string): Promise<Buffer> {
  const cos = getClient()
  const bucket = getBucket()
  try {
    const result = await cos.getObject({ Bucket: bucket, Key: key }).promise()
    if (!result.Body) {
      throw new Error(`Object '${key}' has no body`)
    }
    return Buffer.isBuffer(result.Body) ? result.Body : Buffer.from(result.Body as never)
  } catch (error) {
    throw new Error(
      `Failed to retrieve '${key}' from Object Storage bucket '${bucket}': ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

/** Delete an object. Used mainly by the connectivity smoke test to clean up. */
export async function deleteObject(key: string): Promise<void> {
  const cos = getClient()
  const bucket = getBucket()
  try {
    await cos.deleteObject({ Bucket: bucket, Key: key }).promise()
  } catch (error) {
    throw new Error(
      `Failed to delete '${key}' from Object Storage bucket '${bucket}': ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}
