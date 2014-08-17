Sleep = require '../'

# Create a new server, and create a new resource
server = new Sleep
hello = server.resource 'hello'

# Add a handler to it to set a header
hello.use (req) ->
  @header 'x-hello', 'yes'

# Create a subresource with get handler
hello.resource('world').get (req) ->
  message: "Hello world!"

# Another but this one is variable
hello.resource(':name').get (req) ->
  {name} = req.params # Just like restify
  message: "Hello #{name}.."

# Let the server listen
server.listen 1337
