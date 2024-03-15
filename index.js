const fs   = require('fs');
const path = require("path");
const clc  = require('chalk');

let log = {
  logLevel: 'info',
  logDir: require('os').tmpdir(),
  basePath: path.dirname(require.main.filename)
};

module.exports = log;

log.warn = function(msg, relativePaths) {
  if (relativePaths) msg = msg.replace(log.basePath, "");
  console.warn(prefix() + "[warn] " + clc.yellow(msg));
}

log.debug = function(msg, relativePaths) {
  if (log.logLevel !== 'debug') return;
  if (relativePaths) msg = msg.replace(log.basePath, "");
  console.log(prefix() + "[debug] " + msg);
}

log.info = function(msg, relativePaths) {
  if (relativePaths) msg = msg.replace(log.basePath, "");
  console.log(prefix() + "[info] " + msg);
}

log.error = function(msg, exit, filePrefix, logDir) {

  if (!filePrefix) filePrefix = "errors";
  logDir = logDir || log.logDir;

  if (typeof msg !== "string") {
    // Error object
    console.error(msg);
    if (msg.message) {
      msg = msg.message;
    } else {
      msg = "No error message provided.";
    }
  }

  let fileName = filePrefix + "-" + ds(true) + ".log";
  let logFile = path.join(logDir, fileName);
  let post = exit ? "Exiting with status 1.": "";
  let consoleMsg = "";
  let fileMsg = "";
  if (msg.split("\n").length > 1) {
    if (post) {
      msg = msg + "\n" + post;
    }
    fileMsg = prefix() + "\n" + msg;
    consoleMsg = clc.red(` Error. Writing message to ${logFile}:\n---\n${msg}\n---`);
  } else {
    msg = msg + ". " + post;
    fileMsg = prefix() + " " + msg;
    consoleMsg = clc.red(` Error: ${msg.trim()}`);
  }

  if (!logDir) {
    // Log to console only.
    console.error(prefix() + "[error]" + consoleMsg);
    if (exit) {
      process.exit(1);
    }
  }

  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, {recursive: true});
      log.info("Created " + logDir);
    }
  } catch (err) {
    console.error("Could not create " + logDir);
    console.error(err);
    if (exit) {
      process.exit(1);
    }
  }

  console.error(prefix() + "[error]" + consoleMsg);
  try {
    fs.appendFileSync(logFile, fileMsg + "\n");
  } catch (err) {
    console.error("Could not append to " + logFile);
  }
  if (exit) {
    process.exit(1);
  }
}

log.write = function(msg, filePrefix, logDir) {

  if (!filePrefix) filePrefix = "write";
  logDir = logDir || log.logDir;

  try {
    makeLogDir(logDir);
  } catch (err) {
    log.error(err, false);
  }

  let fileName = path.join(logDir, filePrefix + "-" + ds(true) + ".log");
  msg = msg.replace(/\n/g, "\n" + ds() + " ");
  fs.appendFile(fileName, msg + "\n",
    (err) => {
      if (err) log.error(err.message)
  });
}

log.request = function(req, filePrefix, logDir) {

  if (req.originalUrl.startsWith("/js") || req.originalUrl.startsWith("/css")) {
    return;
  }

  if (!filePrefix) filePrefix = "requests";
  logDir = logDir || log.logDir;

  try {
    makeLogDir(logDir);
  } catch (err) {
    log.error(err, false);
  }

  let addr = req.headers['x-forwarded-for'] || req.connection.remoteAddress
  let fileName = path.join(logDir, filePrefix + "-" + ds(true) + ".log");
  let timeStamp = apacheTimeStamp();
  let msg = addr
          + ' - - [' + timeStamp + '] "GET ' + req.originalUrl + '"'
          + " HTTP/" + req.httpVersion + " " + req.res.statusCode
          + " " + req.socket.bytesWritten + ' "-" "-"';
  fs.appendFile(fileName, msg + "\n",
    (err) => {
      if (err) log.error(err.message)
  });
}

function makeLogDir(logDir) {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, {recursive: true});
    log.debug("Created " + logDir);
  }
}

function apacheTimeStamp() {
  let d = new Date();
  let isostr = d.toISOString();
  let date_s = isostr.split('T')[0].split("-");
  let time = isostr.split('T')[1].replace(/\.[0-9]{3}/,"").replace("Z"," +0000");
  let month = d.toDateString().split(" ")[1];
  return date_s[2] + "/" + month + "/" + date_s[0] + ":" + time;
}

function prefix() {
  if (log.logLevel === 'debug') {
    // Get file name and line number of function that called a log function.
    // TODO: Consider using https://github.com/itadakimasu/console-plus
    function CustomError() {
      // https://v8.dev/docs/stack-trace-api
      // https://github.com/nodejs/node/issues/7749#issuecomment-232972234
      const oldStackTrace = Error.prepareStackTrace;
      try {
        Error.prepareStackTrace = (err, structuredStackTrace) => structuredStackTrace;
        Error.captureStackTrace(this);
        this.stack; // Invoke the getter for `stack`.
      } finally {
        Error.prepareStackTrace = oldStackTrace;
      }
    }
    let idx = 3;
    const err = new CustomError();
    const functionName = err.stack[idx].getFunctionName();
    const fileName = err.stack[idx].getFileName();
    const lineNumber = err.stack[idx].getLineNumber();
    return (new Date()).toISOString() + " [" + fileName.replace(log.basePath + "/","") + "#L" + lineNumber + "] ";
  }
  return (new Date()).toISOString();
}

ds = function(dateOnly) {
  // Date string for logging.
  if (dateOnly) {
    return (new Date()).toISOString().split("T")[0];
  }
  return (new Date()).toISOString();
}
