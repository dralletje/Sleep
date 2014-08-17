# Sleep

Rest server framework, but not sinatra like, but more object (resource) oriented,
as it should be!

Altough it is written in Coffeescript (and so are all examples),
it is compiled and can be used in every javascript project.

## Quickstart

    $ npm install sleeprest

And then get it a simple hello world example using

```coffeescript
Sleep = require 'sleeprest'

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

```

# API

## Resource
In Sleep, everything is a resource.
This is the main class you get when doing `require 'sleeprest'`.

***
### `new Resource([options])`
This creates a resource with nothing on him.
Most of the time you want to start this way,
and add subresources from here.

You may provide an options object, more on that soon.

***
### `.get|post|put|delete([Function<request> before...,] Function<request> handler)`

Add a function to handle request to the current resource, with the specified method.
This will not catch anything flowing down to a subresource.
the before functions will run before the handler,
so they can alter the request and response, or throw an error.

The return value of the handler function is converted into the desired format
and send as response. You can use promises to make you code asynchronous.
Personally I use and recommend bluebird which is to be found here:
https://github.com/petkaantonov/bluebird

When an array is returned it is wrapped

***
### `.use(Function<request>)`

Add a function to the general handler chain.
It will run on every request and will be able to alter
the request and response. Connect/Express like.

***
### `.resource(path[, names])`
Alias: `.res(path[, name])`

Create a subresource.
This will catch anything that doesn't fit in the current resource,
and matches the path description you've given.

Path can be a string or a RegExp.
When it is a string, it is parsed sinatra like:
a path with possible :variable values.
A very common pattern is

```coffeescript
parent = server.resource 'items'
### ... add code to list and post items ... ###

child = parent.resource ':item'
### ... add code to get, put and delete the item ... ###
```

When a variable like :item is found,
the value will be stored in `req.params` with the
variable name as key (eg: `item: value`).

When requesting the url `GET /items/5` it will run the handler
on the child resource with `req.params = item: 5`.

If the path is a RexExp, it will be matched and if it matches,
it will be stored in req.params too, with the capture groups as values and
`names` as keys. When `names` is not an array, it will be wrapped in one :p


***
### `.set(key[, value])`

Sets an option value for the resource.
Only two options right now:
- hal: Whether or not to enable HAL support.
- debug: Whether or not to show much information.

***
### `.listen(port, ...)`

Does exactly the same as the http server listen method.
And yes, every resource can be turned into a server,
even while it also used as a subresource!
http://nodejs.org/api/http.html#http_server_listen_port_hostname_backlog_callback


## Request
http://nodejs.org/api/http.html#http_http_createserver_requestlistener
Only has more properties set by handlers
and has `.params` filled with the url params.


## Response
Soon... ^^
