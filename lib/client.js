//----------------------------------------------------------------------------------------------------------------------
// The implementation of a UniSocket Client.
//
// @module client.js
//----------------------------------------------------------------------------------------------------------------------

var util = require('util');
var EventEmitter = require('events').EventEmitter;

var _ = require('lodash');

//----------------------------------------------------------------------------------------------------------------------

function UniSocketClient(socket, channel)
{
    EventEmitter.call(this);

    this.channel = channel;
    this.socket = socket;

    this.seqId = 0;
    this.waitingCallbacks = {};

    // Connect up our events
    this._connectEvents();
} // end UniSocketClient

util.inherits(UniSocketClient, EventEmitter);

//----------------------------------------------------------------------------------------------------------------------

/**
 * Internal emit for emitting events. We do this because the `emit` function is actually used for sending websocket
 * messages.
 *
 * @private
 */
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
                callback.apply(message.data);
            }
            else
            {
                // TODO: Need a good logging framework.
                console.log("Warning, 'replyTo' without matching callback.")
            } // end if
        }
        else
        {
            this._emit.apply(this, [message.name].concat(message.data));
        } // end if
    } // end if
}; // end _handleMessage

//----------------------------------------------------------------------------------------------------------------------
// Public API
//----------------------------------------------------------------------------------------------------------------------

UniSocketClient.prototype.emit = function()
{
    var args = Array.prototype.slice.call(arguments);

    var message = {
        name: args[0],
        channel: this.channel,
        data: args.slice(1)
    }; // end message


    var maybeCallback = args[args.length - 1];
    if(typeof maybeCallback == 'function')
    {
        message.replyWith = this._getSeqId();

        this.waitingCallbacks[message.replyWith] = maybeCallback;
    } // end if

    this.socket.send(JSON.stringify(message));
}; // end emit

//----------------------------------------------------------------------------------------------------------------------

module.exports = UniSocketClient;

//----------------------------------------------------------------------------------------------------------------------