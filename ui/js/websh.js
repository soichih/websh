(function() {
    'use strict';
    var service = angular.module('websh', [ 'app.config', 'angular-jwt', 'toaster', 'btford.socket-io' ]);
    service.component('websh', {
        bindings: {
            id: '='
        },
        controller: function($scope, appconf, toaster) {
            var websh = document.getElementById("websh");
            var font = document.getElementById("fontcheck");


            //this.$onInit = function() {
            appconf.websh.opts.query = {id: this.id};
            //console.log("session id");
            //console.dir(this.id);
            var socket = io.connect(appconf.websh.base, appconf.websh.opts);
            socket.on('connect', function() {
                var term = new Terminal({
                    cols: 200,
                    rows: 20,
                    //useStyle: true,
                    screenKeys: true,
                    cursorBlink: true
                });
                term.on('data', function(data) {
                    socket.emit('data', data);
                });
                term.on('title', function(title) {
                    socket.emit('title', title);
                    document.title = title;
                });
                term.open(websh);

                //sent by parent
                $scope.$on("websh_open", function() {
                    resize();
                });

                function resize() {
                    //figure out cols/rows
                    var cols = 0;
                    font.textContent = "";
                    while(font.offsetWidth < websh.clientWidth) {
                        cols++; 
                        var t = cols.toString();
                        font.textContent += t[t.length-1];
                    }
                    cols--;

                    //TODO websh is hidden until tab is opened..
                    if(cols < 80) cols = 80;
                    
                    //var rows = Math.floor(websh.clientHeight/font.offsetHeight);
                    var rows = 30;

                    //resize if cols/rows changed
                    if(term.cols != cols || term.rows != rows) {
                        term.resize(cols,rows);
                        socket.emit('resize', {cols: cols, rows: rows});
                    }
                }

                var jwt = localStorage.getItem(appconf.jwt_id);
                socket.emit('authenticate', {token: jwt});
                socket.on('authenticated', function() {
                    console.log("authenticated");
                    socket.on('data', function(data) {
                        try {
                            term.write(data);
                        } catch (e) {   
                            //probably a bug with term.js
                            console.dir(e);
                        }
                    });
                    socket.on('close', function() {
                        toaster.error('socket.io closed');
                    });
                    socket.on('disconnect', function() {
                        toaster.error('socket.io disconnected'); 
                        term.destroy();
                    });
                    socket.on('exit', function(ret) {
                        console.dir(ret);
                        term.destroy();
                        toaster.error('socket.io exited'); 
                    });

                    //somereason terminal doesn't send the prompt unless I enter something
                    //until I can figure out, let's send backspace .. to force the initial
                    //prompt to appear
                    socket.emit('data', '\b');

                    resize();
                });
                socket.on('disconnect', function(error) {
                    toaster.error(error);
                    /*
                    if (error.type == "UnauthorizedError" || error.code == "invalid_token") {
                    // redirect user to login page perhaps?
                    console.log("User's token has expired");
                    }
                    */
                });

                //$ctrl.$on("bg-splitter-resizing", resize);
                window.addEventListener("resize", resize);
            });
            //}

            //this.appconf = appconf;

        },
        templateUrl: 'bower_components/websh/ui/t/websh.html',
    });

})();
