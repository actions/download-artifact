import * as os from 'os'
import * as path from 'path'
import * as core from '@actions/core'
import artifactClient from '@actions/artifact'
import type {
  Artifact,
  FindOptions,
  GetArtifactResponse
} from '@actions/artifact'
import {Inputs, Outputs, NotFoundOptions} from './constants'

const PARALLEL_DOWNLOADS = 5

export const chunk = <T>(arr: T[], n: number): T[][] =>
  arr.reduce((acc, cur, i) => {
    const index = Math.floor(i / n)
    acc[index] = [...(acc[index] || []), cur]
    return acc
  }, [] as T[][])

function checkIfNotFoundOption(if_not_found: string, message: string) {
  switch (if_not_found) {
    case NotFoundOptions.warn: {
      core.warning(message)
      break
    }
    case NotFoundOptions.error: {
      core.setFailed(message)
      break
    }
    case NotFoundOptions.ignore: {
      core.info(message)
      break
    }
  }
}

async function getArtifact(
  name: string,
  if_not_found: string,
  options: FindOptions
): Promise<GetArtifactResponse | undefined> {
  try {
    return await artifactClient.getArtifact(name, options)
  } catch (err) {
    const message = `Artifact '${name}' not found`
    checkIfNotFoundOption(if_not_found, message)
  }
}

async function run(): Promise<void> {
  const inputs = {
    name: core.getInput(Inputs.Name, {required: false}),
    path: core.getInput(Inputs.Path, {required: false}),
    token: core.getInput(Inputs.GitHubToken, {required: false}),
    repository: core.getInput(Inputs.Repository, {required: false}),
    if_not_found: core.getInput(Inputs.IfNotFound, {required: false}),
    runID: parseInt(core.getInput(Inputs.RunID, {required: false}))
  }

  if (!inputs.path) {
    inputs.path = process.env['GITHUB_WORKSPACE'] || process.cwd()
  }

  if (inputs.path.startsWith(`~`)) {
    inputs.path = inputs.path.replace('~', os.homedir())
  }

  const isSingleArtifactDownload = !!inputs.name
  const resolvedPath = path.resolve(inputs.path)
  core.debug(`Resolved path is ${resolvedPath}`)

  const options: FindOptions = {}
  if (inputs.token) {
    const [repositoryOwner, repositoryName] = inputs.repository.split('/')
    if (!repositoryOwner || !repositoryName) {
      throw new Error(
        `Invalid repository: '${inputs.repository}'. Must be in format owner/repo`
      )
    }

    options.findBy = {
      token: inputs.token,
      workflowRunId: inputs.runID,
      repositoryName,
      repositoryOwner
    }
  }

  let artifacts: Artifact[] = []

  if (isSingleArtifactDownload) {
    core.info(`Downloading single artifact`)

    const targetArtifact = await getArtifact(
      inputs.name,
      inputs.if_not_found,
      options
    )

    if (targetArtifact) {
      core.debug(
        `Found named artifact '${inputs.name}' (ID: ${targetArtifact.artifact.id}, Size: ${targetArtifact.artifact.size})`
      )
      artifacts = [targetArtifact.artifact]
    }
  } else {
    core.info(
      `No input name specified, downloading all artifacts. Extra directory with the artifact name will be created for each download`
    )

    const listArtifactResponse = await artifactClient.listArtifacts({
      latest: true,
      ...options
    })

    if (listArtifactResponse.artifacts.length === 0) {
      const message = `No artifacts found for run '${inputs.runID}' in '${inputs.repository}'`
      checkIfNotFoundOption(inputs.if_not_found, message)
    }
    core.debug(`Found ${listArtifactResponse.artifacts.length} artifacts`)
    artifacts = listArtifactResponse.artifacts
  }

  const downloadPromises = artifacts.map(artifact =>
    artifactClient.downloadArtifact(artifact.id, {
      ...options,
      path: isSingleArtifactDownload
        ? resolvedPath
        : path.join(resolvedPath, artifact.name)
    })
  )

  const chunkedPromises = chunk(downloadPromises, PARALLEL_DOWNLOADS)
  for (const chunk of chunkedPromises) {
    await Promise.all(chunk)
  }

  core.info(`Total of ${artifacts.length} artifact(s) downloaded`)
  core.setOutput(Outputs.DownloadPath, resolvedPath)
  core.info('Download artifact has finished successfully')
}

run().catch(err =>
  core.setFailed(`Unable to download artifact(s): ${err.message}`)
)
