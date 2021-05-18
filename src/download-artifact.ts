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

    let resolvedPath = ''
    // resolve tilde expansions, path.replace only replaces the first occurrence of a pattern
    if (chosenPath.startsWith(`~`)) {
      path.resolve()
      resolvedPath = path.resolve(chosenPath.replace('~', os.homedir()))
    } else {
      resolvedPath = path.resolve(chosenPath)
    }
    core.debug(`Resolved path is ${resolvedPath}`)
    const s3 = new AWS.S3()
    const s3Prefix = `${github.context.repo.owner}/${github.context.repo.repo}/${github.context.runId}/${name}`
    s3.listObjects({Bucket: s3Bucket, Prefix: s3Prefix}, function (err, data) {
      if (!data.Contents || err) {
        core.error(err)
        return
      }
      for (const fileObject of data.Contents) {
        if (!fileObject.Key) {
          continue
        }
        const localKey = fileObject.Key.replace(s3Prefix, '')
        core.info(`Downloading ${localKey}`)
        core.debug(`S3 download uri: s3://${s3Bucket}/${fileObject.Key}`)
        s3.getObject({Bucket: s3Bucket, Key: fileObject.Key}, function (
          err,
          fileContents
        ) {
          if (err) {
            core.error(`Error downloading ${localKey}`)
            throw err
          }
          fs.writeFileSync(
            path.resolve(resolvedPath, localKey),
            fileContents.Body?.toString()
          )
          core.info(`DONE: ${localKey}`)
        })
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
