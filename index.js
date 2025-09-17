const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
// const { title } = require('process');
const readline = require('readline');
const util = require('util')

// github context
const context = github.context

const runningRepo = typeof payload !== 'undefined' && payload ? core.getInput('repo') : 'neo4j/antora-log-analyzer'
// console.log(`runningRepo: ${runningRepo}`)
const failOnErrors = core.getInput('fail-on-errors') === 'true'
const failOnWarnings = core.getInput('fail-on-warnings') === 'true'

// A step in github actions can only emit 10 annotations
// or it might be 10 of each type...
const annotationsLimit = 10

// messages for files included in this build, but not in the source repo
let otherMsgs = false

// some colours for the log outputs
const ansiLabels = {
  warning: '\u001b[38;2;255;222;99m',
  error: '\u001b[38;2;255;0;0m',
  info: '\u001b[38;2;1;139;255m',
  cyan: '\u001b[38;5;6m',
  reset: '\x1B[m'
}

if (typeof payload !== 'undefined' && payload) {
  console.log(`The event payload: ${payload}`);
}
// const payload = JSON.stringify(context.payload, undefined, 2)


function processLineByLine(result) {

  try {
    let msgData = []    
    // const logFile = core.getInput('log-file')
    const logFile = typeof payload !== 'undefined' && payload ? core.getInput('log-file') : './log.json'

    const rl = readline.createInterface({
      input: fs.createReadStream(logFile),
      crlfDelay: Infinity
    });

    rl
      .on('line', (line) => {
        msgData.push(JSON.parse(line))
    })
      .on('close', () => {
        result(msgData)
    });

  } catch (e) {
      core.setFailed(e.message);
  }

}

function processLog()
{
    processLineByLine( result => {
      const msgData = result 

      let report = {
        annotations: [],
        messages: [],
        summary: {
          messages: msgData.length,
          info: msgData.filter(msg => msg.level == "info").length,
          warn: msgData.filter(msg => msg.level == "warn").length,
          errors: msgData.filter(msg => msg.level == "error").length
        }
      }


      let levelsInLog = []
      for(const msg of msgData) {
        levelsInLog.push(msg.level)
      } 
      let unique = a => [...new Set(a)];
      
      for (const level of unique(levelsInLog)) {
        report.annotations[level] = []
        // report.messages[level] = []
      }

      
      for(const msg of msgData) {
        if (msg.source) {
          if ( msg.source.worktree || msg.source.url.includes(runningRepo) ) {
          report.annotations[msg.level].push(constructAnnotation(msg))
        } else {
            otherMsgs = true
          }
        }
        report.messages.push(constructAnnotation(msg))

      }

      core.startGroup('Annotations')

      if (report.annotations.error) {
        for (const anno of report.annotations.error.slice(0,annotationsLimit)) {
          core.error(anno.msg, anno)
        }
      }

      if (report.annotations.warn) {
        for (const anno of report.annotations.warn.slice(0,annotationsLimit)) {
          core.warning(anno.msg, anno)
        }
      }

      if (otherMsgs === true) {
        core.notice(`The Antora log contains warnings or errors for files outside this repo. Check the log of this step for more details`)
      }

      core.endGroup()

      // core.startGroup('Antora log messages')

      // get a list of unique info.name values from report.messages
      const infoNames = [...new Set(report.messages.map(msg => msg.name))]
      for (const name of infoNames.sort()) {
        core.startGroup(name)
        for (const info of report.messages.filter(msg => msg.name == name)) {
          let annotationMsg = `${ansiLabels[info.level]}${info.level.toUpperCase()}${ansiLabels.reset}: (${info.name}) ${ansiLabels.cyan}${info.msg}${ansiLabels.reset}`
          if (info.url) {
            annotationMsg += `\n  source: ${info.url} (ref: ${info.refname})`
          }
          if (info.file) {
            annotationMsg += `\n  file: ${info.file}`
          }
          core.info(annotationMsg) // eslint-disable-line no-console
        }
        core.endGroup()
      }
      // core.endGroup()

      if (failOnErrors === true && levelsInLog.includes('error')) {
        core.setFailed(`Antora log contains one or more errors`);
      } else 
      if (failOnWarnings === true && ( levelsInLog.includes('warn') || levelsInLog.includes('warning'))) {
        core.setFailed(`Antora log contains one or more warnings`);
      }
        
    });
}

processLog()

const constructAnnotation = function (msg) {

  const file = fileToAnnoFile(msg)

  let annotation

  if (file) {

    annotation = {
      file: file.replace(/^\/+/, ''),
      startLine: msg.file.line ? msg.file.line : '',
      title: msg.name,
      msg: msg.msg,
      url: checkHeadRef(file,msg.source.url),
      refname: msg.source.refname,
      level:levelToAnnoLevel(msg.level),
      name: msg.name
    }

  } else {

      annotation = {
        title: msg.name,
        msg: msg.msg,
        level:levelToAnnoLevel(msg.level),
        name: msg.name
      }

      
  }
  
  return annotation
}

const checkHeadRef = function (file,url) {

  if (context.payload.pull_request) {
    return context.payload.pull_request.html_url + '/commits/' + context.payload.pull_request.head.sha
  }

  if (context.payload.commits) {
    return context.payload.commits[0].url
  }
  
  return url
}

const levelToAnnoLevel = function (level) {
  const annoLevel = level == 'warn' ? 'warning' : level
  return annoLevel
}

const fileToAnnoFile = function (msg) {
  if (!msg.source) return ''
  const file = msg.source.worktree ? msg.file.path.replace(msg.source.worktree,'') : msg.file.path
  return file
}

