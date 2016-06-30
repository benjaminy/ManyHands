/*
 * This is an extremely simple HTTP file server
 */

var serveStatic  = require( 'serve-static' );
var http         = require( 'http' );
var finalhandler = require( 'finalhandler' );
var url          = require( 'url' );
var fs           = require( 'fs' );
var path         = require( 'path' );
var mkdirp       = require( 'mkdirp' );

var LONGPOLL_DATA_FILE = "pastRequestedFiles.json";
var LONGPOLL_TIMEOUT = 4000;
var LONGPOLL_MEMORY_TIMEOUT = 8000;

var DEFAULT_PORT = 8080;
var DEFAULT_DIR  = '.';
var root_dir     = null;

var CORS_HEADERS = [ ['Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS,DELETE'],
                     [ 'Access-Control-Allow-Origin', '*' ],
                     [ 'Access-Control-Allow-Headers',
                       'Origin, X-Requested-With, Content-Type, Accept, Longpoll, Stamp' ] ];

var log = console.log.bind( console );

function assert( property, msg, resp )
{
    if( property )
        return;
    log( '[Simple File Server] Internal error', msg );
    resp.writeHead( 500 );
    resp.end();
}

function pathSanity( path, resp )
{
    assert( path.length >= 2, 'Path too short', resp );
    assert( path[0] == '', 'Text before first slash', resp )
}

function putFile(pathname, contents) {
    var dirs = pathname.split( '/' );
    var filename = dirs[ dirs.length - 1 ];
    var fdir = path.join( root_dir, dirs.slice( 1, dirs.length - 1 ).join( path.sep ) );
    mkdirp( fdir, function( err )
    {
        if( err )
        {
            log( 'Simple File Server: mkdir error', err );
            throw new Error(500);
        }
        fs.writeFile( path.join( fdir, filename ), contents, function( err )
        {
            if( err )
            {
                log( 'Simple File Server: write error', err );
                throw new Error(500);
            }
            log( 'Simple File Server: Wrote file', pathname );
        } );
    } );
}

function writeFile( pathname, contents, resp )
{
    var dirs = pathname.split( '/' );
    pathSanity( dirs, resp );
    var filename = dirs[ dirs.length - 1 ];
    var fdir = path.join( root_dir, dirs.slice( 1, dirs.length - 1 ).join( path.sep ) );
    mkdirp( fdir, function( err )
    {
        if( err )
        {
            log( 'Simple File Server: mkdir error', err );
            resp.writeHead( 500 );
            resp.end();
            return;
        }
        fs.writeFile( path.join( fdir, filename ), contents, function( err )
        {
            if( err )
            {
                log( 'Simple File Server: write error', err );
                resp.writeHead( 500 );
                resp.end();
                return;
            }
            log( 'Simple File Server: Wrote file', pathname );
            LongPollReq.updateReqsWithFileChange( path.join( fdir, filename ) );
            resp.writeHead( 200 );
            resp.end();
        } );
    } );
}

function handlePost( req, resp )
{
    log( '[Simple File Server] Post', req.url );
    var body = [];
    req.addListener( 'data', function( chunk ) { body.push( chunk ); } );
    req.addListener( 'end', function()
    {
        writeFile( url.parse( req.url ).pathname, Buffer.concat( body ), resp );
    } );
}

function handleDelete( req, resp )
{
    log( '[Simple File Server] Delete', req.url );
    var parsedUrl = url.parse( req.url );
    var file_path = parsedUrl.pathname;
    var dirs = file_path.split( '/' );
    pathSanity( dirs, resp );
    var filename = dirs[ dirs.length - 1 ];
    var fdir = path.join( root_dir, dirs.slice( 1, dirs.length - 1 ).join( path.sep ) );
    fs.unlink( path.join( fdir, filename ), function( err ) {
        if( err )
        {
            log( '[Simple File Server] Error during delete', err );
            resp.writeHead( 404 );
            resp.end();
        }
        else
        {
            log( '[Simple File Server] Deleted', path.join( fdir, filename ) );
            resp.writeHead( 200 );
            resp.end();
        }
    } );
}

function handleOptions( req, resp ) {
    if( req.headers[ "access-control-request-method" ] == 'DELETE' )
    {
        log( 'Accepted a preflight DELETE request' );
        resp.writeHead( 200 );
        resp.end();
    }
    else
    {
        if( req.headers[ "access-control-request-method" ] == 'GET' && req.headers[ "access-control-request-headers" ]
                .toLowerCase().split( ", ").indexOf( "longpoll" ) != -1 )
        {
            log( 'Accepted a preflight Longpoll request' );
            resp.writeHead( 200 );
            resp.end();
        }
        else
        {
            return finalhandler( req, resp )();
        }
    }
}

function LongPollReq( resp, path, stamp )
{
    this.finishLongpoll = function() {
        if (!this.finished) {
            var index = LongPollReq.pastRequestedFiles.findIndex(function(e){ return e.path == path; });
            if (index != -1) {
                var newStamp = LongPollReq.pastRequestedFiles[index].changedCount;
            }
            this.finished = true;
            this.resp.writeHead(200);
            this.resp.end(JSON.stringify({status: "change", stamp: newStamp}));
        }
    };

    this.finished = false;
    this.resp = resp;
    this.path = path;
    this.stamp = stamp;

    var index = LongPollReq.pastRequestedFiles.findIndex(function(e){ return e.path == path; });
    if (index != -1) {
        if (this.stamp < LongPollReq.pastRequestedFiles[index].changedCount) {
            this.finishLongpoll(LongPollReq.pastRequestedFiles[index].changedCount);
        }
    }
    LongPollReq.currentReqs.push( this );
}
LongPollReq.pastRequestedFiles = [];
LongPollReq.currentReqs = [];
LongPollReq.updateReqsWithFileChange = function( path )
{
    var index = LongPollReq.pastRequestedFiles.findIndex(function(e){ return e.path == path; });
    if (index == -1)
        LongPollReq.pastRequestedFiles.push( { path: path, changedCount: 1 } );
    else {
        LongPollReq.pastRequestedFiles[index].changedCount++;
    }
    putFile(LONGPOLL_DATA_FILE, JSON.stringify(LongPollReq.pastRequestedFiles));

    for ( var i = LongPollReq.currentReqs.length - 1; i >= 0; --i )
    {
        var req = LongPollReq.currentReqs[ i ];
        if ( req.path == path )
        {
            req.finishLongpoll();
            LongPollReq.currentReqs.splice(i, 1);
        }
    }
};

function longPollTimeout( longPollReq )
{
    if ( !longPollReq.finished )
    {
        longPollReq.finished = true;
        longPollReq.resp.writeHead( 200 );
        longPollReq.resp.end( JSON.stringify({status: "timeout"}) );
    }
}

function handleLongpoll( req, resp ) {
    log( '[Simple File Server] Long-Poll received', req.url );
    var parsedUrl = url.parse( req.url );
    var file_path = parsedUrl.pathname;
    var dirs = file_path.split( '/' );
    pathSanity( dirs, resp );
    var filename = dirs[ dirs.length - 1 ];
    var fdir = path.join( root_dir, dirs.slice( 1, dirs.length - 1 ).join( path.sep ) );
    var end_path = path.join( fdir, filename );

    var longPollReq = new LongPollReq( resp, end_path, req.headers['stamp'] );
    setTimeout( function() { longPollTimeout(longPollReq); }, LONGPOLL_TIMEOUT );
}

function handleDynamic( req, resp, next )
{
    log(req.headers);
    if(      req.method == 'POST' )    return handlePost( req, resp );
    else if( req.method == 'DELETE' )  return handleDelete( req, resp );
    else if( req.method == 'OPTIONS' ) return handleOptions( req, resp );
    else if( req.method == 'GET' && req.headers['longpoll'] == '1') return handleLongpoll( req, resp );
    log( '[Simple File Server] Not POST or DELETE or OPTIONS or long poll', req.url, req.method );

    if ( !next ) return finalhandler( req, resp )();
    else {
        next();
    }
}

function runServer()
{
    var p = parseArgs();

    if (fs.existsSync(LONGPOLL_DATA_FILE)) {
        var json = fs.readFileSync(LONGPOLL_DATA_FILE);
        LongPollReq.pastRequestedFiles = JSON.parse(json);
    }

    var serveFiles = serveStatic( root_dir, { 'index': [ 'index.html', 'index.htm' ] } );
    // var serveFiles = serveStatic( root_dir, { 'index': false } );

    var server = http.createServer(
        function( req, resp )
        {
            for( i = 0; i < CORS_HEADERS.length; i++ )
            {
                resp.setHeader( CORS_HEADERS[i][0], CORS_HEADERS[i][1] );
            }
            handleDynamic( req, resp, function() { serveFiles( req, resp, function()
                { return finalhandler(req, resp)(); } ); } );
        } );
    server.listen( p );
    log( 'Simple File Server: Serving directory', root_dir, 'on port', p );
}

function parseArgs()
{
    var p = null;
    for( i = 2; i < process.argv.length; i++ )
    {
        var x = parseInt( process.argv[i] );
        if( isNaN( x ) )
        {
            if( !root_dir )
                root_dir = process.argv[i];
        }
        else
        {
            if( !p )
                p = x;
        }
    }
    if( !root_dir )
        root_dir = DEFAULT_DIR;
    if( !p )
        p = DEFAULT_PORT;
    return p;
}

runServer();
