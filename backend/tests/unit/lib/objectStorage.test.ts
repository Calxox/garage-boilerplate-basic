import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Unit tests for lib/objectStorage.ts — the ibm-cos-sdk client is mocked,
 * so these prove the module's own logic (env validation, error wrapping,
 * correct SDK calls), not real connectivity to IBM Cloud.
 *
 * For real connectivity against your actual bucket, run:
 *   pnpm --filter backend run test:cos-connectivity
 * (needs backend/.env populated — see docs/ENV-VARS.md)
 */

const putObjectMock = vi.fn()
const getObjectMock = vi.fn()
const deleteObjectMock = vi.fn()

vi.mock('ibm-cos-sdk', () => {
  return {
    S3: vi.fn().mockImplementation(() => ({
      putObject: putObjectMock,
      getObject: getObjectMock,
      deleteObject: deleteObjectMock,
    })),
  }
})

const ENV_KEYS = ['COS_ENDPOINT', 'COS_API_KEY_ID', 'COS_INSTANCE_CRN', 'COS_BUCKET_NAME'] as const

function setValidEnv() {
  process.env.COS_ENDPOINT = 'https://s3.au-syd.cloud-object-storage.appdomain.cloud'
  process.env.COS_API_KEY_ID = 'test-api-key'
  process.env.COS_INSTANCE_CRN = 'crn:v1:bluemix:public:cloud-object-storage:global:...'
  process.env.COS_BUCKET_NAME = 'test-bucket'
}

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key]
}

describe('lib/objectStorage', () => {
  beforeEach(() => {
    vi.resetModules()
    putObjectMock.mockReset()
    getObjectMock.mockReset()
    deleteObjectMock.mockReset()
    clearEnv()
  })

  afterEach(() => {
    clearEnv()
  })

  it('throws a clear error if COS_ENDPOINT is missing', async () => {
    setValidEnv()
    delete process.env.COS_ENDPOINT
    const { uploadObject } = await import('../../../src/lib/objectStorage')
    await expect(uploadObject('test.txt', 'hello')).rejects.toThrow('COS_ENDPOINT is not set')
  })

  it('throws a clear error if COS_BUCKET_NAME is missing', async () => {
    setValidEnv()
    delete process.env.COS_BUCKET_NAME
    const { uploadObject } = await import('../../../src/lib/objectStorage')
    await expect(uploadObject('test.txt', 'hello')).rejects.toThrow('COS_BUCKET_NAME is not set')
  })

  it('uploadObject calls putObject with the right Bucket/Key/Body', async () => {
    setValidEnv()
    putObjectMock.mockReturnValue({ promise: () => Promise.resolve({}) })
    const { uploadObject } = await import('../../../src/lib/objectStorage')

    await uploadObject('detections/test.jpg', Buffer.from('fake-image'), 'image/jpeg')

    expect(putObjectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'test-bucket',
        Key: 'detections/test.jpg',
        ContentType: 'image/jpeg',
      }),
    )
  })

  it('getObject returns the object body as a Buffer', async () => {
    setValidEnv()
    getObjectMock.mockReturnValue({
      promise: () => Promise.resolve({ Body: Buffer.from('hello world') }),
    })
    const { getObject } = await import('../../../src/lib/objectStorage')

    const result = await getObject('detections/test.jpg')

    expect(result.toString()).toBe('hello world')
    expect(getObjectMock).toHaveBeenCalledWith(
      expect.objectContaining({ Bucket: 'test-bucket', Key: 'detections/test.jpg' }),
    )
  })

  it('wraps an SDK failure into a descriptive error instead of leaking the raw one', async () => {
    setValidEnv()
    getObjectMock.mockReturnValue({
      promise: () => Promise.reject(new Error('NoSuchKey: does not exist')),
    })
    const { getObject } = await import('../../../src/lib/objectStorage')

    await expect(getObject('missing.jpg')).rejects.toThrow(
      "Failed to retrieve 'missing.jpg' from Object Storage bucket 'test-bucket'",
    )
  })

  it('deleteObject calls deleteObject with the right Bucket/Key', async () => {
    setValidEnv()
    deleteObjectMock.mockReturnValue({ promise: () => Promise.resolve({}) })
    const { deleteObject } = await import('../../../src/lib/objectStorage')

    await deleteObject('detections/test.jpg')

    expect(deleteObjectMock).toHaveBeenCalledWith(
      expect.objectContaining({ Bucket: 'test-bucket', Key: 'detections/test.jpg' }),
    )
  })
})
