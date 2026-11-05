import {jest, describe, test, expect, beforeEach} from '@jest/globals'
import * as path from 'path'

// Mock @actions/github before importing modules that use it
jest.unstable_mockModule('@actions/github', () => ({
  context: {
    repo: {
      owner: 'actions',
      repo: 'toolkit'
    },
    runId: 123,
    serverUrl: 'https://github.com'
  },
  getOctokit: jest.fn()
}))

// Mock @actions/core
jest.unstable_mockModule('@actions/core', () => ({
  getInput: jest.fn(),
  getBooleanInput: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  setSecret: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  notice: jest.fn(),
  startGroup: jest.fn(),
  endGroup: jest.fn(),
  isDebug: jest.fn(() => false),
  getState: jest.fn(),
  saveState: jest.fn(),
  exportVariable: jest.fn(),
  addPath: jest.fn(),
  group: jest.fn((name: string, fn: () => Promise<unknown>) => fn()),
  toPlatformPath: jest.fn(p => p),
  toWin32Path: jest.fn(p => p),
  toPosixPath: jest.fn(p => p)
}))

// Dynamic imports after mocking
const core = await import('@actions/core')
const artifact = await import('@actions/artifact')
const {run} = await import('../src/download-artifact.js')
const {Inputs} = await import('../src/constants.js')
const {ArtifactNotFoundError} = artifact

const mockInputs = (
  overrides?: Partial<{[K in (typeof Inputs)[keyof typeof Inputs]]?: any}>
) => {
  const inputs: Record<string, any> = {
    [Inputs.Name]: 'artifact-name',
    [Inputs.Path]: '/some/artifact/path',
    [Inputs.GitHubToken]: 'warn',
    [Inputs.Repository]: 'owner/some-repository',
    [Inputs.RunID]: 'some-run-id',
    [Inputs.Pattern]: 'some-pattern',
    ...overrides
  }

  ;(core.getInput as jest.Mock<typeof core.getInput>).mockImplementation(
    (name: string) => {
      return inputs[name]
    }
  )
  ;(
    core.getBooleanInput as jest.Mock<typeof core.getBooleanInput>
  ).mockImplementation((name: string) => {
    return inputs[name]
  })

  return inputs
}

describe('download', () => {
  beforeEach(async () => {
    mockInputs()
    jest.clearAllMocks()

    // Mock artifact client methods
    jest
      .spyOn(artifact.default, 'listArtifacts')
      .mockImplementation(() => Promise.resolve({artifacts: []}))
    jest.spyOn(artifact.default, 'getArtifact').mockImplementation(name => {
      throw new ArtifactNotFoundError(`Artifact '${name}' not found`)
    })
    jest
      .spyOn(artifact.default, 'downloadArtifact')
      .mockImplementation(() => Promise.resolve({digestMismatch: false}))
  })

  test('downloads a single artifact by name', async () => {
    const mockArtifact = {
      id: 123,
      name: 'artifact-name',
      size: 1024,
      digest: 'abc123'
    }

    jest
      .spyOn(artifact.default, 'getArtifact')
      .mockImplementation(() => Promise.resolve({artifact: mockArtifact}))

    await run()

    expect(artifact.default.downloadArtifact).toHaveBeenCalledWith(
      mockArtifact.id,
      expect.objectContaining({
        expectedHash: mockArtifact.digest
      })
    )
    expect(core.info).toHaveBeenCalledWith('Total of 1 artifact(s) downloaded')

    expect(core.setOutput).toHaveBeenCalledWith(
      'download-path',
      expect.any(String)
    )

    expect(core.info).toHaveBeenCalledWith(
      'Download artifact has finished successfully'
    )
  })

  test('downloads multiple artifacts when no name or pattern provided', async () => {
    jest.clearAllMocks()
    mockInputs({
      [Inputs.Name]: '',
      [Inputs.Pattern]: ''
    })

    const mockArtifacts = [
      {id: 123, name: 'artifact1', size: 1024, digest: 'abc123'},
      {id: 456, name: 'artifact2', size: 2048, digest: 'def456'}
    ]

    // Set up artifact mock after clearing mocks
    jest
      .spyOn(artifact.default, 'listArtifacts')
      .mockImplementation(() => Promise.resolve({artifacts: mockArtifacts}))

    // Reset downloadArtifact mock as well
    jest
      .spyOn(artifact.default, 'downloadArtifact')
      .mockImplementation(() => Promise.resolve({digestMismatch: false}))

    await run()

    expect(core.info).toHaveBeenCalledWith(
      'No input name, artifact-ids or pattern filtered specified, downloading all artifacts'
    )

    expect(core.info).toHaveBeenCalledWith('Total of 2 artifact(s) downloaded')
    expect(artifact.default.downloadArtifact).toHaveBeenCalledTimes(2)
  })

  test('sets download path output even when no artifacts are found', async () => {
    mockInputs({[Inputs.Name]: ''})

    await run()

    expect(core.setOutput).toHaveBeenCalledWith(
      'download-path',
      expect.any(String)
    )

    expect(core.info).toHaveBeenCalledWith(
      'Download artifact has finished successfully'
    )

    expect(core.info).toHaveBeenCalledWith('Total of 0 artifact(s) downloaded')
  })

  test('filters artifacts by pattern', async () => {
    const mockArtifacts = [
      {id: 123, name: 'test-artifact', size: 1024, digest: 'abc123'},
      {id: 456, name: 'prod-artifact', size: 2048, digest: 'def456'}
    ]

    jest
      .spyOn(artifact.default, 'listArtifacts')
      .mockImplementation(() => Promise.resolve({artifacts: mockArtifacts}))

    mockInputs({
      [Inputs.Name]: '',
      [Inputs.Pattern]: 'test-*'
    })

    await run()

    expect(artifact.default.downloadArtifact).toHaveBeenCalledTimes(1)
    expect(artifact.default.downloadArtifact).toHaveBeenCalledWith(
      123,
      expect.anything()
    )
  })

  test('uses token and repository information when provided', async () => {
    const token = 'ghp_testtoken123'

    mockInputs({
      [Inputs.Name]: '',
      [Inputs.GitHubToken]: token,
      [Inputs.Repository]: 'myorg/myrepo',
      [Inputs.RunID]: '789'
    })

    jest
      .spyOn(artifact.default, 'listArtifacts')
      .mockImplementation(() => Promise.resolve({artifacts: []}))

    await run()

    expect(artifact.default.listArtifacts).toHaveBeenCalledWith(
      expect.objectContaining({
        findBy: {
          token,
          workflowRunId: 789,
          repositoryName: 'myrepo',
          repositoryOwner: 'myorg'
        }
      })
    )
  })

  test('throws error when repository format is invalid', async () => {
    mockInputs({
      [Inputs.GitHubToken]: 'some-token',
      [Inputs.Repository]: 'invalid-format' // Missing the owner/repo format
    })

    await expect(run()).rejects.toThrow(
      "Invalid repository: 'invalid-format'. Must be in format owner/repo"
    )
  })

  test('errors when digest validation fails (default behavior)', async () => {
    const mockArtifact = {
      id: 123,
      name: 'corrupted-artifact',
      size: 1024,
      digest: 'abc123'
    }

    jest
      .spyOn(artifact.default, 'getArtifact')
      .mockImplementation(() => Promise.resolve({artifact: mockArtifact}))

    jest
      .spyOn(artifact.default, 'downloadArtifact')
      .mockImplementation(() => Promise.resolve({digestMismatch: true}))

    await expect(run()).rejects.toThrow(
      'Digest validation failed for artifact(s): corrupted-artifact'
    )
  })

  test('warns when digest validation fails with digest-mismatch set to warn', async () => {
    const mockArtifact = {
      id: 123,
      name: 'corrupted-artifact',
      size: 1024,
      digest: 'abc123'
    }

    mockInputs({
      [Inputs.DigestMismatch]: 'warn'
    })

    jest
      .spyOn(artifact.default, 'getArtifact')
      .mockImplementation(() => Promise.resolve({artifact: mockArtifact}))

    jest
      .spyOn(artifact.default, 'downloadArtifact')
      .mockImplementation(() => Promise.resolve({digestMismatch: true}))

    await run()

    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('digest validation failed')
    )
  })

  test('logs info when digest validation fails with digest-mismatch set to info', async () => {
    const mockArtifact = {
      id: 123,
      name: 'corrupted-artifact',
      size: 1024,
      digest: 'abc123'
    }

    mockInputs({
      [Inputs.DigestMismatch]: 'info'
    })

    jest
      .spyOn(artifact.default, 'getArtifact')
      .mockImplementation(() => Promise.resolve({artifact: mockArtifact}))

    jest
      .spyOn(artifact.default, 'downloadArtifact')
      .mockImplementation(() => Promise.resolve({digestMismatch: true}))

    await run()

    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining('digest validation failed')
    )
  })

  test('silently continues when digest validation fails with digest-mismatch set to ignore', async () => {
    const mockArtifact = {
      id: 123,
      name: 'corrupted-artifact',
      size: 1024,
      digest: 'abc123'
    }

    mockInputs({
      [Inputs.DigestMismatch]: 'ignore'
    })

    jest
      .spyOn(artifact.default, 'getArtifact')
      .mockImplementation(() => Promise.resolve({artifact: mockArtifact}))

    jest
      .spyOn(artifact.default, 'downloadArtifact')
      .mockImplementation(() => Promise.resolve({digestMismatch: true}))

    await run()

    expect(core.warning).not.toHaveBeenCalledWith(
      expect.stringContaining('digest validation failed')
    )
    expect(core.info).toHaveBeenCalledWith('Total of 1 artifact(s) downloaded')
  })

  test('downloads a single artifact by ID', async () => {
    const mockArtifact = {
      id: 456,
      name: 'artifact-by-id',
      size: 1024,
      digest: 'def456'
    }

    mockInputs({
      [Inputs.Name]: '',
      [Inputs.Pattern]: '',
      [Inputs.ArtifactIds]: '456'
    })

    jest.spyOn(artifact.default, 'listArtifacts').mockImplementation(() =>
      Promise.resolve({
        artifacts: [mockArtifact]
      })
    )

    await run()

    expect(core.info).toHaveBeenCalledWith('Downloading artifacts by ID')
    expect(core.debug).toHaveBeenCalledWith('Parsed artifact IDs: ["456"]')
    expect(artifact.default.downloadArtifact).toHaveBeenCalledTimes(1)
    expect(artifact.default.downloadArtifact).toHaveBeenCalledWith(
      456,
      expect.objectContaining({
        expectedHash: mockArtifact.digest
      })
    )
    expect(core.info).toHaveBeenCalledWith('Total of 1 artifact(s) downloaded')
  })

  test('downloads multiple artifacts by ID', async () => {
    const mockArtifacts = [
      {id: 123, name: 'first-artifact', size: 1024, digest: 'abc123'},
      {id: 456, name: 'second-artifact', size: 2048, digest: 'def456'},
      {id: 789, name: 'third-artifact', size: 3072, digest: 'ghi789'}
    ]

    mockInputs({
      [Inputs.Name]: '',
      [Inputs.Pattern]: '',
      [Inputs.ArtifactIds]: '123, 456, 789'
    })

    jest.spyOn(artifact.default, 'listArtifacts').mockImplementation(() =>
      Promise.resolve({
        artifacts: mockArtifacts
      })
    )

    await run()

    expect(core.info).toHaveBeenCalledWith('Downloading artifacts by ID')
    expect(core.debug).toHaveBeenCalledWith(
      'Parsed artifact IDs: ["123","456","789"]'
    )
    expect(artifact.default.downloadArtifact).toHaveBeenCalledTimes(3)
    mockArtifacts.forEach(mockArtifact => {
      expect(artifact.default.downloadArtifact).toHaveBeenCalledWith(
        mockArtifact.id,
        expect.objectContaining({
          expectedHash: mockArtifact.digest
        })
      )
    })
    expect(core.info).toHaveBeenCalledWith('Total of 3 artifact(s) downloaded')
  })

  test('warns when some artifact IDs are not found', async () => {
    const mockArtifacts = [
      {id: 123, name: 'found-artifact', size: 1024, digest: 'abc123'}
    ]

    mockInputs({
      [Inputs.Name]: '',
      [Inputs.Pattern]: '',
      [Inputs.ArtifactIds]: '123, 456, 789'
    })

    jest.spyOn(artifact.default, 'listArtifacts').mockImplementation(() =>
      Promise.resolve({
        artifacts: mockArtifacts
      })
    )

    await run()

    expect(core.warning).toHaveBeenCalledWith(
      'Could not find the following artifact IDs: 456, 789'
    )
    expect(core.debug).toHaveBeenCalledWith('Found 1 artifacts by ID')
    expect(artifact.default.downloadArtifact).toHaveBeenCalledTimes(1)
  })

  test('throws error when no artifacts with requested IDs are found', async () => {
    mockInputs({
      [Inputs.Name]: '',
      [Inputs.Pattern]: '',
      [Inputs.ArtifactIds]: '123, 456'
    })

    jest.spyOn(artifact.default, 'listArtifacts').mockImplementation(() =>
      Promise.resolve({
        artifacts: []
      })
    )

    await expect(run()).rejects.toThrow(
      'None of the provided artifact IDs were found'
    )
  })

  test('throws error when artifact-ids input is empty', async () => {
    mockInputs({
      [Inputs.Name]: '',
      [Inputs.Pattern]: '',
      [Inputs.ArtifactIds]: '  '
    })

    await expect(run()).rejects.toThrow(
      "No valid artifact IDs provided in 'artifact-ids' input"
    )
  })

  test('throws error when some artifact IDs are not valid numbers', async () => {
    mockInputs({
      [Inputs.Name]: '',
      [Inputs.Pattern]: '',
      [Inputs.ArtifactIds]: '123, abc, 456'
    })

    await expect(run()).rejects.toThrow(
      "Invalid artifact ID: 'abc'. Must be a number."
    )
  })

  test('throws error when both name and artifact-ids are provided', async () => {
    mockInputs({
      [Inputs.Name]: 'some-artifact',
      [Inputs.ArtifactIds]: '123'
    })

    await expect(run()).rejects.toThrow(
      "Inputs 'name' and 'artifact-ids' cannot be used together. Please specify only one."
    )
  })

  test('downloads single artifact by ID to same path as by name', async () => {
    const mockArtifact = {
      id: 456,
      name: 'test-artifact',
      size: 1024,
      digest: 'def456'
    }

    const testPath = '/test/path'
    mockInputs({
      [Inputs.Name]: '',
      [Inputs.Pattern]: '',
      [Inputs.ArtifactIds]: '456',
      [Inputs.Path]: testPath
    })

    jest.spyOn(artifact.default, 'listArtifacts').mockImplementation(() =>
      Promise.resolve({
        artifacts: [mockArtifact]
      })
    )

    await run()

    // Verify it downloads directly to the specified path (not nested in artifact name subdirectory)
    expect(artifact.default.downloadArtifact).toHaveBeenCalledWith(
      456,
      expect.objectContaining({
        path: path.resolve(testPath), // Should be the resolved path directly, not nested
        expectedHash: mockArtifact.digest
      })
    )
  })

  test('passes skipDecompress option when skip-decompress input is true', async () => {
    const mockArtifact = {
      id: 123,
      name: 'artifact-name',
      size: 1024,
      digest: 'abc123'
    }

    mockInputs({
      [Inputs.SkipDecompress]: true
    })

    jest
      .spyOn(artifact.default, 'getArtifact')
      .mockImplementation(() => Promise.resolve({artifact: mockArtifact}))

    await run()

    expect(artifact.default.downloadArtifact).toHaveBeenCalledWith(
      mockArtifact.id,
      expect.objectContaining({
        skipDecompress: true,
        expectedHash: mockArtifact.digest
      })
    )
  })

  test('does not pass skipDecompress when skip-decompress input is false', async () => {
    const mockArtifact = {
      id: 123,
      name: 'artifact-name',
      size: 1024,
      digest: 'abc123'
    }

    mockInputs({
      [Inputs.SkipDecompress]: false
    })

    jest
      .spyOn(artifact.default, 'getArtifact')
      .mockImplementation(() => Promise.resolve({artifact: mockArtifact}))

    await run()

    expect(artifact.default.downloadArtifact).toHaveBeenCalledWith(
      mockArtifact.id,
      expect.objectContaining({
        skipDecompress: false,
        expectedHash: mockArtifact.digest
      })
    )
  })

  test('passes skipDecompress for multiple artifact downloads', async () => {
    mockInputs({
      [Inputs.Name]: '',
      [Inputs.Pattern]: '',
      [Inputs.SkipDecompress]: true
    })

    const mockArtifacts = [
      {id: 123, name: 'artifact1', size: 1024, digest: 'abc123'},
      {id: 456, name: 'artifact2', size: 2048, digest: 'def456'}
    ]

    jest
      .spyOn(artifact.default, 'listArtifacts')
      .mockImplementation(() => Promise.resolve({artifacts: mockArtifacts}))

    await run()

    expect(artifact.default.downloadArtifact).toHaveBeenCalledTimes(2)
    expect(artifact.default.downloadArtifact).toHaveBeenCalledWith(
      123,
      expect.objectContaining({skipDecompress: true})
    )
    expect(artifact.default.downloadArtifact).toHaveBeenCalledWith(
      456,
      expect.objectContaining({skipDecompress: true})
    )
  })
})
