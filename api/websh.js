#!/usr/bin/node
'use strict';

var server = require('./server');
server.start(function(err) {
    console.log("waiting for incoming connections...");
});

