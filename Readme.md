# UniSocket Server

[![Build Status](https://travis-ci.org/Morgul/unisocket-node.svg?branch=master)](https://travis-ci.org/Morgul/unisocket-node)

This is a Node.js server for [UniSocket][unisocket]. It supports the entire UniSocket specification, including channels
and replies.

## Getting Started

First thing first, you will need to `npm install unisocket`. Then, it's as simple as:

```javascript
var UniSocketServer = require('../unisocket');
var socketServer = new UniSocketServer().listen(4000);
```

For a completely working example, check out the example directory.

### Configuration

_Currently, configuration isn't used. This will change in the very near future._

You can pass configuration options to the `UniSocketServer` instance when you instantiate it:

```javascript
var UniSocketServer = require('../unisocket');
var socketServer = new UniSocketServer({ timeout: 4000 });
```

### Starting a server

There are two ways to start a UniSocket server. Either by calling `listen()`, or `attach()`. The difference is that
`listen()` starts its own http server. This server (available on the UniSocketServer instance as `httpServer`) is used
to serve the client javascript, and to attach the websocket server to.

If all you need is websockets, then you can simple do:

```javascript
var UniSocketServer = require('../unisocket');

var socketServer = new UniSocketServer()
var socketServer.listen(4000);
```

### Attaching to an existing server

If, like most applications, you instead will need to server http content as well as using websockets, you will need to
call `attach`. All you need to pass it is the already listening http server you created yourself.

```javascript
var http = require('http);
var UniSocketServer = require('../unisocket');


var httpServer = http.createServer().listen(4000);
var socketServer = new UniSocketServer().attach(httpServer);
```

### Using a Connect-style server

_Haven't figured this one out yet; but as I use connect a lot, I figure I'll sort this out eventually._

### Using the served client-side library

UniSocket Server conveniently serves the client-side javascript for your application. It is _highly recommended_ you use
the served version, as it has been tested with the version of UniSocket Server you've installed. Using a different
version could introduce bugs, or other issues.

In order to use the served javascript, simply add the following to your html page:

```html
<script src="/unisocket/$/client.js"></script>
```

Then, using it is as simple as:

```html
<script>
    var socket = unisocket.connect();
    socket.on('connected', function()
    {
        console.log('connected.');
        socket.emit('Hello World!');
    });
</script>
```

### Listening for messages

Once you've connected, you will want to listen for incoming messages, and respond to them. If you've ever used Socket.io
before, this should look familiar:

```javascript
socketServer.on('connection', function(client)
{
    client.on('test', function(data)
    {
        console.log('got data:', data);
    });
});
```

A couple of points to mention, however. First, you must listen for the `connection` event, and setup all of your
handlers inside of the callback for that event. The only argument passed to the `connection` event is a
`UniSocketClient` instance; this is the object that emits events for incoming messages. You need to listen for events on
_this_ object, if you want to be notified about incoming messages.

Event callbacks will be passed any additional arguments the message was sent with. (If a reply is desired, the last
argument will always be a callback. See "Replies" for more information.)

### Sending messages

Sending messages is as simple as emitting an event in node. (We've intentionally use the same API as `EventEmitter`
since this is a common pattern for node.js developers.)

```javascript
client.emit('test', "Some additional data.");
```

You can pass as many arguments as you want, and they will be passed to the client's message handler callback.

### Complete (Basic) Example

```javascript
//----------------------------------------------------------------------------------------------------------------------
// A simple example server.
//
// @module server.js
//----------------------------------------------------------------------------------------------------------------------

var UniSocketServer = require('../unisocket');

//----------------------------------------------------------------------------------------------------------------------

var socketServer = new UniSocketServer().listen(4000);

socketServer.on('connection', function(client)
{
    client.on('test', function(msg)
    {
        console.log('got:', msg);
    });
});

console.log('Server started.');

//----------------------------------------------------------------------------------------------------------------------
```

## Features

In addition to the basic usage, UniSocket Server supports some very useful features.

### Using Channels

UniSocket supports namespacing messages. These namespaces are called 'channels'. (Socket.io has a very similar feature.)
If you want to use channels, both the client and server side will need to listen on the same channel. To setup message
handlers on a particular channel, you would do the following:

```javascript
socketServer.channel('/example', function(client)
{
    client.on('test', function(data)
    {
        console.log('got data:', data);
    });
});
```

Instead of listening for the `connection` event, you instead register a callback for the `/example` channel. Then, when
the client connects to that channel, your callback will be called, and your message handlers registered. Besides that
slight change, everything works exactly the same.

(See the example folder for a client/server that uses channels.)

### Using Replies

Frequently, it's useful to be able to reply to an incoming message (or get a reply back from the client). UniSocket
makes this as easy as possible, and unlike Socket.io, replies are bi-directional. The client can send a message, and the
server can reply, or the server can send a message, and the client reply. The API is intentionally identical on both
sides.

_Note_: Replies have a configurable timeout, however, that timeout cannot be infinite. If a reply is expected, the other
side should always respond.

#### Expecting a reply

If your message expects a reply, the final argument to `emit` must be a callback. This callback function will be called
when the reply comes in, with any arguments included in the reply.

```javascript
client.emit('expects reply', "some data", function(replyData)
{
    console.log('responseData:', responseData);
});
```

#### Replying to a message

Replying to a message is also very straightforward. When a message comes in to the server that expects a reply, the
UniSocket Server builds a callback for you, and appends that to the list of arguments your message handler function gets
passed. This means the last argument is _always_ the callback.

To reply, simply call the callback, with whatever data you wish to send back.

```javascript
socketServer.on('connection', function(client)
{
    client.on('echo', function(msg, callback)
    {
        // Echo msg back to the client.
        callback(msg);
    });
});
```

## Tips

While the UniSocket Server is pretty simple to work with, there are some additional useful tips I felt might be
important to give examples of.

### Broadcasts

To do a broadcast, simply iterate over all the clients connected to the server:

```javascript
socketServer.clients.forEach(function(client)
{
    // Put your broadcast message here.
    client.emit('broadcast');
});
```

### Message names with spaces

UniSocket and UniSocket Server support message names with spaces in them. This means you can use phrases and sentence
fragments to describe the message; making it easier to understand what the message does. Here's an example:

```javascript
// Here's a single word message
client.emit('edit');

// Here's a message with underscores
client.emit('edit_blog');

// Here's a sentence fragment, with spaces
client.emit('edit blog post');
```

Personally, I find the last example the most readable, and encourage people to use UniSocket like that.

_Note_: There is one small caveat: some server implementations (like Erlang) might require a bit of syntactic sugar to
support message names with spaces. However, the specification states that any valid unicode character is supported in a
message name, so all compliant servers must have a way of handling this. It's just useful to keep this in mind.

## Tests

UniSocket Server has a complete suite of tests. Just run:

```bash
$ npm test
```

## Contributions

Feel free to make pull requests, fix bugs, add features, etc. We ask that all pull requests maintain the formatting and
style of the original file, and that all new features include tests. We reserve the right to refuse any features that
do not fit the project's goals.

### License

All code is licensed under the MIT license.

[unisocket]: https://github.com/Morgul/unisocket
