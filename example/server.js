//----------------------------------------------------------------------------------------------------------------------
// A simple example server.
//
// @module server.js
//----------------------------------------------------------------------------------------------------------------------

var fs = require('fs');
var path = require('path');
var UniSocketServer = require('../unisocket');

//----------------------------------------------------------------------------------------------------------------------

var socketServer = new UniSocketServer().listen(4000);
var logger = socketServer.logger;

// Handle serving of index file
socketServer.httpServer.on('request', function(request, response)
{
    if(request.url == '/' || request.url == '/index.html')
    {
        fs.createReadStream(path.resolve('./client/index.html')).pipe(response);
    } // end if
});

socketServer.channel('/echo', function(client)
{
    client.on('echo', function(msg, callback)
    {
        callback(msg);
    });
});

logger.info("Example server started. Listening on port %s", socketServer.httpServer.address().port);

//----------------------------------------------------------------------------------------------------------------------