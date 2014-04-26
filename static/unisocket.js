// ---------------------------------------------------------------------------------------------------------------------
// UniSocket Client-side library, version 0.9.0.
//
// @module unisocket.js
// ---------------------------------------------------------------------------------------------------------------------

(function()
{
    //------------------------------------------------------------------------------------------------------------------
    // A mini event emitter implementation from: https://github.com/jeromeetienne/microevent.js
    // Copyright (c) 2011 Jerome Etienne, http://jetienne.com (See LICENSE file for MIT License.)
    //------------------------------------------------------------------------------------------------------------------

    var MicroEvent = function(){};
    MicroEvent.prototype = {
        on: function(event, fct){
            this._events = this._events || {};
            this._events[event] = this._events[event]	|| [];
            this._events[event].push(fct);
        },
        removeListener: function(event, fct){
            this._events = this._events || {};
            if( event in this._events === false  )	return;
            this._events[event].splice(this._events[event].indexOf(fct), 1);
        },
        emit: function(event){
            this._events = this._events || {};
            if( event in this._events === false  )	return;
            for(var i = 0; i < this._events[event].length; i++){
                this._events[event][i].apply(this, Array.prototype.slice.call(arguments, 1));
            }
        }
    };

    //------------------------------------------------------------------------------------------------------------------
    //------------------------------------------------------------------------------------------------------------------

    function UniSocketClient()
    {
        this.ws = undefined;

        this.seqId = 0;
        this.waitingCallbacks = {};
    } // end UniSocketClient

    // Inherit from MicroEvent
    UniSocketClient.prototype = new MicroEvent();
    UniSocketClient.prototype._emit = MicroEvent.prototype.emit;

    //------------------------------------------------------------------------------------------------------------------

    UniSocketClient.prototype._getSeqId = function()
    {
        this.seqId++;
        return this.seqId.toString();
    }; // end _getSeqId

    UniSocketClient.prototype._connectEventHandlers = function()
    {
        var self = this;

        this.ws.onerror = this._buildEventHandler('error');
        this.ws.onclose = this._buildEventHandler('close');
        this.ws.onmessage = this._onMessage.bind(this);
        this.ws.onopen = this._onOpen.bind(this);

        // Bind to our own close event, so we can cleanup the ws object.
        this.on('close', function() { self.ws = undefined; });
    }; // end _connectEventHandlers

    UniSocketClient.prototype._buildEventHandler = function(eventName)
    {
        var self = this;
        return function(){ self._emit.apply(this, [eventName].concat(Array.prototype.slice.call(arguments, 0))); };
    }; // end _buildEventHandler

    UniSocketClient.prototype._onOpen = function()
    {
        var self = this;

        var seqID = this._getSeqId();
        this.ws.send(JSON.stringify({
            name: 'connect',
            channel: '$control',
            replyWith: seqID
        }));

        this.waitingCallbacks[seqID] = function(options)
        {
            self.options = options;
            self._emit('connected');
        };
    }; // end _onOpen

    UniSocketClient.prototype._onMessage = function(messageEvent)
    {
        var message = JSON.parse(messageEvent.data);

        // Make sure message.data is a list
        message.data = message.data || [];

        // Handle the multiple names for the root channel
        if((message.channel == '/') || (message.channel == ''))
        {
            message.channel = undefined;
        } // end if

        // Only process this message if it's for our channel
        if(message.channel == this.channel || message.channel == '$control')
        {
            // Reply Support
            if (message.replyTo)
            {
                var callback = this.waitingCallbacks[message.replyTo];
                if (callback)
                {
                    callback.apply(this, message.data);
                }
                else
                {
                    console.error("'replyTo' without matching callback.");
                } // end if
            }
            else
            {
                this._emit.apply(this, [message.name].concat(message.data));
            } // end if
        } // end if
    }; // end _onMessage

    //------------------------------------------------------------------------------------------------------------------

    UniSocketClient.connect = function(host)
    {
        var client = new UniSocketClient();
        host = host || "";

        // Pull some parsing magic; we turn whatever the user gives us into an object with parameters `host`, `port`,
        // `channel`. This is the simplest way to parse the vast number of ways we support connecting.
        try
        {
            var re = /^(?:http:\/\/)?(\w+)?:?(\d+)?(\/[a-z|0-9|\/|-]+)?$/;
            var params = JSON.parse(host.replace(re, "{\"host\":\"$1\",\"port\":\"$2\",\"channel\":\"$3\"}"));
        }
        catch(ex)
        {
            console.error('Failed to connect, bad "host" parameter:', host, ex.stack());

            return client;
        } // end try/catch

        // A callback function in case we need to connect to the websocket.
        function connectChannel() {
            // Check to see if a channel was specified
            if(params.channel)
            {
                // Send a special message to the server to let it know we've connected on a channel.
                client.ws.send(JSON.stringify({
                    name: 'channel',
                    channel: '$control',
                    replyWith: client._getSeqId(),
                    data: [params.channel]
                }));

                client.channel = params.channel;
            } // end if
        } // end connectChannel

        // Check to see if we've already connected
        if (!client.ws)
        {
            client.on('connected', function()
            {
                connectChannel();
            });

            // Build the websocket connect string
            var connectString = "ws://";
            connectString += !!params.host ? params.host : 'localhost';
            connectString += !!params.port ? ':' + params.port : '';

            // Create the new websocket
            client.ws = new WebSocket(connectString);

            // Connect our event handlers to the websocket.
            client._connectEventHandlers();
        }
        else
        {
            if(params.channel)
            {
                connectChannel();
            }
            else
            {
                client._emit('error', "Attempted to connect, but already connected.");
                return client;
            } // end if
        } // end if

        return client;
    };

    UniSocketClient.prototype.emit = function(event)
    {
        var args = Array.prototype.slice.call(arguments);

        var data = args.slice(1);
        //data = _.compact(data);

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
            this.waitingCallbacks[message.replyWith] = maybeCallback;
        } // end if

        this.ws.send(JSON.stringify(message));
    };

    //------------------------------------------------------------------------------------------------------------------

    window.unisocket = UniSocketClient;

    //------------------------------------------------------------------------------------------------------------------
})();

// ---------------------------------------------------------------------------------------------------------------------
