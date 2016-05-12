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
var DEFAULT_DIR  = ".";
var dir;

var CORS_HEADERS = [ [ 'Access-Control-Allow-Origin', '*' ],
                     [ 'Access-Control-Allow-Headers',
                       'Origin, X-Requested-With, Content-Type, Accept' ] ];

var log = console.log.bind( console );

function serveDynamic( req, res )
{
    log( "Dynamic", req.url, req.method );
    if( req.method == 'POST' )
    {
        var data = '';

        req.setEncoding( 'utf8' );

        req.addListener( 'data', function( dataChunk )
        {
            data += dataChunk;
        } );

        req.addListener( 'end', function()
        {
            var pathname = url.parse( req.url ).pathname;
            log( "PATH ", pathname );
            dirs = pathname.split( '/' );
            // assert( dirs.length >= 2 )
            // assert( dirs[0] == '' )
            var filename = dirs[ dirs.length - 1 ];
            dirs = dirs.slice( 1, dirs.length - 1 );
            var fdir = path.join( dir, dirs.join( path.sep ) );
            log( "YAY? ", fdir );
            mkdirp( fdir, function( err )
            {
                if( err )
                {
                    log( "mkdir error", err );
                    res.writeHead( 404 );
                    res.end( 'mkdir error' );
                    return
                }
                fs.writeFile( path.join( fdir, filename ), data, 'utf8', function( err )
                {
                    if( err )
                    {
                        log( "write error", err );
                        res.writeHead( 404 );
                        res.end( 'Mystery error' );
                        return;
                    }
                    res.writeHead( 200 );
                    res.end( 'YAY' );
                } );
            } );
        } );
        return;
    }
    return finalhandler( req, res )();
}

function runServer()
{
    var p = parseArgs();

    var serveFiles = serveStatic( dir, { 'index': [ 'index.html', 'index.htm' ] } );

    var server = http.createServer(
        function( req, res ) {
            for( i = 0; i < CORS_HEADERS.length; i++ )
            {
                res.setHeader( CORS_HEADERS[i][0], CORS_HEADERS[i][1] );
            }
            serveFiles( req, res, function() { serveDynamic( req, res ) } );
        } );
    server.listen( p );
    log( "Simple File Server - Serving directory",dir,"on port",p );
}

function parseArgs()
{
    dir = null;
    var p = null;
    for( i = 2; i < process.argv.length; i++ )
    {
        var x = parseInt( process.argv[i] );
        if( isNaN( x ) )
        {
            if( !dir )
                dir = process.argv[i];
        }
        else
        {
            if( !p )
                p = x;
        }
    }
    if( !dir )
        dir = DEFAULT_DIR;
    if( !p )
        p = DEFAULT_PORT;
    return p;
}

runServer();
