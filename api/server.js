'use strict';

//node
var http = require('http');

//contrib
var pty = require('pty.js');
var terminal = require('term.js');
var express = require('express');
var bodyParser = require('body-parser');
var winston = require('winston');
var expressWinston = require('express-winston');
var keycode = require('ansi-keycode');
var tty = require('tty.js');
var jwt = require('express-jwt');
var socketio = require('socket.io');

//mine
var config = require('./config/config');
var logger = new winston.Logger(config.logger.winston);
//var controllers = require('./controllers');

//init express
var app = express();
app.use(bodyParser.json()); 
app.use(expressWinston.logger(config.logger.winston));
//if(config.express.jwt) app.use(require('express-jwt')(config.express.jwt.public_key));

//TODO not sure what this does
/*
app.use(function(req, res, next) {
  var setHeader = res.setHeader;
  res.setHeader = function(name) {
    switch (name) {
      case 'Cache-Control':
      case 'Last-Modified':
      case 'ETag':
        return;
    }
    return setHeader.apply(res, arguments);
  };
  next();
});
*/

//catalog of all user sessions
var io = null;
var sessions = {};

app.get('/health', function(req, res) { res.json({status: 'running'}); });

//list user's current sessions
app.get('/sessions', jwt({secret: config.express.jwt.public_key}), function(req, res) {
    if(!sessions[req.user.sub]) {
        sessions[req.user.sub] = [];
    }
    var _sessions = [];
    sessions[req.user.sub].forEach(function(session) {
        _sessions.push({id: session.id, title: session.title});
    });
    res.json(_sessions);
});

//start a new session
app.post('/start', jwt({secret: config.express.jwt.public_key}), function(req, res, next) {
    if(!sessions[req.user.sub]) {
        sessions[req.user.sub] = [];
    }

    if(req.user.sub != '1') { //hayashis
    //if(req.user.scopes && req.user.scopes.websh && ~res.user.scopes.websh.indexOf("create_session")) {
        return next(new Error("not authorized: sub:"+req.user.sub));
    }

    var session = {
        id: sessions[req.user.sub].length,
        term: null,
        title: 'untitled',
        //buff: [], 
        //socket: null
    }
    sessions[req.user.sub].push(session);

    logger.info("forking for sub:"+req.user.sub+" session id:"+session.id);
    session.term = pty.fork(process.env.SHELL || 'sh', [], {
        name: require('fs').existsSync('/usr/share/terminfo/x/xterm-256color')
        ? 'xterm-256color'
        : 'xterm',
        /*
        cols: 80,
        rows: 24,
        */
        cwd: process.env.HOME
    });
    session.term.on('data', function(data) {
        /*
        if(session.socket) {
            session.socket.emit('data', data);
        }
        */
        io.to(req.user.sub+"/"+session.id).emit('data', data);
    });
    session.term.on('exit', function(code, signal) {
        io.to(req.user.sub+"/"+session.id).emit('exit', {code: code, signal: signal});
        //remove from session array
        var id = sessions[req.user.sub].indexOf(session);
        sessions[req.user.sub].splice(id,1);
    });

    res.json({status: "ok"});
});

app.use(terminal.middleware()); //TODO - what does this do?

//error handling
app.use(expressWinston.errorLogger(config.logger.winston)); 
app.use(function(err, req, res, next) {
    logger.error(err);
    logger.error(err.stack);
    res.status(err.status || 500);
    res.json({message: err.message, /*stack: err.stack*/}); //let's hide callstack for now
});
process.on('uncaughtException', function (err) {
    logger.error((new Date).toUTCString() + ' uncaughtException:', err.message)
    logger.error(err.stack)
});

exports.app = app;
exports.start = function(cb) {
    var port = process.env.PORT || config.express.port || '8080';
    var host = process.env.HOST || config.express.host || 'localhost';
    var server = app.listen(port, host, function() {
        if(cb) cb();
        console.log("ISDP request handler listening on port %d in %s mode", port, app.settings.env);
    });

    logger.debug("sstarting socketio");
    io = socketio.listen(server);
    io.on('connection', require('socketio-jwt').authorize({
        secret: config.express.jwt.public_key,
        timeout: 15000 // 15 seconds to send the authentication message
    })).on('authenticated', function(socket) {
        logger.debug("socketio authenticated");
        var sub = socket.decoded_token.sub;
        var id = socket.handshake.query.id;
        //find session
        var session = null;
        if(!sessions[sub]) {
            logger.error("no such sub:"+sub+ " disconnecting");
            return socket.disconnect();
        }
        logger.debug("looking for session id:"+id);
        sessions[sub].forEach(function(_session) {
            if(_session.id == id) session = _session;
        });
        if(!session) {
            logger.error("no such session id:"+id+" disconnecting");
            return socket.disconnect();
        }

        socket.join(sub+"/"+id);
        
        //send screen clear sequence
        session.term.resize();
        //session.term.write("\u001b[2J\u001b[0");

        //session.socket = socket;
        socket.on('resize', function(data) {
            //logger.debug(data);
            session.term.resize(data.cols, data.rows);
        });
        socket.on('data', function(data) {
            session.term.write(data);
        });
        socket.on('title', function(title) {
            logger.debug('title update:'+title);
            session.title = title;
        });
        socket.on('disconnect', function() {
            //nothing I need to do - socket.io should take care of it.
            //session.socket = null;
        });
    }).on('unauthorized', function(socket) {
        //TODO - not tested (from https://github.com/auth0/socketio-jwt/issues/54#issuecomment-155031247)
        logger.debug("failed to validate jwt token");     
    }).on('error', function(err) {
        logger.error(err);
    });
};


