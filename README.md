# download-artifact

This downloads artifacts from your build.

See also [upload-artifact](https://github.com/actions/upload-artifact).

# Usage

See [action.yml](action.yml)

Basic (download to current working directory):
```yaml
steps:
- uses: actions/checkout@v1

- uses: actions/download-artifact@v1
  with:
    name: my-artifact
    
- run: cat my-artifact
```

Download to specific directory:
```yaml

steps:
- uses: actions/checkout@v1

- uses: actions/download-artifact@v1
  with:
    name: my-artifact
    path: path/to/artifact
    
- run: cat path/to/artifact
```

# License

The scripts and documentation in this project are released under the [MIT License](LICENSE)
