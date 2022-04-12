import * as core from '@actions/core'
import * as artifact from '@actions/artifact'
import * as os from 'os'
import {resolve} from 'path'
import {Inputs, Outputs} from './constants'

async function run(): Promise<void> {
  try {
    const name = core.getInput(Inputs.Name, {required: false})
    const path = core.getInput(Inputs.Path, {required: false})
    const waitTimeoutStr = core.getInput(Inputs.WaitTimeout, {required: false})

    let runDownload: <T extends unknown>(action: () => T) => Promise<T>
    // no retry allowed
    if (waitTimeoutStr == '') {
      runDownload = async <T extends unknown>(action: () => T) => action()
    } else {
      const waitTimeoutSeconds = parseInt(waitTimeoutStr)
      runDownload = async <T extends unknown>(action: () => T) => {
        const waitUntil = Date.now() + waitTimeoutSeconds * 1000
        let lastError
        do {
          try {
            return await action()
          } catch (e) {
            lastError = e
            core.info(
              'Waiting for the artifact to become available... ' +
                `Remaining time until timeout: ${Math.max(
                  0,
                  Math.floor((waitUntil - Date.now()) / 1000)
                )} seconds`
            )
            await new Promise(f => setTimeout(f, 10000))
          }
        } while (Date.now() < waitUntil)
        throw Error(
          'Waiting for the artifact has timed out. Latest error was: ' +
            lastError
        )
      }
    }

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
      const downloadResponse = await runDownload(() =>
        artifactClient.downloadAllArtifacts(resolvedPath)
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
      const downloadResponse = await runDownload(() =>
        artifactClient.downloadArtifact(name, resolvedPath, downloadOptions)
      )
      core.info(
        `Artifact ${downloadResponse.artifactName} was downloaded to ${downloadResponse.downloadPath}`
      )
    }
    // output the directory that the artifact(s) was/were downloaded to
    // if no path is provided, an empty string resolves to the current working directory
    core.setOutput(Outputs.DownloadPath, resolvedPath)
    core.info('Artifact download has finished successfully')
  } catch (err) {
    core.setFailed(err.message)
  }
}

run()
