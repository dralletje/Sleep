## Extend for the request

http = require 'http'
Request = http.IncomingMessage
Promise = require 'bluebird'

readOnly = (obj, prop, get) ->
  Object.defineProperty obj::, prop,
    get: get


try
  # contentType getter
  readOnly Request, 'contentType', ->
    type = @headers['content-type']

    @_contentType ||= if not type?
        # RFC2616 section 7.2.1 # Restify stolen :p
        'application/octet-stream'
     else
        if (index = type.indexOf ';') is -1
            type
        else
            type.substring 0, index
catch error
  "Do very nothing.."


Request::loadBody = (opts) ->
  {timeout} = opts ||
    timeout: 2000 # Set a default timeout of 2 seconds

  if @_loadedBody?
    Promise.resolve @_loadedBody

  new Promise (yell, cry) =>
    body = []
    @on 'readable', ->
      data = @read()
      return unless data?
      body.push data
    .on 'end', =>
      @_loadedBody = Buffer.concat body
      yell @_loadedBody
    .on 'error', cry
  .timeout timeout
