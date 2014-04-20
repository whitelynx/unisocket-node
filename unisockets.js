//----------------------------------------------------------------------------------------------------------------------
// The main entry point for the UniSocket server.
//
// @module unisockets.js
//----------------------------------------------------------------------------------------------------------------------

var http = require('http');
var wss = require('ws');

var util = require('util');
var EventEmitter = require('events').EventEmitter;

var _ = require('lodash');

var UniSocketClient = require('./lib/client');

//----------------------------------------------------------------------------------------------------------------------

function UniSocketServer(options)
{
    EventEmitter.call(this);

    this.options = options || {};

    this.wss = undefined;
    this.httpServer = undefined;
    this.clients = [];
} // end UniSocketServer

util.inherits(UniSocketServer, EventEmitter);

//----------------------------------------------------------------------------------------------------------------------

UniSocketServer.prototype._connectEvents = function()
{
    var self = this;

    this.wss.on('connection', function(socket)
    {
        var client = new UniSocketClient(socket);

        client.on('close', function()
        {
            _.remove(client, self.clients);
        });

        self.clients.push(client);

        self.emit('connection', client);
    });

    // Create pass-through events
    _.each(['error', 'headers'], function(eventName)
    {
        self.wss.on(eventName, function()
        {
            var args = Array.prototype.slice.call(arguments);
            self.emit.apply(self, [eventName].concat(args));
        });
    });
};

//----------------------------------------------------------------------------------------------------------------------
// Public API
//----------------------------------------------------------------------------------------------------------------------

UniSocketServer.prototype.listen = function(port, fn)
{
    this.httpServer = http.createServer(function (req, res)
    {
        res.writeHead(501);
        res.end('Not Implemented');
    }); // end http.createServer

    server.listen(port, fn);

    // Create ws server
    this.attach(server, options);

    // Allow chaining
    return this;
}; // end listen

UniSocketServer.prototype.attach = function(server)
{
    this.wss = new wss.Server({ server: server });

    // Connect events
    this._connectEvents();

    // Allow chaining
    return this;
}; // end attach

//----------------------------------------------------------------------------------------------------------------------

module.exports = UniSocketServer;

//----------------------------------------------------------------------------------------------------------------------