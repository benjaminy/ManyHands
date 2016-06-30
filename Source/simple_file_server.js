/*
 * This is an extremely simple HTTP file server
 */

var DEFAULT_PORT = 8080;
var DEFAULT_DIR  = '.';

var serveStatic  = require( 'serve-static' );
var http         = require( 'http' );
var https        = require( 'https' );
var finalhandler = require( 'finalhandler' );
var url          = require( 'url' );
var fs           = require( 'fs' );
var path         = require( 'path' );
var mkdirp       = require( 'mkdirp' );
var opt          = require( 'node-getopt' ).create( [
    [ 'P', 'port=PORT',      'Port to server on; default is '+DEFAULT_PORT ],
    [ 'D', 'dir=DIR',        'Root directory to serve from; default is '+DEFAULT_DIR ],
    [ 'C', 'cert=CERT_FILE', 'Certificate file; will serve over HTTP if not given' ],
    [ 'K', 'key=KEY_FILE',   'key file; will serve over HTTP if not given' ] ] )
  .bindHelp().parseSystem();

var root_dir = DEFAULT_DIR;

var CORS_HEADERS = [ ['Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS,DELETE'],
                     [ 'Access-Control-Allow-Origin', '*' ],
                     [ 'Access-Control-Allow-Headers',
                       'Origin, X-Requested-With, Content-Type, Accept' ] ];

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
    if(req.headers["access-control-request-method"] == 'DELETE') {
        log( 'Accepted preflight DELETE request' );
        resp.writeHead( 200 );
        resp.end();
    }
    else if( req.headers[ 'access-control-request-method' ] == 'POST' ) {
        log( 'Accepted preflight POST request' );
        resp.writeHead( 200 );
        resp.end();
    }
    else
    {
        log( 'Mystery request', req );
        throw new Error( 'Blah' );
    }
}

function handleDynamic( req, resp )
{
    if(      req.method == 'POST' )   return handlePost( req, resp );
    else if( req.method == 'DELETE' ) return handleDelete( req, resp );
    else if ( req.method == 'OPTIONS' ) return handleOptions( req, resp );
    log( '[Simple File Server] Not POST or DELETE or OPTIONS', req.url, req.method );

    return finalhandler( req, resp )();
}

function runServer()
{
    console.log( opt.options );
    if( 'dir' in opt.options )
        root_dir = opt.options.dir;
    var port = DEFAULT_PORT;
    if( 'port' in opt.options )
    {
        var x = parseInt( opt.options.port );
        if( !isNaN( x ) )
            port = x;
    }

    var serveFiles = serveStatic( root_dir, { 'index': [ 'index.html', 'index.htm' ] } );

    function handleReq( req, resp ) {
        for( i = 0; i < CORS_HEADERS.length; i++ )
        {
            resp.setHeader( CORS_HEADERS[i][0], CORS_HEADERS[i][1] );
        }
        serveFiles( req, resp, function() { handleDynamic( req, resp ) } );
    }

    var server, protocol = 'HTTP';
    if( 'cert' in opt.options && 'key' in opt.options )
    {
        var options = {
            key:  fs.readFileSync( opt.options.key ),
            cert: fs.readFileSync( opt.options.cert )
        };
        server = https.createServer( options, handleReq );
        protocol = 'HTTPS'
    }
    else
    {
        server = http.createServer( handleReq );
    }
    server.listen( port );
    log( 'Simple File Server: Serving directory', root_dir, 'on port', port, 'with protocol', protocol );
}

runServer();
