# `@actions/download-artifact`

Download [Actions Artifacts](https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts) from your Workflow Runs. Internally powered by the [@actions/artifact](https://github.com/actions/toolkit/tree/main/packages/artifact) package.

See also [upload-artifact](https://github.com/actions/upload-artifact).

- [`@actions/download-artifact`](#actionsdownload-artifact)
  - [v4 - What's new](#v4---whats-new)
    - [Improvements](#improvements)
    - [Breaking Changes](#breaking-changes)
  - [Usage](#usage)
    - [Inputs](#inputs)
    - [Outputs](#outputs)
  - [Examples](#examples)
    - [Download Single Artifact](#download-single-artifact)
    - [Download All Artifacts](#download-all-artifacts)
    - [Download Artifacts from other Workflow Runs or Repositories](#download-artifacts-from-other-workflow-runs-or-repositories)
  - [Limitations](#limitations)
    - [Permission Loss](#permission-loss)


## v4 - What's new

> [!IMPORTANT]
> download-artifact@v4+ is not currently supported on GHES yet. If you are on GHES, you must use [v3](https://github.com/actions/download-artifact/releases/tag/v3).

The release of upload-artifact@v4 and download-artifact@v4 are major changes to the backend architecture of Artifacts. They have numerous performance and behavioral improvements.

For more information, see the [`@actions/artifact`](https://github.com/actions/toolkit/tree/main/packages/artifact) documentation.

### Improvements

1. Downloads are significantly faster, upwards of 90% improvement in worst case scenarios.
2. Artifacts can be downloaded from other workflow runs and repositories when supplied with a PAT.

### Breaking Changes

1. On self hosted runners, additional [firewall rules](https://github.com/actions/toolkit/tree/main/packages/artifact#breaking-changes) may be required.
2. Downloading artifacts that were created from `action/upload-artifact@v3` and below are not supported.

## Usage

### Inputs

```yaml
- uses: actions/download-artifact@v4
  with:
    # Name of the artifact to download.
    # Optional. If unspecified, all artifacts for the run are downloaded.
    name:

    # Destination path. Supports basic tilde expansion.
    # Optional. Defaults is $GITHUB_WORKSPACE
    path:

    # The GitHub token used to authenticate with the GitHub API.
    # This is required when downloading artifacts from a different repository or from a different workflow run.
    # Optional. If unspecified, the action will download artifacts from the current repo and the current workflow run.
    github-token:

    # The repository owner and the repository name joined together by "/".
    # If github-token is specified, this is the repository that artifacts will be downloaded from.
    # Optional. Default is ${{ github.repository }}
    repository:

    # The id of the workflow run where the desired download artifact was uploaded from.
    # If github-token is specified, this is the run that artifacts will be downloaded from.
    # Optional. Default is ${{ github.repository }}
    run-id:
```

### Outputs

| Name | Description | Example |
| - | - | - |
| `download-path` | Absolute path where the artifact(s) were downloaded | `/tmp/my/download/path` |

## Examples

### Download Single Artifact

Download to current working directory (`$GITHUB_WORKSPACE`):

```yaml
steps:
- uses: actions/download-artifact@v4
  with:
    name: my-artifact
- name: Display structure of downloaded files
  run: ls -R
```

Download to a specific directory (also supports `~` expansion):

```yaml
steps:
- uses: actions/download-artifact@v4
  with:
    name: my-artifact
    path: your/destination/dir
- name: Display structure of downloaded files
  run: ls -R your/destination/dir
```


### Download All Artifacts

If the `name` input parameter is not provided, all artifacts will be downloaded. **To differentiate between downloaded artifacts, a directory denoted by the artifacts name will be created for each individual artifact.**

Example, if there are two artifacts `Artifact-A` and `Artifact-B`, and the directory is `etc/usr/artifacts/`, the directory structure will look like this:

```
etc/usr/artifacts/
    Artifact-A/
        ... contents of Artifact-A
    Artifact-B/
        ... contents of Artifact-B
```

Download all artifacts to the current working directory:

```yaml
steps:
- uses: actions/download-artifact@v4
- name: Display structure of downloaded files
  run: ls -R
```

Download all artifacts to a specific directory:

```yaml
steps:
- uses: actions/download-artifact@v4
  with:
    path: path/to/artifacts
- name: Display structure of downloaded files
  run: ls -R path/to/artifacts
```

### Download Artifacts from other Workflow Runs or Repositories

It may be useful to download Artifacts from other workflow runs, or even other repositories. By default, the permissions are scoped so they can only download Artifacts within the current workflow run. To elevate permissions for this scenario, you can specify a `github-token` along with other repository and run identifiers:

```yaml
steps:
- uses: actions/download-artifact@v4
  with:
    name: my-other-artifact
    github-token: ${{ secrets.GH_PAT }} # token with actions:read permissions on target repo
    repository: actions/toolkit
    run-id: 1234
```

## Limitations

### Permission Loss

File permissions are not maintained during artifact upload. All directories will have `755` and all files will have `644`. For example, if you make a file executable using `chmod` and then upload that file, post-download the file is no longer guaranteed to be set as an executable.

If you must preserve permissions, you can `tar` all of your files together before artifact upload. Post download, the `tar` file will maintain file permissions and case sensitivity.

```yaml
- name: 'Tar files'
  run: tar -cvf my_files.tar /path/to/my/directory

- name: 'Upload Artifact'
  uses: actions/upload-artifact@v4
  with:
    name: my-artifact
    path: my_files.tar
```
