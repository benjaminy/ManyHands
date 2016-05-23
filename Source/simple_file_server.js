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

var CORS_HEADERS = [ [ 'Access-Control-Allow-Origin', '*' ],
                     [ 'Access-Control-Allow-Headers',
                       'Origin, X-Requested-With, Content-Type, Accept' ] ];

var log = console.log.bind( console );

function writeFile( pathname, contents, resp )
{
    var dirs = pathname.split( '/' );
    // assert( dirs.length >= 2 )
    // assert( dirs[0] == '' )
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
        fs.writeFile( path.join( fdir, filename ), contents, 'utf8', function( err )
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

function serveDynamic( req, res )
{
    log( 'Simple File Server: Dynamic ', req.url, req.method );
    if( req.method == 'POST' )
    {
        var body = [];
        req.addListener( 'data', function( chunk ) { body.push( chunk ); } );
        req.addListener( 'end', function()
        {
            writeFile( url.parse( req.url ).pathname, Buffer.concat( body ), res );
        } );
        return;
    }
    return finalhandler( req, res )();
}

function runServer()
{
    var p = parseArgs();

    var serveFiles = serveStatic( root_dir, { 'index': [ 'index.html', 'index.htm' ] } );
    // var serveFiles = serveStatic( root_dir, { 'index': false } );

    var server = http.createServer(
        function( req, res ) {
            for( i = 0; i < CORS_HEADERS.length; i++ )
            {
                res.setHeader( CORS_HEADERS[i][0], CORS_HEADERS[i][1] );
            }
            serveFiles( req, res, function() { serveDynamic( req, res ) } );
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
