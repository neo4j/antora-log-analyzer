const core = require('@actions/core');
const github = require('@actions/github');
const { ChildProcess } = require('child_process');

const fs = require('fs');
const { title } = require('process');
const readline = require('readline');
const util = require('util')

const annotationsLimit = 10
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
        report.messages[level] = []
      }

      
      for(const msg of msgData) {
        if (msg.source.worktree) {
          report.annotations[msg.level].push(constructAnnotation(msg))
        } else {
          report.messages[msg.level].push(constructAnnotation(msg))
        }

      }

      for (const anno of report.annotations.error.slice(0,annotationsLimit)) {
        core.error(anno)
      }

      for (const anno of report.annotations.warn.slice(0,(annotationsLimit - report.annotations.error.length))) {
        core.warning(anno)
      }

      if (report.messages.warn.length || report.messages.error.length) {
        console.log(report.messages)
        core.info('The Antora log contains warnings or errors for files outside this repo')
      }


    // console.log(report.annotations)
    


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

  const annotation = {
    file: file,
    line: msg.file.line ? msg.file.line : '',
    title: file,
    msg: msg.msg,
    url: msg.source.url,
    refname: msg.source.refname
  }
  
  return annotation
}

function levelToAnnoLevel(level) {
  const annoLevel = level == 'warn' ? 'warning' : level
  return annoLevel
}

function fileToAnnoFile(msg) {
  const file = msg.source.worktree ? msg.file.path.replace(msg.source.worktree,'') : msg.file.path   
  return file
}