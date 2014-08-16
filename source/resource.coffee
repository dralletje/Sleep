# Resource class

path = require 'path'
_ = require 'lodash'
Promise = require 'bluebird'
http = require 'http'

Request = require './request' # This is incorrect
Response = require './response'


RegExp.quote = (str) ->
  str.replace /([.?*+^$[\]\\(){}|-])/g, "\\$1"

module.exports = class Resource
  constructor: (debug) ->
    @resources = []
    @methods = {}
    @uses = []

    @HAL = undefined
    @debug = debug or no

  # Define /end/ function for a method on this resource
  method: (method, uses..., fn) ->
    m = method.toUpperCase()
    if @methods[m]?
      throw new Error "Duplicate #{m} handler set!"
    @methods[m] = uses.concat [fn]
    this # Chaining


  # Add a method to run for ALL request (in/passing) this resource
  use: (fn) ->
    @uses.push fn
    this # Chaining

  # Define a new resource point
  resource: (args...) ->
    # If it is a RegExp, do other things
    if args[0] instanceof RegExp
      [uriRegExp, parameters] = args

      parameters ?= []
      if parameters not instanceof Array
        parameters = [parameters]

    # Else, generate the regexp and parameters from url
    else
      if not args[0]? or args[0] is ''
        throw new Error "First argument of .resource must be a non-empty string!"

      uri = path.join args...
      # Remove slash in front
      if uri.indexOf('/') is 0
        uri = uri.slice 1

      # Split all seperate segments
      parameters = []
      PARAMREG = /([^/]+)/

      uri = '^\\/' + uri.split('/').map (segment) ->
        if segment.indexOf(':') is 0 # Parameter
          parameters.push segment.slice(1)
          PARAMREG.source
        else # Just a string literal
          RegExp.quote segment
      .join('\\/') # Join with escaped slashes
      uriRegExp = new RegExp uri

    resource = new Resource
    @resources.push
      resource: resource
      uriRegExp: uriRegExp
      paramNames: parameters
    resource

  # Alias for ::resource
  res: @::resource


  # Get request from listening or from a parent resource
  _bubble: (req, response) ->
    # Enable/Disable hall if this resource is supposed to
    if @HAL?
      response.hal = @HAL

    url = req.url
    #console.log '\nGot a request:', req

    promise = Promise.bind(response).return(req)
    @uses.forEach (use) ->
      promise = promise.then(use).return(req)

    promise.then =>
      # Check resources for a match
      matching = _.find @resources, (resource) ->
        url.match(resource.uriRegExp)?

      # If no match, error!
      if not matching?
        # Check if it could be for this resource
        if ['', '/'].indexOf(url) isnt -1
          # Request is for this resource!
          if not @methods[req.method]?
            throw new Error "Method not allowed!"

          promise = Promise.bind(response)
          @methods[req.method].forEach (fn) ->
            promise = promise.return(req).then(fn)
          return promise

        # If not, DIE!
        throw new Error "Resource not found!"

      match = url.match matching.uriRegExp # Yes, I know

      # Get the params
      params = req.params ||= {} # Get the already set params (or make a new empty object)
      for paramname, key in matching.paramNames
        params[paramname] = match[key+1]

      # Update the url
      req.url = url.slice match[0].length

      # Let it bubble up!
      matching.resource._bubble req, response


  # First bubble in a chain, does some extra stuff
  _forgeRequest: (req) ->
    req._url = req.url ?= '/' # Save origional url
    req.method ?= 'GET'

    # TODO: Check for existance of the resource:method first
    response = new Response req, @debug # Placeholder for the real response
    response.setBody Promise.try(@_bubble, [req, response], this)

  # This will disable or enable HAL in this resource
  # Subresources may overwrite this, as this also may overwrite super resources.
  enableHAL: (yesOrNo=yes) ->
    @HAL = yesOrNo


  # Change this resource into a server
  listen: (port, fn) ->
    @_server = http.createServer (req, res) =>
      # Go up the tree, all the way
      @_forgeRequest(req).then (response) ->
        response.applyTo res
    .listen port, fn

['get', 'post', 'put', 'delete'].forEach (method) ->
  Resource::[method] = (args...) ->
    @method method, args...





# PLUGINS, WILL MOVE THEM TO THEIR OWN FILE
formidable = require 'formidable'
Resource.multipartBodyParser = (opts) ->
  opts ?= {}

  (req) ->
    if req.contentType isnt "multipart/form-data" # or (req.getContentLength() is 0 and not req.isChunked())
      return

    form = new formidable.IncomingForm()
    ###
    form.keepExtensions = (if opts.keepExtensions then true else false)
    form.onPart = onPart = (part) ->
      if part.filename and options.multipartFileHandler
        options.multipartFileHandler part, req
      else if not part.filename and options.multipartHandler
        options.multipartHandler part, req
      else
        form.handlePart part
    ###
    new Promise (yell, cry) ->
      form.parse req, (err, fields, files) ->
        if err?
          return cry err
        yell [fields, files]

    .spread (fields, files) ->
      req.body = fields
      req.files = files

    .catch (err) ->
      #new BadRequestError(err.message)
      throw err

querystring = require("querystring")

Resource.formBodyParser = ->
  (req) ->
    if req.contentType isnt 'application/x-www-form-urlencoded'
      return

    req.loadBody().then (body) ->
      params = querystring.parse body.toString()
      #req._body = req.body
      req.body = params
    .catch (e) ->
      #throw new errors.InvalidContentError(e.message)
      throw new Error "Invalid content"


Resource.jsonBodyParser = ->
  (req) ->
    if req.contentType isnt 'application/json'
      return

    if ['POST', 'PUT'].indexOf(req.method) is -1
      return

    req.loadBody().then (body) ->
      try
        req.body = JSON.parse body
      catch e
        console.log 'JSON ERROR :\'(', e

Resource.bodyParser = ->
  json = Resource.jsonBodyParser()
  multipart = Resource.multipartBodyParser()
  form = Resource.formBodyParser()

  (req) ->
    Promise.all [
      form(req),
      json(req),
      multipart(req)
    ]

Resource.authorizationParser = (options) ->
  (req) ->
    # Fill to prevent /nullpoint/ errors
    req.authorization = {}

    unless req.headers.authorization
      return

    [scheme, credentials] = req.headers.authorization.split " ", 2
    if not credentials?
      throw new Error "HTTP:400 Invalid Authorization header!"

    # Fill the authorization
    req.authorization =
      scheme: scheme.toLowerCase()
      credentials: credentials
      raw: scheme.toLowerCase() + " " + credentials

    # Long ago, there was a code to parse Basic auth.
    # But then the basic auth was to basic, so it went home.
    # The code had no use anymore, and commited suicide.
    # Rest in peace, basic auth parse code.
