const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
// const { title } = require('process');
const readline = require('readline');
const util = require('util')


// A step in github actions can only emit 10 annotations
// or it might be 10 of each type...
const annotationsLimit = 10

// some colours for the log outputs
const ansiLabels = {
  warning: '\u001b[38;2;255;222;99m',
  error: '\u001b[38;2;255;0;0m',
  info: '\u001b[38;2;1;139;255m',
  cyan: '\u001b[38;5;6m',
  reset: '\033[m'
}

const runningRepo = typeof payload !== 'undefined' && payload ? core.getInput('repo') : 'recrwplay/antora-actions'

// const payload = JSON.stringify(github.context.payload, undefined, 2)
// console.log(`The event payload: ${payload}`);

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


      let levels = []
      for(const msg of msgData) {
        levels.push(msg.level)
      } 
      let unique = a => [...new Set(a)];
      
      for (const level of unique(levels)) {
        report.annotations[level] = []
        // report.messages[level] = []
      }

      
      for(const msg of msgData) {
        if (msg.source && ( msg.source.worktree || msg.source.url.includes(runningRepo) ) ) {
          report.annotations[msg.level].push(constructAnnotation(msg))
        } 
        report.messages.push(constructAnnotation(msg))

      }

      core.startGroup('Annotations')

      for (const anno of report.annotations.error.slice(0,annotationsLimit)) {
        core.error(anno.msg, anno)
      }

      for (const anno of report.annotations.warn.slice(0,(annotationsLimit - report.annotations.error.length))) {
        core.warning(anno.msg, anno)
      }

      if (report.messages.length) {
        // console.log(report.messages)
        core.notice('The Antora log contains warnings or errors for files outside this repo')
      }

      core.endGroup()

      core.startGroup('Antora log messages')

      for (const info of report.messages) {
        // console.log(info)
        if (info.name == 'asciidoctor') {
          core.info(`${ansiLabels[info.level]}${info.level.toUpperCase()}${ansiLabels.reset}: (${info.name}) ${ansiLabels.cyan}${info.msg}\n${ansiLabels.reset}  file: ${info.href}/${info.file}\n`)
        } else {
          core.info(`${ansiLabels[info.level]}${info.level.toUpperCase()}${ansiLabels.reset}: (${info.name}) ${ansiLabels.cyan}${info.msg}\n${ansiLabels.reset}`)
        }
        
      }

      core.endGroup()

    });
}

// function processLog() {
//   const msgData = processLineByLine()
//   console.log(msgData)
// }

processLog()

function groupBy(objectArray, property) {
  return objectArray.reduce(function (acc, obj) {
    let key = obj[property]
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(obj)
    return acc
  }, {})
}

function constructAnnotation(msg) {

  const file = fileToAnnoFile(msg)

  let annotation

  if (msg.name == 'asciidoctor') {

    annotation = {
      file: file.replace(/^\/+/, ''),
      startLine: msg.file.line ? msg.file.line : '',
      title: file.replace(/^\/+/, ''),
      msg: msg.msg,
      url: msg.source.url,
      href: hrefFromUrl(msg.source),
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

function levelToAnnoLevel(level) {
  const annoLevel = level == 'warn' ? 'warning' : level
  return annoLevel
}

function fileToAnnoFile(msg) {
  if (!msg.source) return ''
  const file = msg.source.worktree ? msg.file.path.replace(msg.source.worktree,'') : msg.file.path   
  return file
}

function hrefFromUrl(source) {
  const href = source.url.replace('.git','') + '/tree/' + source.refname
  return href
}