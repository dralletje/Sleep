var Promise, Request, error, http, readOnly;

http = require('http');

Request = http.IncomingMessage;

Promise = require('bluebird');

readOnly = function(obj, prop, get) {
  return Object.defineProperty(obj.prototype, prop, {
    get: get
  });
};

try {
  readOnly(Request, 'contentType', function() {
    var index, type;
    type = this.headers['content-type'];
    return this._contentType || (this._contentType = type == null ? 'application/octet-stream' : (index = type.indexOf(';')) === -1 ? type : type.substring(0, index));
  });
} catch (_error) {
  error = _error;
  "Do very nothing..";
}

Request.prototype.loadBody = function(opts) {
  var timeout;
  timeout = (opts || {
    timeout: 2000
  }).timeout;
  if (this._loadedBody != null) {
    Promise.resolve(this._loadedBody);
  }
  return new Promise((function(_this) {
    return function(yell, cry) {
      var body;
      body = [];
      return _this.on('readable', function() {
        var data;
        data = this.read();
        if (data == null) {
          return;
        }
        return body.push(data);
      }).on('end', function() {
        _this._loadedBody = Buffer.concat(body);
        return yell(_this._loadedBody);
      }).on('error', cry);
    };
  })(this)).timeout(timeout);
};
