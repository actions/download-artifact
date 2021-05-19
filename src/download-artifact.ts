import * as core from '@actions/core'
import * as github from '@actions/github'
import * as AWS from 'aws-sdk'
import * as os from 'os'
import * as fs from 'fs'
import path from 'path'
import {Inputs, Outputs} from './constants'

function doDownload(
  s3: AWS.S3,
  s3Bucket: string,
  fileKey: string,
  writeStream: fs.WriteStream
): Promise<void> {
  return new Promise(function (resolve, reject) {
    const getObjectParams = {Bucket: s3Bucket, Key: fileKey}
    core.debug(`S3 download uri: s3://${s3Bucket}/${fileKey}`)
    s3.getObject(getObjectParams)
      .createReadStream()
      .on('end', () => resolve())
      .on('error', error => reject(error))
      .pipe(writeStream)
  })
}

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
    const s3 = new AWS.S3({region: region})
    const s3Prefix = `${github.context.repo.owner}/${github.context.repo.repo}/${github.context.runId}/${name}/`
    const s3Params = {
      Bucket: s3Bucket,
      Prefix: s3Prefix
    }
    core.debug(JSON.stringify(s3Params))
    const objects = await s3.listObjects(s3Params).promise()
    if (!objects.Contents) {
      throw new Error(`Could not find objects with ${s3Prefix}`)
    }
    core.info(
      `Found ${objects.Contents.length} objects with prefix ${s3Prefix}`
    )
    let num = 1
    for (const fileObject of objects.Contents) {
      if (!fileObject.Key) {
        continue
      }
      const localKey = path.join(
        resolvedPath,
        fileObject.Key.replace(s3Prefix, '')
      )
      const localKeyDir = path.dirname(localKey)
      if (!fs.existsSync(localKeyDir)) {
        core.debug(`Creating directory (${localKeyDir}) since it did not exist`)
        fs.mkdirSync(localKeyDir, {recursive: true})
      }
      core.info(
        `Starting download (${num}/${objects.Contents.length}): ${localKey}`
      )
      await doDownload(
        s3,
        s3Bucket,
        fileObject.Key,
        fs.createWriteStream(localKey)
      )
      core.info(
        `Finished download (${num}/${objects.Contents.length}): ${localKey}`
      )
      num++
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
