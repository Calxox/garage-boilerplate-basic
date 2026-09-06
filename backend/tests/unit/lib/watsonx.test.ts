import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Unit tests for lib/watsonx.ts — the @ibm-cloud/watsonx-ai SDK is mocked,
 * so these prove the module's own logic (env validation, error wrapping,
 * correct SDK calls), not real connectivity to IBM watsonx.ai.
 *
 * For real connectivity against your actual project, run:
 *   pnpm --filter backend run test:watsonx-connectivity
 * (needs backend/.env populated — see docs/ENV-VARS.md)
 */

const generateTextMock = vi.fn()
const listFoundationModelSpecsMock = vi.fn()

vi.mock('@ibm-cloud/watsonx-ai', () => {
  return {
    WatsonXAI: {
      newInstance: vi.fn().mockImplementation(() => ({
        generateText: generateTextMock,
        listFoundationModelSpecs: listFoundationModelSpecsMock,
      })),
    },
  }
})

vi.mock('ibm-cloud-sdk-core', () => {
  return {
    IamAuthenticator: vi.fn().mockImplementation((options) => options),
  }
})

const ENV_KEYS = ['WATSONX_AI_URL', 'WATSONX_AI_APIKEY', 'WATSONX_AI_PROJECT_ID'] as const

function setValidEnv() {
  process.env.WATSONX_AI_URL = 'https://us-south.ml.cloud.ibm.com'
  process.env.WATSONX_AI_APIKEY = 'test-api-key'
  process.env.WATSONX_AI_PROJECT_ID = 'test-project-id'
}

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key]
  delete process.env.WATSONX_AI_MODEL_ID
}

describe('lib/watsonx', () => {
  beforeEach(() => {
    vi.resetModules()
    generateTextMock.mockReset()
    listFoundationModelSpecsMock.mockReset()
    clearEnv()
  })

  afterEach(() => {
    clearEnv()
  })

  it('throws a clear error if WATSONX_AI_URL is missing', async () => {
    setValidEnv()
    delete process.env.WATSONX_AI_URL
    const { listFoundationModelIds } = await import('../../../src/lib/watsonx')
    await expect(listFoundationModelIds()).rejects.toThrow('WATSONX_AI_URL is not set')
  })

  it('throws a clear error if WATSONX_AI_PROJECT_ID is missing', async () => {
    setValidEnv()
    delete process.env.WATSONX_AI_PROJECT_ID
    const { generateText } = await import('../../../src/lib/watsonx')
    await expect(generateText('hello')).rejects.toThrow('WATSONX_AI_PROJECT_ID is not set')
  })

  it('listFoundationModelIds returns the model ids from the SDK response', async () => {
    setValidEnv()
    listFoundationModelSpecsMock.mockResolvedValue({
      result: { resources: [{ model_id: 'ibm/granite-13b-instruct-v2' }, { model_id: 'meta-llama/llama-3-70b' }] },
    })
    const { listFoundationModelIds } = await import('../../../src/lib/watsonx')

    const ids = await listFoundationModelIds()

    expect(ids).toEqual(['ibm/granite-13b-instruct-v2', 'meta-llama/llama-3-70b'])
  })

  it('generateText calls the SDK with the right modelId/projectId and returns the generated text', async () => {
    setValidEnv()
    generateTextMock.mockResolvedValue({
      result: { results: [{ generated_text: 'connected' }] },
    })
    const { generateText } = await import('../../../src/lib/watsonx')

    const output = await generateText('say hello')

    expect(output).toBe('connected')
    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: 'say hello',
        modelId: 'ibm/granite-13b-instruct-v2',
        projectId: 'test-project-id',
      }),
    )
  })

  it('generateText uses WATSONX_AI_MODEL_ID when set', async () => {
    setValidEnv()
    process.env.WATSONX_AI_MODEL_ID = 'meta-llama/llama-3-70b'
    generateTextMock.mockResolvedValue({ result: { results: [{ generated_text: 'ok' }] } })
    const { generateText } = await import('../../../src/lib/watsonx')

    await generateText('say hello')

    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({ modelId: 'meta-llama/llama-3-70b' }),
    )
  })

  it('wraps an SDK failure into a descriptive error instead of leaking the raw one', async () => {
    setValidEnv()
    generateTextMock.mockRejectedValue(new Error('401 Unauthorized'))
    const { generateText } = await import('../../../src/lib/watsonx')

    await expect(generateText('say hello')).rejects.toThrow(
      "Failed to generate text from watsonx.ai model 'ibm/granite-13b-instruct-v2'",
    )
  })
})
