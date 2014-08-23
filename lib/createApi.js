var q = require('q'),
  fs = require('fs'),
  url = require('url'),
  createSessionRetriever = require('./createSessionRetriever'),
  http;

function defaultHost(){
  var arcrc = fs.readFileSync(process.env.HOME + '/.arcrc', {encoding:'utf8'});
  arcrc =  JSON.parse(arcrc);
  var hostname = Object.keys(arcrc.hosts)[0];
  var host = arcrc.hosts[hostname];
  host.api = hostname;
  return host;
}

module.exports = function(host){
  if(!host) host = defaultHost();
  host.url = url.parse(host.api);
  http = (host.url.protocol === "https:") ? require('https') : require('http');

  var getSession = createSessionRetriever(host);

  return function(api, params){
    param = params || {};

    return getSession().then(function(session){
      var deferred = q.defer();

      params.__conduit__ = {
        connectionID: session.data.connectionID,
        sessionKey: session.data.sessionKey
      };

      var formData = 'params=' + JSON.stringify(params) + '&output=json&__conduit__=1';
      var options = {
        host: session.host.url.host,
        port: (session.host.url.protocol === "https:") ? 443 : 80,
        path: '/api/' + api,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(formData)
        }
      };

      var req = http.request(options, function(res){
        if(res.statusCode !== 200) {
          deferred.reject(res);
          return;
        }

        var chunks = [];
        res.on('data', function(data){
          chunks.push(data);
        });

        res.on('end', function(){
          var data = JSON.parse(chunks.join(''));
          deferred.resolve(data);
        });
      });

      req.end(formData);

      return deferred.promise;
    });
  };
};

