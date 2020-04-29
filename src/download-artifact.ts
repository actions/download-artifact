import * as core from '@actions/core'
import * as artifact from '@actions/artifact'
import {Inputs} from './constants'
import * as path from 'path'

async function run(): Promise<void> {
  try {
    const name = core.getInput(Inputs.Name, {required: false})
    const targetPath = core.getInput(Inputs.Path, {required: false})

    const artifactClient = artifact.create()
    if (!name) {
      // download all artifacts
      const downloadResponse = await artifactClient.downloadAllArtifacts(targetPath)
      core.info(`There were ${downloadResponse.length} artifacts downloaded`)
      for (const artifact of downloadResponse) {
        core.info(
          `Artifact ${artifact.artifactName} was downloaded to ${artifact.downloadPath}`
        )
      }
    } else {
      // download a single artifact
      const downloadOptions = {
        createArtifactFolder: true
      }
      const downloadResponse = await artifactClient.downloadArtifact(
        name,
        path.join(targetPath, name),
        downloadOptions
      )
      core.info(
        `Artifact ${downloadResponse.artifactName} was downloaded to ${downloadResponse.downloadPath}`
      )
    }
    core.info('Artifact download has finished successfully')
  } catch (err) {
    core.setFailed(err.message)
  }
}

run()
