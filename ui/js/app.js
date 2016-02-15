'use strict';

var app = angular.module('app', [
    'app.config',
    'btford.socket-io',
    //'bgDirectives',
    'ngRoute',
    'ngAnimate',
    'ngCookies',
    'toaster',
    'angular-jwt',
    'sca-shared',
]);

/*
app.factory('socket', ['appconf', 'socketFactory', function(appconf, socketFactory) {
    return socketFactory({
        ioSocket: io.connect(appconf.socket.base, appconf.socket.opts)
    });
}]);
*/

//configure route
app.config(['$routeProvider', 'appconf', function($routeProvider, appconf) {
    $routeProvider
    .when('/list', {
        templateUrl: 't/list.html',
        controller: 'ListController',
        requiresLogin: true
    })
    .when('/session/:id', {
        templateUrl: 't/session.html',
        controller: 'SessionController',
        requiresLogin: true
    })
    .otherwise({
        redirectTo: '/list'
    });
}]).run(['$rootScope', '$location', 'toaster', 'jwtHelper', 'appconf', function($rootScope, $location, toaster, jwtHelper, appconf) {
    $rootScope.$on("$routeChangeStart", function(event, next, current) {
        //console.log("route changed from "+current+" to :"+next);
        //redirect to /login if user hasn't authenticated yet
        if(next.requiresLogin) {
            var jwt = localStorage.getItem(appconf.jwt_id);
            if(jwt == null || jwtHelper.isTokenExpired(jwt)) {
                //TODO - use $cookies.set("messages") to send messages to user service
                //toaster.warning("Please login first");
                //localStorage.setItem('post_auth_redirect', next.originalPath);
                sessionStorage.setItem('auth_redirect', window.location.toString());
                window.location = appconf.auth_url;
                event.preventDefault();
            }
        }
    });
}]);

/*
//show loading bar at the top
app.config(['cfpLoadingBarProvider', '$logProvider', function(cfpLoadingBarProvider, $logProvider) {
    //console.log("bar provider");
    cfpLoadingBarProvider.includeSpinner = false;
    //$logProvider.debugEnabled(true); //I read it's enabled by default
}]);

*/
//configure httpProvider to send jwt unless skipAuthorization is set in config (not tested yet..)
app.config(['appconf', '$httpProvider', 'jwtInterceptorProvider', 
function(appconf, $httpProvider, jwtInterceptorProvider) {
    jwtInterceptorProvider.tokenGetter = function(jwtHelper, config, $http) {
        //don't send jwt for template requests
        if (config.url.substr(config.url.length - 5) == '.html') {
            return null;
        }
        var jwt = localStorage.getItem(appconf.jwt_id);
        if(!jwt) return null; //not jwt

        //TODO - I should probably put this in $interval instead so that jwt will be renewed regardless
        //of if user access server or not.. (as long as the page is opened?)
        //(also, make it part of shared or auth module?)
        var expdate = jwtHelper.getTokenExpirationDate(jwt);
        var ttl = expdate - Date.now();
        if(ttl < 0) {
            console.log("jwt expired");
            return null;
        } else if(ttl < 3600*1000) {
            //console.dir(config);
            console.log("jwt expiring in an hour.. refreshing first");
            //jwt expring in less than an hour! refresh!
            return $http({
                url: appconf.auth_api+'/refresh',
                skipAuthorization: true,  //prevent infinite recursion
                headers: {'Authorization': 'Bearer '+jwt},
                method: 'POST'
            }).then(function(response) {
                var jwt = response.data.jwt;
                //console.log("got renewed jwt:"+jwt);
                localStorage.setItem(appconf.jwt_id, jwt);
                return jwt;
            });
        }
        return jwt;
    }
    $httpProvider.interceptors.push('jwtInterceptor');
}]);

app.factory('menu', ['appconf', '$http', 'jwtHelper', '$sce', 'scaMessage', 'scaMenu', '$q',
function(appconf, $http, jwtHelper, $sce, scaMessage, scaMenu, $q) {

    var jwt = localStorage.getItem(appconf.jwt_id);
    var menu = {
        header: {
            //label: appconf.title,
            //icon: $sce.trustAsHtml("<img src=\""+appconf.icon_url+"\">"),
            //url: "#/",
        },
        top: scaMenu,
        user: null, //to-be-loaded
        //_profile: null, //to-be-loaded
    };

    var jwt = localStorage.getItem(appconf.jwt_id);
    if(jwt) menu.user = jwtHelper.decodeToken(jwt);
    /*
    if(menu.user) {
        $http.get(appconf.profile_api+'/public/'+menu.user.sub).then(function(res) {
            menu._profile = res.data;
            if(res.data) {
                //logged in, but does user has email?
                if(res.data.email) {
                    return menu; //TODO - return return to what?
                } else {
                    //force user to update profile
                    //TODO - do I really need to?
                    scaMessage.info("Please update your profile before using application.");
                    sessionStorage.setItem('profile_settings_redirect', window.location.toString());
                    document.location = appconf.profile_url;
                }
            } else {
                //not logged in.
                return menu; //TODO return to what?
            }
        });
    }
    */
    return menu;
}]);

