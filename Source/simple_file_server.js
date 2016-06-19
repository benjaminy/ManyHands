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

var DEFAULT_PORT = 8080;
var DEFAULT_DIR  = '.';
var root_dir     = null;

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
    var p = parseArgs();

    var serveFiles = serveStatic( root_dir, { 'index': [ 'index.html', 'index.htm' ] } );
    // var serveFiles = serveStatic( root_dir, { 'index': false } );

    var server = http.createServer(
        function( req, resp ) {
            for( i = 0; i < CORS_HEADERS.length; i++ )
            {
                resp.setHeader( CORS_HEADERS[i][0], CORS_HEADERS[i][1] );
            }
            serveFiles( req, resp, function() { handleDynamic( req, resp ) } );
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
