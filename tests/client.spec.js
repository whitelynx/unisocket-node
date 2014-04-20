// ---------------------------------------------------------------------------------------------------------------------
// Unit Tests for the client.spec.js module.
//
// @module client.spec.js
// ---------------------------------------------------------------------------------------------------------------------

var assert = require("assert");
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var UniSocketClient = require('../lib/client');

// ---------------------------------------------------------------------------------------------------------------------

function FakeSocket()
{
    EventEmitter.call(this);
} // end FakeSocket
util.inherits(FakeSocket, EventEmitter);
FakeSocket.prototype.send = function(data){ this.emit('send', data) };

// ---------------------------------------------------------------------------------------------------------------------

describe('UniSocket Client', function()
{
    var client;
    var socket;
    beforeEach(function()
    {
        socket = new FakeSocket();
        client = new UniSocketClient(socket);
    });

    it('sends messages', function(done)
    {
        socket.on('send', function(data)
        {
            assert.equal("{\"name\":\"test\",\"data\":[]}", data);
            done();
        });

        client.emit('test');
    });

    it('sends messages with data', function(done)
    {
        socket.on('send', function(data)
        {
            assert.equal("{\"name\":\"test\",\"data\":[{\"foo\":\"bar\"},[1,2,3,4,5]]}", data);
            done();
        });

        client.emit('test', {foo: "bar"}, [1, 2, 3, 4, 5]);
    });

    it('sends messages with spaces', function(done)
    {
        socket.on('send', function(data)
        {
            assert.equal("{\"name\":\"test message with spaces\",\"data\":[]}", data);
            done();
        });

        client.emit('test message with spaces');
    });

    it('receives messages', function(done)
    {
        client.on('test', function()
        {
            done();
        });

        socket.emit('message', "{\"name\":\"test\",\"data\":[]}");
    });

    it('receives messages with data', function(done)
    {
        client.on('test', function(data)
        {
            assert.deepEqual({ foo: "bar" }, data);
            done();
        });

        socket.emit('message', "{\"name\":\"test\",\"data\":[{\"foo\": \"bar\"}]}");
    });

    it('receives messages with spaces', function(done)
    {
        client.on('test message with spaces', function()
        {
            done();
        });

        socket.emit('message', "{\"name\":\"test message with spaces\",\"data\":[]}");
    });

    describe("Channels", function()
    {
        it("supports the root channel being undefined, blank, or '/'", function(done)
        {
            var count = 0;

            client.on('test', function()
            {
                count++;

                if(count == 3)
                {
                    done();
                } // end if
            });

            socket.emit('message', "{\"name\":\"test\",\"data\":[]}");
            socket.emit('message', "{\"name\":\"test\",\"data\":[], \"channel\":\"\"}");
            socket.emit('message', "{\"name\":\"test\",\"data\":[], \"channel\":\"/\"}");
        });

        it("emits events for it's channel", function(done)
        {
            client.channel = "/test-channel";
            client.on('test', function()
            {
                done();
            });

            socket.emit('message', "{\"name\":\"test\",\"data\":[], \"channel\":\"/test-channel\"}");
        });

        it("does not emit events on the root channel", function(done)
        {
            client.channel = "/test-channel";
            client.on('test', function()
            {
                done(new Error("Emitted a root channel event."));
            });

            socket.emit('message', "{\"name\":\"test\",\"data\":[]}");

            setTimeout(done, 10);
        });

        it("ignores events for other channels", function(done)
        {
            client.channel = "/test-channel";
            client.on('test', function()
            {
                done(new Error("Emitted a root channel event."));
            });

            socket.emit('message', "{\"name\":\"test\",\"data\":[], \"channel\":\"/other-channel\"}");

            setTimeout(done, 10);
        });
    });

    describe("Replies", function()
    {
        xit("saves the callback for reply messages", function()
        {

        });

        xit("calls the callback for reply messages", function()
        {

        });

        xit("adds a 'replyTo' field for outgoing replies", function()
        {

        });
    });
});

// ---------------------------------------------------------------------------------------------------------------------