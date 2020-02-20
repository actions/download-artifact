import * as core from '@actions/core'
import * as artifact from '@actions/artifact'
import {Inputs} from './constants'

async function run(): Promise<void> {
  try {
    const name = core.getInput(Inputs.Name, {required: false})
    const path = core.getInput(Inputs.Path, {required: false})
    const artifactClient = artifact.create()

    if (!name) {
      // download all artifacts
      await artifactClient.downloadAllArtifacts(path)
    } else {
      // download a single artifact
      await artifactClient.downloadArtifact(name, path, {
        createArtifactFolder: false
      })
    }
  } catch (err) {
    core.setFailed(err.message)
  }
}

run()
