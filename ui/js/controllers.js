
app.controller('HeaderController', ['$scope', 'appconf', '$route', 'toaster', '$http', 'jwtHelper', 'menu',
function($scope, appconf, $route, toaster, $http, jwtHelper, menu) {
    $scope.title = appconf.title;
    //serverconf.then(function(_c) { $scope.serverconf = _c; });
    /*
    $scope.menu = [];
    menu.then(function(_menu) {
        $scope.menu = _menu;
        $scope.user = _menu.user;
    });
    */
    $scope.menu = menu;
    $scope.user = menu.user; //for app menu

    //var jwt = localStorage.getItem(appconf.jwt_id);
    //if(jwt) { $scope.user = jwtHelper.decodeToken(jwt); }
}]);

/*
app.controller('BodyController', ['$scope', 'appconf', 'jwtHelper',
function($scope, appconf, jwtHelper) {
    var jwt = localStorage.getItem(appconf.jwt_id);
    //var user = jwtHelper.decodeToken(jwt);
}]);
*/
app.controller('ListController', ['$scope', 'appconf', 'jwtHelper', 'toaster', '$http', 
function($scope, appconf, jwtHelper, toaster, $http)  {
    function load_sessions() {
        $http.get(appconf.api+'/sessions')
        .success(function(sessions) {
            //console.log(sessions);
            $scope.sessions = sessions;
        });
    }
    load_sessions();

    //TODO - I need to reload session after user close the terminal
    //should I use socketio, or just poll it? 
    
    //load user info
    /*
    $http.get(appconf.auth_api+'/me')
    .success(function(info) {
        $scope.user = info;
    });
    */

    $scope.start = function() {
        $http.post(appconf.api+'/start')
        .success(function(res) {
            //console.log(res);
            load_sessions();
        })
        .error(function(data, status) {
            toaster.error(data.message);
        });
    }

    /*
    //load user profile
    var jwt = localStorage.getItem(appconf.jwt_id);
    var user = jwtHelper.decodeToken(jwt);
    $http.get(appconf.profile_api+'/public/'+user.sub)
    .success(function(profile, status, headers, config) {
        $scope.profile = profile;
    })
    .error(function(data, status, headers, config) {
        console.dir(data);
        if(data && data.message) {
            toaster.error(data.message);
        }
    }); 
    */

    /*
    //load menu (TODO - turn this into a service?)
    $http.get(appconf.shared_api+'/menu/top')
    .then(function(res) {
        $scope.top_menu = res.data;
    });
    */
}]);

app.controller('SessionController', ['$scope', 'appconf', 'jwtHelper', 'toaster', '$routeParams',
function($scope, appconf, jwtHelper, toaster, $routeParams)  {

    var websh = document.getElementById("websh");
    var font = document.getElementById("fontcheck");
    /*
    Terminal.colors[256] = Terminal.defaultColors.bg = '#ffffff';
    Terminal.colors[257] = Terminal.defaultColors.fg = '#000000';
    */
    $(document.body).css("overflow", "hidden");

    appconf.socket.opts.query = {id: $routeParams.id};
    var socket = io.connect(appconf.socket.base, appconf.socket.opts);
    
    /*
    $scope.$watchGroup(['websh.clientWidth', 'websh.clientHeight'],
    function(newvalue, oldvalue, scope) {
        console.log("changed");
        resize();
    });    
    */
    //

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
            var rows = Math.floor(websh.clientHeight/font.offsetHeight);

            //resize if cols/rows changed
            if(term.cols != cols || term.rows != rows) {
                term.resize(cols,rows);
                socket.emit('resize', {cols: cols, rows: rows});
            }
        }

        var jwt = localStorage.getItem(appconf.jwt_id);
            
        //console.log("authenticating with "+jwt);
        socket.emit('authenticate', {token: jwt});
        socket.on('authenticated', function() {
            //console.log("socket.io authenticated");
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
                //window.close();
            });
            resize();
        });
        socket.on('disconnect', function(error) {
            $scope.$apply(function() {
                toaster.error(error);
            });
            /*
            if (error.type == "UnauthorizedError" || error.code == "invalid_token") {
            // redirect user to login page perhaps?
            console.log("User's token has expired");
            }
            */
        });

        $scope.$on("bg-splitter-resizing", resize);
        window.addEventListener("resize", resize);
    });
}]);

