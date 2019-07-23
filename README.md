# download-artifact

This downloads artifacts from your build.

# Usage

See [action.yml](action.yml)

Basic (upload current working directory):
```yaml
actions:
- uses: actions/checkout@latest

- uses: actions/download-artifact@latest
  with:
    name: my-artifact
    
- run: cat my-artifact
```

Download to specific directory:
```yaml

actions:
- uses: actions/checkout@latest

- uses: actions/download-artifact@latest
  with:
    name: my-artifact
    path: path/to/artifact
    
- run: cat path/to/artifact/my-artifact
```

# License

The scripts and documentation in this project are released under the [MIT License](LICENSE)
