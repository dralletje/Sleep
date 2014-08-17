# Little response placeholder
Readable = require('stream').Readable

class SleepHttpError extends Error
  constructor: (@statusCode, @message) ->
    @name = "MyCustomError"
    Error.captureStackTrace(this, SleepHttpError)

module.exports = class Response
  constructor: (req) ->
    @req   = req
    @options = {}

    # Default headers
    @headers =
      'Content-Type': 'application/octet-stream'
    @_status = 200
    @body = null

    # HAL! (Do it anyway, in the end we will see
    # whether or not hall is enabled)
    @_links =
      self: href: req.url.match(/(.*\/[^/]+)\/?$/)?[1] or '/'

    parents = @_links.self.href.split('/').slice(0, -1)
    if parents.length > 0
      @_links.parent = href: '/' + parents.join('/')
    @_embedded = {}


  # Used by the latest resource that recieves the bound request
  setBody: (promise) ->
    promise.then (body) =>
      if not body?
        body = {}

      if body.statusCode?
        @status body.statusCode
        delete body.statusCode

      @body = body
      this

    .catch (err) =>
      if @options.debug
        console.log 'Error in Sleep Response:'
        console.log err.stack

      if (match = err.message.match /^HTTP:(\d{3}) (.*)$/)?
        [..., status, message] = match
        err.statusCode = +status # Type conversion
        err.message = message

      @status err.statusCode or 500
      @body =
        message: err.message
      this


  require: (object, key) ->
    if not object[key]?
      throw new "Required '#{key}' not present!"
    object[key]


  # Easy error spawning
  throw: (status, message) ->
    if typeof status is 'string'
      message = status
      status = 400

    # Throw it, so it will /most likely/ bubble to setBody
    console.log 'Throwing', status, message
    throw new SleepHttpError status, message


  # Easy set response status and headers
  header: (name, value) ->
    if not value?
      return @headers[name]
    @headers[name] = value
    this # Chaining

  status: (status) ->
    if not status?
      return @_status
    @_status = status
    this # Chaining


  # HAL Helpers
  embed: (rel, obj, list=false) ->
    if list
      container = @_embedded[rel] ||= []
      container.push obj
    else
      @_embedded[rel] = obj

  link: (rel, href, opts) ->
    opts ||= {}
    link =
      href: href
    if opts.templated
      link.templated = true

    if opts.list
      (@_links[rel] ||= []).push link
    else
      @_links[rel] = link


  # Send te response to a http response object
  applyTo: (res) ->
    res.statusCode = @_status
    for header, value of @headers
      res.setHeader header, value

    # If it is a stream or a non-object, just send it and do nothing else
    if @body instanceof Readable
      @body.pipe res
      return
    else if typeof @body isnt 'object'
      res.end @body
      return

    # If it is an object, HAL-ify it!
    if @body instanceof Array
      @body = item: @body

    # Using json for now, makes things easier for clients
    res.setHeader 'Content-Type', 'application/json'

    # If HAL, add HAL
    if @options.hal
      @body._links = @_links
      @body._embedded = @_embedded
    res.end JSON.stringify @body
