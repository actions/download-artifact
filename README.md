# Download-Artifact v2

This downloads artifacts from your build

See also [upload-artifact](https://github.com/actions/upload-artifact).

# What's new

- Download all artifacts at once
- Port entire action to typescript from a runner plugin so it is easier to collaborate and accept contributions

Refer [here](https://github.com/actions/download-artifact/tree/v1) for the previous version

# Usage

See [action.yml](action.yml)

# Download a Single Artifact

Basic (download to the current working directory):
```yaml
steps:
- uses: actions/checkout@v2

- uses: actions/download-artifact@v2
  with:
    name: my-artifact
    
- name: Display structure of downloaded files
  run: ls -R
```

Download to a specific directory:
```yaml
steps:
- uses: actions/checkout@v2

- uses: actions/download-artifact@v2
  with:
    name: my-artifact
    path: path/to/artifact
    
- name: Display structure of downloaded files
  run: ls -R
  working-directory: path/to/artifact
```
# Download All Artifacts

If the `name` input parameter is not provided, all artifacts will be downloaded. To differentiate between downloaded artifacts, a directory denoted by the artifacts name will be created for each individual artifact.

Example, if there are two artifacts `Artifact-A` and `Artifact-B`, and the directory is `etc/usr/artifacts/`, the directory structure will look like this:
```
  etc/usr/artifacts/
      Artifact-A/
          ... contents of Artifact-A
      Artifact-B/
          ... contents of Artifact-B
```

Download all artifacts to a specific directory
```yaml
steps:
- uses: actions/checkout@v2

- uses: actions/download-artifact@v2
  with:
    path: path/to/artifacts
    
- name: Display structure of downloaded files
  run: ls -R
  working-directory: path/to/artifacts
```

Download all artifacts to the current working directory
```yaml
steps:
- uses: actions/checkout@v2

- uses: actions/download-artifact@v2

- name: Display structure of downloaded files
  run: ls -R
```

# @actions/artifact package

Internally the [@actions/artifact](https://github.com/actions/toolkit/tree/master/packages/artifact) NPM package is used to interact with artifacts. You can find additional documentation there along with all the source code related to artifact download.


# License

The scripts and documentation in this project are released under the [MIT License](LICENSE)
