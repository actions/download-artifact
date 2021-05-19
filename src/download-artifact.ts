import * as core from '@actions/core'
import * as github from '@actions/github'
import * as AWS from 'aws-sdk'
import * as os from 'os'
import * as fs from 'fs'
import path from 'path'
import {Inputs, Outputs} from './constants'

async function run(): Promise<void> {
  try {
    const name = core.getInput(Inputs.Name, {required: false})
    const chosenPath = core.getInput(Inputs.Path, {required: false})
    const s3Bucket = core.getInput(Inputs.S3Bucket, {required: false})
    const region = core.getInput(Inputs.Region, {required: false})

    let resolvedPath = ''
    // resolve tilde expansions, path.replace only replaces the first occurrence of a pattern
    if (chosenPath.startsWith(`~`)) {
      path.resolve()
      resolvedPath = path.resolve(chosenPath.replace('~', os.homedir()))
    } else {
      resolvedPath = path.resolve(chosenPath)
    }
    core.debug(`Resolved path is ${resolvedPath}`)
    // Create directory if it doesn't already exist
    if (!fs.existsSync(resolvedPath)) {
      core.debug(`Creating directory (${resolvedPath}) since it did not exist`)
      fs.mkdirSync(resolvedPath, {recursive: true})
    }
    const s3 = new AWS.S3({region: region})
    const s3Prefix = `${github.context.repo.owner}/${github.context.repo.repo}/${github.context.runId}/${name}/`
    const s3Params = {
      Bucket: s3Bucket,
      Prefix: s3Prefix
    }
    core.debug(JSON.stringify(s3Params))
    s3.listObjects(s3Params, function (err, data) {
      if (err) {
        throw err
      }
      if (!data.Contents) {
        throw new Error(`Could not find objects with ${s3Prefix}`)
      }
      for (const fileObject of data.Contents) {
        if (!fileObject.Key) {
          continue
        }
        const getObjectParams = {Bucket: s3Bucket, Key: fileObject.Key}
        const localKey = path.join(
          resolvedPath,
          fileObject.Key.replace(s3Prefix, '')
        )
        const writeStream = fs.createWriteStream(localKey)
        core.info(`Started download: ${localKey}`)
        core.debug(`S3 download uri: s3://${s3Bucket}/${fileObject.Key}`)
        const readStream = s3.getObject(getObjectParams).createReadStream()
        readStream.pipe(writeStream)
        writeStream.close()
        core.info(`Finished download for ${localKey}`)
      }
    })
    // output the directory that the artifact(s) was/were downloaded to
    // if no path is provided, an empty string resolves to the current working directory
    core.setOutput(Outputs.DownloadPath, resolvedPath)
    core.info('Artifact download has finished successfully')
  } catch (err) {
    core.setFailed(err.message)
  }
}

run()
