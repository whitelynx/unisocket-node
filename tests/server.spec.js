// ---------------------------------------------------------------------------------------------------------------------
// Unit Tests for the server.spec.js module.
//
// @module server.spec.js
// ---------------------------------------------------------------------------------------------------------------------

var http = require('http');
var assert = require('assert');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var WebSocket = require('ws');

var UniSocketServer = require('../unisocket');
var UniSocketClient = require('../lib/client');

// ---------------------------------------------------------------------------------------------------------------------

function FakeSocketServer()
{
    EventEmitter.call(this);
} // end FakeSocketServer
util.inherits(FakeSocketServer, EventEmitter);
FakeSocketServer.prototype.send = function(data){ this.emit('send', data) };

// ---------------------------------------------------------------------------------------------------------------------

describe('UniSocketServer', function()
{
    var wss;
    var server;
    var options = { replyTimeout: 1000 };
    beforeEach(function()
    {
        wss = new FakeSocketServer();
        server = new UniSocketServer(options);
        server.wss = wss;

        // Since we're not calling listen or attach, we have to do this ourselves.
        server._connectEvents();
    });

    it('emits `error` on error events', function(done)
    {
        server.on('error', function(error)
        {
            assert.equal(error, "Some Error!");
            done();
        });

        wss.emit('error', "Some Error!");
    });

    it('emits `headers` on headers events', function(done)
    {
        server.on('headers', function(headers)
        {
            assert.deepEqual(headers, ['foo', 'bar']);
            done();
        });

        wss.emit('headers', ['foo', 'bar']);
    });

    it('listens on the provided port when `listen` is called', function(done)
    {
        server.listen(4004);

        var ws = new WebSocket('ws://localhost:4004');
        ws.on('open', function()
        {
            done();
        });
    });

    it('attaches to an existing `httpServer` instance when the `attach` function is called', function(done)
    {
        var httpServer = http.createServer();
        httpServer.listen(4000);

        server.attach(httpServer);

        var ws = new WebSocket('ws://localhost:4000');
        ws.on('open', function()
        {
            done();
        });
    });

    xit('serves client library', function()
    {
        //TODO: This should use a http get request to test.
    });

    describe('Connection', function()
    {
        it('listens for incoming connections', function(done)
        {
            var socket = new FakeSocketServer();
            server._handleControlMessages = function(socket)
            {
                done();
                return function(){};
            };

            wss.emit('connection', socket);
            socket.emit('message');
        });

        it('replies with the configured options on `connection` message', function(done)
        {
            var socket = new FakeSocketServer();

            socket.on('send', function(message)
            {
                message = JSON.parse(message);

                assert.deepEqual(message.data[0], options);
                done();
            });

            wss.emit('connection', socket);
            socket.emit('message', JSON.stringify({
                name: 'connect',
                channel: '$control',
                replyWith: '1'
            }));
        });

        it('emits the `connection` signal once the client and server have finished their handshake', function(done)
        {
            var socket = new FakeSocketServer();

            server.on('connection', function(client)
            {
                done();
            });

            wss.emit('connection', socket);
            socket.emit('message', JSON.stringify({
                name: 'connect',
                channel: '$control',
                replyWith: '1'
            }));
        });

        it('returns a UniSocketClient instance when a websocket connection is made', function(done)
        {
            var socket = new FakeSocketServer();

            server.on('connection', function(client)
            {
                assert(client instanceof UniSocketClient);
                done();
            });

            wss.emit('connection', socket);
            socket.emit('message', JSON.stringify({
                name: 'connect',
                channel: '$control',
                replyWith: '1'
            }));
        });

        it('removes the client when the websocket disconnects', function(done)
        {
            var socket = new FakeSocketServer();

            server.on('connection', function(client)
            {
                // Check that we have one client
                assert.equal(server.clients.length, 1);

                // Simulate a close event
                client._emit('close');

                // Check that we no longer have any clients
                assert.equal(server.clients.length, 0);
                done();
            });

            wss.emit('connection', socket);
            socket.emit('message', JSON.stringify({
                name: 'connect',
                channel: '$control',
                replyWith: '1'
            }));
        });
    });

    describe('Channels', function()
    {
        it('stores the channel callback passed to the `channel` function', function()
        {
            var cb = function(client){};
            server.channel('foobar', cb);

            assert.equal(server.channels['foobar'][0], cb);
        });

        it('calls the registered channel callbacks on a `channel` message', function(done)
        {
            var socket = new FakeSocketServer();

            // Register for a channel
            server.channel('foobar', function(client)
            {
                assert(client instanceof UniSocketClient);
                done();
            });

            // When the server sends the reply, we send the channel message
            socket.on('send', function(message)
            {
                socket.emit('message', JSON.stringify({
                    name: 'channel',
                    channel: '$control',
                    data: ['foobar']
                }));
            });

            wss.emit('connection', socket);
            socket.emit('message', JSON.stringify({
                name: 'connect',
                channel: '$control',
                replyWith: '1'
            }));
        });
    });
});

// ---------------------------------------------------------------------------------------------------------------------