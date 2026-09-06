import { WatsonXAI } from '@ibm-cloud/watsonx-ai'
import { IamAuthenticator } from 'ibm-cloud-sdk-core'

/**
 * IBM watsonx.ai — sole entry point (mirrors src/lib/objectStorage.ts and
 * src/lib/cloudant.ts).
 *
 * Lazy singleton: the client is only constructed on first use, so importing
 * this module (or anything that imports it) never throws just because the
 * WATSONX_AI_* env vars aren't set yet — the error surfaces at the first
 * actual call instead, same reasoning as objectStorage.ts and cloudant.ts.
 *
 * Auth model: IBM Cloud IAM API key (WATSONX_AI_APIKEY against
 * WATSONX_AI_URL), same style as Cloudant. Text generation additionally
 * requires a watsonx.ai project id (WATSONX_AI_PROJECT_ID) — create a
 * project in the watsonx.ai console and associate a Watson Machine
 * Learning service instance with it first. See docs/ENV-VARS.md.
 */

// watsonx.ai REST API version date, not this project's version — pinning it
// keeps responses stable even if IBM ships a newer API revision later.
// https://cloud.ibm.com/apidocs/watsonx-ai
const API_VERSION = '2024-05-31'

// A small, always-available IBM foundation model — good enough for a
// connectivity check without needing a specific model pre-selected.
// Override with WATSONX_AI_MODEL_ID if your project uses a different one.
const DEFAULT_MODEL_ID = 'ibm/granite-13b-instruct-v2'

let client: WatsonXAI | undefined

function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `${name} is not set — copy .env.example to .env, fill in your IBM watsonx.ai ` +
        'credentials, then run `pnpm run env:sync` (see docs/ENV-VARS.md)',
    )
  }
  return value
}

function getClient(): WatsonXAI {
  if (client) return client

  const serviceUrl = getRequiredEnv('WATSONX_AI_URL')
  const apikey = getRequiredEnv('WATSONX_AI_APIKEY')

  client = WatsonXAI.newInstance({
    version: API_VERSION,
    serviceUrl,
    authenticator: new IamAuthenticator({ apikey }),
  })
  return client
}

function getProjectId(): string {
  return getRequiredEnv('WATSONX_AI_PROJECT_ID')
}

/**
 * Generate text from a prompt using the configured (or given) foundation
 * model. Used directly by feature code, and by the connectivity smoke test
 * to prove the credentials actually work end-to-end (not just that auth
 * succeeds — that inference does too).
 */
export async function generateText(
  input: string,
  options?: { modelId?: string; maxNewTokens?: number },
): Promise<string> {
  const watsonx = getClient()
  const projectId = getProjectId()
  const modelId = options?.modelId ?? process.env.WATSONX_AI_MODEL_ID ?? DEFAULT_MODEL_ID

  try {
    const response = await watsonx.generateText({
      input,
      modelId,
      projectId,
      parameters: { max_new_tokens: options?.maxNewTokens ?? 20 },
    })
    const text = response.result.results?.[0]?.generated_text
    if (text === undefined) {
      throw new Error(
        `watsonx.ai returned no generated text (result: ${JSON.stringify(response.result)})`,
      )
    }
    return text
  } catch (error) {
    throw new Error(
      `Failed to generate text from watsonx.ai model '${modelId}': ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

/**
 * List available foundation model ids. A lighter-weight call than
 * generateText — proves IAM auth and network connectivity to watsonx.ai
 * without spending inference credits or needing a project id, so this is
 * the first thing the connectivity smoke test checks.
 */
export async function listFoundationModelIds(): Promise<string[]> {
  const watsonx = getClient()
  try {
    const response = await watsonx.listFoundationModelSpecs({})
    return (response.result.resources ?? [])
      .map((model) => model.model_id)
      .filter((id): id is string => Boolean(id))
  } catch (error) {
    throw new Error(
      `Failed to list watsonx.ai foundation models: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}
