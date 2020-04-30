import * as core from '@actions/core'
import * as artifact from '@actions/artifact'
import {Inputs} from './constants'

async function run(): Promise<void> {
  try {
    const name = core.getInput(Inputs.Name, {required: false})
    const path = core.getInput(Inputs.Path, {required: false})
    const artifactFolder = core.getInput(Inputs.ArtifactFolder, {
      required: false
    })

    // parse string input to a boolean
    const isFolderCreated = artifactFolder.toLocaleLowerCase() === 'true'

    const artifactClient = artifact.create()
    if (!name) {
      /** Download all artifacts at once
       *
       * When downloading all artifacts at once, a separate folder gets created for each artifact. There is currently no option to use
       * the artifactFolder input to specify if a folder should or should not be created for each artifact. Some extra work will have to be done
       * in the @actions/artifact package
       */
      const downloadResponse = await artifactClient.downloadAllArtifacts(path)
      core.info(`There were ${downloadResponse.length} artifacts downloaded`)
      for (const artifact of downloadResponse) {
        core.info(
          `Artifact ${artifact.artifactName} was downloaded to ${artifact.downloadPath}`
        )
      }
    } else {
      // download a single artifact
      const downloadOptions = {
        createArtifactFolder: isFolderCreated
      }
      const downloadResponse = await artifactClient.downloadArtifact(
        name,
        path,
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
