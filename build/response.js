var Readable, Response, SleepHttpError,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Readable = require('stream').Readable;

SleepHttpError = (function(_super) {
  __extends(SleepHttpError, _super);

  function SleepHttpError(statusCode, message) {
    this.statusCode = statusCode;
    this.message = message;
    this.name = "MyCustomError";
    Error.captureStackTrace(this, SleepHttpError);
  }

  return SleepHttpError;

})(Error);

module.exports = Response = (function() {
  function Response(req, debug) {
    var parents, _ref;
    this.req = req;
    this.debug = debug;
    this.hal = false;
    this.headers = {
      'Content-Type': 'application/octet-stream'
    };
    this._status = 200;
    this.body = null;
    this._links = {
      self: {
        href: ((_ref = req.url.match(/(.*\/[^/]+)\/?$/)) != null ? _ref[1] : void 0) || '/'
      }
    };
    parents = this._links.self.href.split('/').slice(0, -1);
    if (parents.length > 0) {
      this._links.parent = {
        href: '/' + parents.join('/')
      };
    }
    this._embedded = {};
  }

  Response.prototype.setBody = function(promise) {
    return promise.then((function(_this) {
      return function(body) {
        if (body == null) {
          body = {};
        }
        if (body.statusCode != null) {
          _this.status(body.statusCode);
          delete body.statusCode;
        }
        _this.body = body;
        return _this;
      };
    })(this))["catch"]((function(_this) {
      return function(err) {
        var match, message, status, _i;
        if (_this.debug) {
          console.log('Error in Sleep Response:');
          console.log(err.stack);
        }
        if ((match = err.message.match(/^HTTP:(\d{3}) (.*)$/)) != null) {
          _i = match.length - 2, status = match[_i++], message = match[_i++];
          err.statusCode = +status;
          err.message = message;
        }
        _this.status(err.statusCode || 500);
        _this.body = {
          message: err.message
        };
        return _this;
      };
    })(this));
  };

  Response.prototype.require = function(object, key) {
    if (object[key] == null) {
      throw new ("Required '" + key + "' not present!");
    }
    return object[key];
  };

  Response.prototype["throw"] = function(status, message) {
    if (typeof status === 'string') {
      message = status;
      status = 400;
    }
    console.log('Throwing', status, message);
    throw new SleepHttpError(status, message);
  };

  Response.prototype.header = function(name, value) {
    if (value == null) {
      return this.headers[name];
    }
    this.headers[name] = value;
    return this;
  };

  Response.prototype.status = function(status) {
    if (status == null) {
      return this._status;
    }
    this._status = status;
    return this;
  };

  Response.prototype.embed = function(rel, obj, list) {
    var container, _base;
    if (list == null) {
      list = false;
    }
    if (list) {
      container = (_base = this._embedded)[rel] || (_base[rel] = []);
      return container.push(obj);
    } else {
      return this._embedded[rel] = obj;
    }
  };

  Response.prototype.link = function(rel, href, opts) {
    var link, _base;
    opts || (opts = {});
    link = {
      href: href
    };
    if (opts.templated) {
      link.templated = true;
    }
    if (opts.list) {
      return ((_base = this._links)[rel] || (_base[rel] = [])).push(link);
    } else {
      return this._links[rel] = link;
    }
  };

  Response.prototype.applyTo = function(res) {
    var header, value, _ref;
    res.statusCode = this._status;
    _ref = this.headers;
    for (header in _ref) {
      value = _ref[header];
      res.setHeader(header, value);
    }
    if (this.body instanceof Readable) {
      this.body.pipe(res);
      return;
    } else if (typeof this.body !== 'object') {
      res.end(this.body);
      return;
    }
    if (this.body instanceof Array) {
      this.body = {
        item: this.body
      };
    }
    res.setHeader('Content-Type', 'application/json');
    if (this.HAL) {
      this.body._links = this._links;
      this.body._embedded = this._embedded;
    }
    return res.end(JSON.stringify(this.body));
  };

  return Response;

})();
