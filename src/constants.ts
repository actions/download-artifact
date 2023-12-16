export enum Inputs {
  Name = 'name',
  Path = 'path',
  GitHubToken = 'github-token',
  Repository = 'repository',
  RunID = 'run-id',
  IfNotFound = 'if-not-found'
}

export enum Outputs {
  DownloadPath = 'download-path'
}

export enum NotFoundOptions {
  /**
   * Default. Output a warning but do not fail the action
   */
  warn = 'warn',

  /**
   * Fail the action with an error message
   */
  error = 'error',

  /**
   * Do not output any warnings or errors, the action does not fail
   */
  ignore = 'ignore'
}
