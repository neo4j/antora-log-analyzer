# Antora Log Analyzer

GitHub action to read json log output from Antora.
Creates Github actions annotations based on warnings and errors in the log file, and can be used to mark a workflow as failed if warnings or errors are found.

## Usage

```yaml
    - name: Analyze Antora log
      id: antora-log-check-test
      uses: recrwplay/antora-log-analyzer@main
      with:
        log-file: ${{ inputs.logFile }}
        fail-on-errors: ${{ inputs.failOnErrors }}
        fail-on-warnings: ${{ inputs.failOnWarnings }}
```

| Parameter   | Description | Default |
| ----------- | ----------- | ------- |
| log-file | The Antora log file to be analyzed | `./log.json` |
| fail-on-warnings  | Mark the calling workflow run as failed if the Antora log contains warnings | false |
| fail-on-errors  | Mark the calling workflow run as failed if the Antora log contains warnings | true |
