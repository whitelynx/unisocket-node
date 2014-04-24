// ---------------------------------------------------------------------------------------------------------------------
// UniSocket Client-side library.
//
// @module unisocket.js
// ---------------------------------------------------------------------------------------------------------------------

(function()
{
    //------------------------------------------------------------------------------------------------------------------
    // A mini event emitter implementation from: https://github.com/jeromeetienne/microevent.js
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

    function UniSocketClient()
    {
        this.ws = undefined;

        this.seqId = 0;
        this.waitingCallbacks = {};
    } // end UniSocketClient

    // Inherit from MicroEvent
    UniSocketClient.prototype.on = MicroEvent.prototype.on;
    UniSocketClient.prototype.removeListener = MicroEvent.prototype.removeListener;
    UniSocketClient.prototype._emit = MicroEvent.prototype.emit;

    UniSocketClient.prototype._getSeqId = function()
    {
        this.seqId++;
        return this.seqId.toString();
    };

    UniSocketClient.prototype.connect = function(host)
    {
        var self = this;

        host = host || "localhost";
        this.ws = new WebSocket("ws://" + host);
        this.ws.onopen = function()
        {
            var seqID = self._getSeqId();
            self.ws.send(JSON.stringify({
                name: 'connect',
                channel: '$control',
                replyWith: seqID
            }));

            self.waitingCallbacks[seqID] = function(options)
            {
                self.options = options;
                self._emit('connected');
            };
        };

        this.ws.onerror = function(){ self._emit.apply(this, ['error'].concat(Array.prototype.slice.call(arguments, 0))); };
        this.ws.onclose = function(){ self._emit.apply(this, ['close'].concat(Array.prototype.slice.call(arguments, 0))); };

        this.ws.onmessage = function(messageEvent)
        {
            var message = JSON.parse(messageEvent.data);

            // Make sure message.data is a list
            message.data = message.data || [];

            // Handle the multiple names for the root channel
            if((message.channel == '/') || (message.channel == ''))
            {
                message.channel = undefined;
            } // end if

            // Only process self message if it's for our channel
            if(message.channel == self.channel || message.channel == '$control')
            {
                // Reply Support
                if (message.replyTo)
                {
                    var callback = self.waitingCallbacks[message.replyTo];
                    if (callback)
                    {
                        callback.apply(self, message.data);
                    }
                    else
                    {
                        console.error("'replyTo' without matching callback.");
                    } // end if
                }
                else
                {
                    self._emit.apply(self, [message.name].concat(message.data));
                } // end if
            } // end if
        }; // end ws.onmessage

        return this;
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

    window.unisocket = new UniSocketClient();

})();

// ---------------------------------------------------------------------------------------------------------------------