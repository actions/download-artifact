# download-artifact

This downloads artifacts from your build.

# Usage

See [action.yml](action.yml)

Basic (download to current working directory):
```yaml
steps:
- uses: actions/checkout@master

- uses: actions/download-artifact@master
  with:
    name: my-artifact
    
- run: cat my-artifact
```

Download to specific directory:
```yaml

steps:
- uses: actions/checkout@master

- uses: actions/download-artifact@master
  with:
    name: my-artifact
    path: path/to/artifact
    
- run: cat path/to/artifact
```

# License

The scripts and documentation in this project are released under the [MIT License](LICENSE)
