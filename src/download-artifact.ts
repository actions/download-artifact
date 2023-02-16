import * as core from '@actions/core'
import * as artifact from '@actions/artifact'
import * as os from 'os'
import {resolve} from 'path'
import {Inputs, Outputs} from './constants'

async function downloadArtifact(name: string, path: string): Promise<string> {
  let resolvedPath
  // resolve tilde expansions, path.replace only replaces the first occurrence of a pattern
  if (path.startsWith(`~`)) {
    resolvedPath = resolve(path.replace('~', os.homedir()))
  } else {
    resolvedPath = resolve(path)
  }
  core.debug(`Resolved path is ${resolvedPath}`)

  const artifactClient = artifact.create()
  if (!name) {
    // download all artifacts
    core.info('No artifact name specified, downloading all artifacts')
    core.info(
      'Creating an extra directory for each artifact that is being downloaded'
    )
    const downloadResponse = await artifactClient.downloadAllArtifacts(
      resolvedPath
    )
    core.info(`There were ${downloadResponse.length} artifacts downloaded`)
    for (const artifact of downloadResponse) {
      core.info(
        `Artifact ${artifact.artifactName} was downloaded to ${artifact.downloadPath}`
      )
    }
  } else {
    // download a single artifact
    core.info(`Starting download for ${name}`)
    const downloadOptions = {
      createArtifactFolder: false
    }
    const downloadResponse = await artifactClient.downloadArtifact(
      name,
      resolvedPath,
      downloadOptions
    )
    core.info(
      `Artifact ${downloadResponse.artifactName} was downloaded to ${downloadResponse.downloadPath}`
    )
  }
  // output the directory that the artifact(s) was/were downloaded to
  // if no path is provided, an empty string resolves to the current working directory
  core.info('Artifact download has finished successfully')

  return resolvedPath
}

async function run(): Promise<void> {
  try {
    const names = core.getMultilineInput(Inputs.Names, {required: false})
    const paths = core.getMultilineInput(Inputs.Paths, {required: false})

    core.info(`names: '${JSON.stringify(names)}' | length: ${names.length}`)
    core.info(`paths: '${JSON.stringify(paths)}' | length: ${paths.length}`)

    let downloadPaths: string[] = []

    // Names is set and has fewer entries than Paths
    if (names.length !== 0 && paths.length > names.length) {
      throw Error(
        `The input 'path' cannot have more entries than 'name', if 'name' is set.`
      )
    }
    // Names is NOT set and Paths has more than 1 entry
    else if (names.length === 0 && paths.length > 1) {
      throw Error(
        `The input 'path' cannot have more than one entry, if 'name' is not set.`
      )
    }
    // Names is NOT set and path has at max 1 entry: download all artifacts
    else if (names.length === 0 && paths.length <= 1) {
      const name = names.toString() // ''
      const path = paths.toString() // '' or 'some/path'
      const downloadPath = await downloadArtifact(name, path)
      downloadPaths.push(downloadPath)
    }
    // Names has one or more entries and Paths has at max 1 entry
    else if (names.length >= 1 && paths.length <= 1) {
      const path = paths.toString() // '' or 'some/path'
      names.forEach(async name => {
        const downloadPath = await downloadArtifact(name, path)
        downloadPaths.push(downloadPath)
      })
    }
    // Names and Paths have the same numbers of entries (more than 1)
    else if (
      names.length > 1 &&
      paths.length > 1 &&
      names.length === paths.length
    ) {
      names.forEach(async (name, index) => {
        const path = paths[index]
        const downloadPath = await downloadArtifact(name, path)
        downloadPaths.push(downloadPath)
      })
    }
    // Unhandled exception
    else {
      throw Error(
        `Unhandled scenario. This shouldn't happen. It's very likely a bug. :-()`
      )
    }

    // Remove duplicates and empty strings
    downloadPaths = [...new Set(downloadPaths.filter(path => path !== ''))]

    // Returns a newline-separated list of paths
    const output = downloadPaths.join('\n')

    // output the directory that the artifact(s) was/were downloaded to
    core.setOutput(Outputs.DownloadPaths, output)
  } catch (err) {
    core.setFailed(err.message)
  }
}

run()
