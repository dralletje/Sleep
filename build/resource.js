var Promise, Request, Resource, Response, formidable, http, path, querystring, _,
  __slice = [].slice;

path = require('path');

_ = require('lodash');

Promise = require('bluebird');

http = require('http');

Request = require('./request');

Response = require('./response');

RegExp.quote = function(str) {
  return str.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
};

module.exports = Resource = (function() {
  function Resource(debug) {
    this.resources = [];
    this.methods = {};
    this.uses = [];
    this.HAL = void 0;
    this.debug = debug || false;
  }

  Resource.prototype.method = function() {
    var fn, m, method, uses, _i;
    method = arguments[0], uses = 3 <= arguments.length ? __slice.call(arguments, 1, _i = arguments.length - 1) : (_i = 1, []), fn = arguments[_i++];
    m = method.toUpperCase();
    if (this.methods[m] != null) {
      throw new Error("Duplicate " + m + " handler set!");
    }
    this.methods[m] = uses.concat([fn]);
    return this;
  };

  Resource.prototype.use = function(fn) {
    this.uses.push(fn);
    return this;
  };

  Resource.prototype.resource = function() {
    var PARAMREG, args, parameters, resource, uri, uriRegExp;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    if (args[0] instanceof RegExp) {
      uriRegExp = args[0], parameters = args[1];
      if (parameters == null) {
        parameters = [];
      }
      if (!(parameters instanceof Array)) {
        parameters = [parameters];
      }
    } else {
      if ((args[0] == null) || args[0] === '') {
        throw new Error("First argument of .resource must be a non-empty string!");
      }
      uri = path.join.apply(path, args);
      if (uri.indexOf('/') === 0) {
        uri = uri.slice(1);
      }
      parameters = [];
      PARAMREG = /([^/]+)/;
      uri = '^\\/' + uri.split('/').map(function(segment) {
        if (segment.indexOf(':') === 0) {
          parameters.push(segment.slice(1));
          return PARAMREG.source;
        } else {
          return RegExp.quote(segment);
        }
      }).join('\\/');
      uriRegExp = new RegExp(uri);
    }
    resource = new Resource;
    this.resources.push({
      resource: resource,
      uriRegExp: uriRegExp,
      paramNames: parameters
    });
    return resource;
  };

  Resource.prototype.res = Resource.prototype.resource;

  Resource.prototype._bubble = function(req, response) {
    var promise, url;
    if (this.HAL != null) {
      response.hal = this.HAL;
    }
    url = req.url;
    promise = Promise.bind(response)["return"](req);
    this.uses.forEach(function(use) {
      return promise = promise.then(use)["return"](req);
    });
    return promise.then((function(_this) {
      return function() {
        var key, match, matching, paramname, params, _i, _len, _ref;
        matching = _.find(_this.resources, function(resource) {
          return url.match(resource.uriRegExp) != null;
        });
        if (matching == null) {
          if (['', '/'].indexOf(url) !== -1) {
            if (_this.methods[req.method] == null) {
              throw new Error("Method not allowed!");
            }
            promise = Promise.bind(response);
            _this.methods[req.method].forEach(function(fn) {
              return promise = promise["return"](req).then(fn);
            });
            return promise;
          }
          throw new Error("Resource not found!");
        }
        match = url.match(matching.uriRegExp);
        params = req.params || (req.params = {});
        _ref = matching.paramNames;
        for (key = _i = 0, _len = _ref.length; _i < _len; key = ++_i) {
          paramname = _ref[key];
          params[paramname] = match[key + 1];
        }
        req.url = url.slice(match[0].length);
        return matching.resource._bubble(req, response);
      };
    })(this));
  };

  Resource.prototype._forgeRequest = function(req) {
    var response;
    req._url = req.url != null ? req.url : req.url = '/';
    if (req.method == null) {
      req.method = 'GET';
    }
    response = new Response(req, this.debug);
    return response.setBody(Promise["try"](this._bubble, [req, response], this));
  };

  Resource.prototype.enableHAL = function(yesOrNo) {
    if (yesOrNo == null) {
      yesOrNo = true;
    }
    return this.HAL = yesOrNo;
  };

  Resource.prototype.listen = function(port, fn) {
    return this._server = http.createServer((function(_this) {
      return function(req, res) {
        return _this._forgeRequest(req).then(function(response) {
          return response.applyTo(res);
        });
      };
    })(this)).listen(port, fn);
  };

  return Resource;

})();

['get', 'post', 'put', 'delete'].forEach(function(method) {
  return Resource.prototype[method] = function() {
    var args;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    return this.method.apply(this, [method].concat(__slice.call(args)));
  };
});

formidable = require('formidable');

Resource.multipartBodyParser = function(opts) {
  if (opts == null) {
    opts = {};
  }
  return function(req) {
    var form;
    if (req.contentType !== "multipart/form-data") {
      return;
    }
    form = new formidable.IncomingForm();

    /*
    form.keepExtensions = (if opts.keepExtensions then true else false)
    form.onPart = onPart = (part) ->
      if part.filename and options.multipartFileHandler
        options.multipartFileHandler part, req
      else if not part.filename and options.multipartHandler
        options.multipartHandler part, req
      else
        form.handlePart part
     */
    return new Promise(function(yell, cry) {
      return form.parse(req, function(err, fields, files) {
        if (err != null) {
          return cry(err);
        }
        return yell([fields, files]);
      });
    }).spread(function(fields, files) {
      req.body = fields;
      return req.files = files;
    })["catch"](function(err) {
      throw err;
    });
  };
};

querystring = require("querystring");

Resource.formBodyParser = function() {
  return function(req) {
    if (req.contentType !== 'application/x-www-form-urlencoded') {
      return;
    }
    return req.loadBody().then(function(body) {
      var params;
      params = querystring.parse(body.toString());
      return req.body = params;
    })["catch"](function(e) {
      throw new Error("Invalid content");
    });
  };
};

Resource.jsonBodyParser = function() {
  return function(req) {
    if (req.contentType !== 'application/json') {
      return;
    }
    if (['POST', 'PUT'].indexOf(req.method) === -1) {
      return;
    }
    return req.loadBody().then(function(body) {
      var e;
      try {
        return req.body = JSON.parse(body);
      } catch (_error) {
        e = _error;
        return console.log('JSON ERROR :\'(', e);
      }
    });
  };
};

Resource.bodyParser = function() {
  var form, json, multipart;
  json = Resource.jsonBodyParser();
  multipart = Resource.multipartBodyParser();
  form = Resource.formBodyParser();
  return function(req) {
    return Promise.all([form(req), json(req), multipart(req)]);
  };
};

Resource.authorizationParser = function(options) {
  return function(req) {
    var credentials, scheme, _ref;
    req.authorization = {};
    if (!req.headers.authorization) {
      return;
    }
    _ref = req.headers.authorization.split(" ", 2), scheme = _ref[0], credentials = _ref[1];
    if (credentials == null) {
      throw new Error("HTTP:400 Invalid Authorization header!");
    }
    return req.authorization = {
      scheme: scheme.toLowerCase(),
      credentials: credentials,
      raw: scheme.toLowerCase() + " " + credentials
    };
  };
};
