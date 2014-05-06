//----------------------------------------------------------------------------------------------------------------------
// The implementation of a UniSocket Client.
//
// @module client.js
//----------------------------------------------------------------------------------------------------------------------

var util = require('util');
var EventEmitter = require('events').EventEmitter;

var _ = require('lodash');

var _logger = require('omega-logger').getLogger('client');

//----------------------------------------------------------------------------------------------------------------------

function UniSocketClient(socket, channel, options)
{
    EventEmitter.call(this);

    this.channel = channel;
    this.socket = socket;

    this.options = _.defaults(options || {}, {
        timeout: 30000,
        logger: _logger
    });

    this.logger = this.options.logger;

    this.seqId = 0;
    this.waitingCallbacks = {};

    // Connect up our events
    this._connectEvents();
} // end UniSocketClient

util.inherits(UniSocketClient, EventEmitter);

//----------------------------------------------------------------------------------------------------------------------

// Internal emit for emitting events. We do this because the `emit` function is actually used for sending websocket
// messages.
UniSocketClient.prototype._emit = function()
{
    var args = Array.prototype.slice.call(arguments);
    EventEmitter.prototype.emit.apply(this, args);
}; // end _emit

UniSocketClient.prototype._connectEvents = function()
{
    var self = this;
    this.socket.on('message', this._handleMessage.bind(this));

    // Create pass-through events
    _.each(['error', 'close'], function(eventName)
    {
        self.socket.on(eventName, function()
        {
            var args = Array.prototype.slice.call(arguments);
            self._emit.apply(self, [eventName].concat(args));
        });
    });
}; // end _connectEvents

UniSocketClient.prototype._getSeqId = function()
{
    this.seqId++;
    return this.seqId.toString();
}; // _getSeqId

UniSocketClient.prototype._handleMessage = function(data, flags)
{
    var self = this;
    var message = JSON.parse(data);

    // Make sure message.data is a list
    message.data = message.data || [];

    // Handle the multiple names for the root channel
    if((message.channel == '/') || (message.channel == ''))
    {
        message.channel = undefined;
    } // end if

    // Only process this message if it's for our channel
    if(message.channel == this.channel)
    {
        // Reply Support
        if(message.replyTo)
        {
            var callback = this.waitingCallbacks[message.replyTo];
            if (callback)
            {
                callback.apply(this, message.data);
            }
            else
            {
                this.logger.warn("'replyTo' without matching callback.");
            } // end if
        }
        else
        {
            var cb = [];

            // If the message is expecting a return, we need to provide a callback
            if(message.replyWith)
            {
                function returnCB()
                {
                    var args = Array.prototype.slice.call(arguments);

                    self.socket.send(JSON.stringify({
                        name: message.name,
                        channel: message.channel,
                        replyTo: message.replyWith,
                        data: args
                    }));
                } // end returnCB

                cb.push(returnCB);
            } // end if

            this._emit.apply(this, [message.name].concat(message.data).concat(cb));
        } // end if
    } // end if
}; // end _handleMessage

//----------------------------------------------------------------------------------------------------------------------
// Public API
//----------------------------------------------------------------------------------------------------------------------

/**
 * Send a message to the client.
 *
 * If the last argument is a function, it is treated as a callback, and a reply is expected from the client. The
 * callback is called with the data of the reply.
 *
 * @param {string} messageName - The name of the message being sent to the client.
 * @param {...*} [args] - Optional data to send to the client.
 * @param {function} [callback] - Called with the reply from the client.
 */
UniSocketClient.prototype.emit = function(messageName)
{
    var self = this;
    var args = Array.prototype.slice.call(arguments);

    var data = args.slice(1);
    data = _.compact(data);

    var message = {
        name: args[0],
        channel: this.channel,
        data: data
    }; // end message

    var maybeCallback = args[args.length - 1];
    if(typeof maybeCallback == 'function')
    {
        message.replyWith = this._getSeqId();
        message.data.splice(message.data.length - 1, 1);

        // Set up timeout handler
        var handle = setTimeout(function()
        {
            // Handle timeout
            self.logger.error("Timeout waiting for response.");
            self._emit("timeout", message);
        }, this.options.timeout || 30000);

        // Store callback
        this.waitingCallbacks[message.replyWith] = function()
        {
            // Cancel Timeout
            clearTimeout(handle);

            // Call callback
            var args = Array.prototype.slice.call(arguments);
            maybeCallback.apply(self, args);
        };
    } // end if

    this.socket.send(JSON.stringify(message));
}; // end emit

//----------------------------------------------------------------------------------------------------------------------

module.exports = UniSocketClient;

//----------------------------------------------------------------------------------------------------------------------
