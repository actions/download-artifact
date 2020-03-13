# Download-Artifact v2 Preview

This downloads artifacts from your build

See also [upload-artifact](https://github.com/actions/upload-artifact).

# Usage

See [action.yml](action.yml)

# Download a Single Artifact

Basic (download to the current working directory):
```yaml
steps:
- uses: actions/checkout@v2

- uses: actions/download-artifact@v2-preview
  with:
    name: my-artifact
    
- run: cat my-artifact
```

Download to a specific directory:
```yaml

steps:
- uses: actions/checkout@v2

- uses: actions/download-artifact@v2-preview
  with:
    name: my-artifact
    path: path/to/artifact
    
- run: cat path/to/artifact
```
# Download All Artifacts

If the `name` input parameter is not provided, all artifacts will be downloaded. To differentiate between downloaded artifacts, a directory denoted by the artifacts name will be created for each individual artifact.

Example, if there are two artfiacts `Artifact-A` and `Artifact-B`, and the directory is `etc/usr/artifacts/`, the directory structure will look like this:
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

- uses: actions/download-artifact@v2-preview
  with:
    path: path/to/artifacts
    
- run: cat path/to/artifacts
```

Download all artifacts to the current working directory
```yaml
steps:
- uses: actions/checkout@v2

- uses: actions/download-artifact@v2-preview
```


# License

The scripts and documentation in this project are released under the [MIT License](LICENSE)
