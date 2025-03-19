import * as core from '@actions/core'
import artifact, {ArtifactNotFoundError} from '@actions/artifact'
import {run} from '../src/download-artifact'
import {Inputs} from '../src/constants'

jest.mock('@actions/github', () => ({
  context: {
    repo: {
      owner: 'actions',
      repo: 'toolkit'
    },
    runId: 123,
    serverUrl: 'https://github.com'
  }
}))

jest.mock('@actions/core')

/* eslint-disable no-unused-vars */ /* eslint-disable  @typescript-eslint/no-explicit-any */
const mockInputs = (overrides?: Partial<{[K in Inputs]?: any}>) => {
  const inputs = {
    [Inputs.Name]: 'artifact-name',
    [Inputs.Path]: '/some/artifact/path',
    [Inputs.GitHubToken]: 'warn',
    [Inputs.Repository]: 'owner/some-repository',
    [Inputs.RunID]: 'some-run-id',
    [Inputs.Pattern]: 'some-pattern',
    ...overrides
  }

  ;(core.getInput as jest.Mock).mockImplementation((name: string) => {
    return inputs[name]
  })
  ;(core.getBooleanInput as jest.Mock).mockImplementation((name: string) => {
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
      .spyOn(artifact, 'listArtifacts')
      .mockImplementation(() => Promise.resolve({artifacts: []}))
    jest.spyOn(artifact, 'getArtifact').mockImplementation(name => {
      throw new ArtifactNotFoundError(`Artifact '${name}' not found`)
    })
    jest
      .spyOn(artifact, 'downloadArtifact')
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
      .spyOn(artifact, 'getArtifact')
      .mockImplementation(() => Promise.resolve({artifact: mockArtifact}))

    await run()

    expect(artifact.downloadArtifact).toHaveBeenCalledWith(
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
      .spyOn(artifact, 'listArtifacts')
      .mockImplementation(() => Promise.resolve({artifacts: mockArtifacts}))

    // Reset downloadArtifact mock as well
    jest
      .spyOn(artifact, 'downloadArtifact')
      .mockImplementation(() => Promise.resolve({digestMismatch: false}))

    await run()

    expect(core.info).toHaveBeenCalledWith(
      'No input name or pattern filtered specified, downloading all artifacts'
    )

    expect(core.info).toHaveBeenCalledWith('Total of 2 artifact(s) downloaded')
    expect(artifact.downloadArtifact).toHaveBeenCalledTimes(2)
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
      .spyOn(artifact, 'listArtifacts')
      .mockImplementation(() => Promise.resolve({artifacts: mockArtifacts}))

    mockInputs({
      [Inputs.Name]: '',
      [Inputs.Pattern]: 'test-*'
    })

    await run()

    expect(artifact.downloadArtifact).toHaveBeenCalledTimes(1)
    expect(artifact.downloadArtifact).toHaveBeenCalledWith(
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
      .spyOn(artifact, 'listArtifacts')
      .mockImplementation(() => Promise.resolve({artifacts: []}))

    await run()

    expect(artifact.listArtifacts).toHaveBeenCalledWith(
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

  test('warns when digest validation fails', async () => {
    const mockArtifact = {
      id: 123,
      name: 'corrupted-artifact',
      size: 1024,
      digest: 'abc123'
    }

    jest
      .spyOn(artifact, 'getArtifact')
      .mockImplementation(() => Promise.resolve({artifact: mockArtifact}))

    jest
      .spyOn(artifact, 'downloadArtifact')
      .mockImplementation(() => Promise.resolve({digestMismatch: true}))

    await run()

    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('digest validation failed')
    )
  })
})
