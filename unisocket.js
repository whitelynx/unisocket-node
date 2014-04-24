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

var _logger = require('omega-logger').getLogger('server');

//----------------------------------------------------------------------------------------------------------------------

function UniSocketServer(options)
{
    EventEmitter.call(this);

    this.options = options || {};

    // Support an alternative logger; must conform to the omega-logger api.
    this.logger = this.options.logger || _logger;

    this.wss = undefined;
    this.httpServer = undefined;
    this.clients = [];

    this.channels = {};
} // end UniSocketServer

util.inherits(UniSocketServer, EventEmitter);

//----------------------------------------------------------------------------------------------------------------------

UniSocketServer.prototype._connectEvents = function()
{
    var self = this;

    this.wss.on('connection', function(socket)
    {
        socket.on('message', self._handleControlMessages(socket));
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

UniSocketServer.prototype._handleControlMessages = function(socket)
{
    var self = this;

    return function(data, flags)
    {
        var message = JSON.parse(data);
        if(message.channel == '$control')
        {
            switch(message.name)
            {
                case 'connect':
                    // Send our reply, including the server's configuration.
                    socket.send(JSON.stringify({
                        name: 'connect',
                        channel: '$control',
                        replyTo: message.replyWith,
                        data: [self.options]
                    }));

                    // Build our client object
                    var client = new UniSocketClient(socket, undefined, self.options.logger);
                    client.on('close', function()
                    {
                        self.clients = _.remove(client, self.clients);
                    });

                    self.clients.push(client);
                    self.emit('connection', client);
                    break;

                case 'channel':
                    var channel = message.data[0];
                    if(channel in self.channels)
                    {
                        self.channels[channel].forEach(function(callback)
                        {
                            var client = new UniSocketClient(socket, channel, self.options.logger);
                            callback(client);
                        });
                    } // end if
                    break;

                default:
                    self.logger.warn("Unknown $control message:\n %s", _logger.dump(message));
                    break;
            } // end switch
        } // end if
    };
};

//----------------------------------------------------------------------------------------------------------------------
// Public API
//----------------------------------------------------------------------------------------------------------------------

UniSocketServer.prototype.channel = function(channel, callback)
{
    if(!this.channels[channel])
    {
        this.channels[channel] = [];
    } // end if

    this.channels[channel].push(callback);
}; // end channel

UniSocketServer.prototype.listen = function(port, fn)
{
    this.httpServer = http.createServer(function (req, res)
    {
        res.writeHead(501);
        res.end('Not Implemented');
    }); // end http.createServer

    this.httpServer.listen(port, fn);

    // Create ws server
    this.attach(this.httpServer);

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