/*
 * This is an extremely simple HTTP file server
 */

var serveStatic  = require( 'serve-static' );
var http         = require( 'http' );
var finalhandler = require( 'finalhandler' );
var url          = require( 'url' );
var fs           = require( 'fs' );
var path         = require( 'path' );
var sql          = require( 'sqlite3' ).verbose();
var multiparty   = require( 'multiparty' );

var DEFAULT_PORT = 8080;
var DEFAULT_DIR  = ".";
var dir;

var log = console.log.bind( console );

function onLoginReq( req, res )
{
    var db_path = path.join( dir, 'Testing', 'Users', 'login_links.sqlite' );
    var db = new sql.Database( db_path );
    log( 'db?', db_path, db );
    db.all( 'SELECT salt, encrypted_link FROM Links where hashed_uid = ?',
            [ req.url.substring( 7 ) ],
    function( err, rows ) {
        if( err )
        {
            log( 'DB error', err );
            res.writeHead( 500 );
            res.end( 'DB error' );
        }
        else if( rows.length < 1 )
        {
            res.writeHead( 404 );
            res.end( 'uid not in DB' );
        }
        else if( rows.length > 1 )
        {
            res.writeHead( 500 );
            res.end( 'internal error too many rows' );
        }
        else
        {
            res.writeHead( 200 );
            res.end( JSON.stringify( rows[0] ) );
        }
    } );
}

function serveDynamic( req, res )
{
    log( "Dynamic? ", req.url, req.method );
    // log( "Dynamic? ", req );
    if( req.method == 'GET' && req.url.substring( 0, 7 ) == "/Users/" )
    {
        onLoginReq( req, res );
    }
    else if( req.method == 'POST' && req.url.substring( 0, 10 ) == "/Register/" )
    {
        log( "Trying to register" );
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
            var j = JSON.parse( data );
            log( j );

            var db_path = path.join( dir, 'Testing', 'Users', 'login_links.sqlite' );
            var db = new sql.Database( db_path );
            log( 'db?', db_path, db );

                [ req.url.substring( 7 ) ],
            db.run( 'INSERT INTO Links '+
                    '(hashed_uid, encrypted_link, pub_key, registration_info, salt) '+
                    'VALUES (?,?,?,?,?)',
                    [ req.url.substring( 10 ), j.link, JSON.stringify( j.pub_key ), '', j.salt ],
                    function( err ) {
                        if( err )
                        {
                            log( 'DB write err',err );
                            res.writeHead( 500 );
                            res.end( 'DB error' );
                        }
                        else
                        {
                            log( 'DB write succeeded!' );
                            res.writeHead( 200 );
                            res.end( 'internal error too many rows' );
                        }
                    } );


            // dirs = pathname.split( '/' );
            // // assert( dirs.length >= 2 )
            // // assert( dirs[0] == '' )
            // var filename = dirs[ dirs.length - 1 ];
            // dirs = dirs.slice( 1, dirs.length - 1 );
            // var fdir = path.join( dir, dirs.join( path.sep ) );
            // log( "YAY? ", fdir );
            // mkdirp( fdir, function( err )
            // {
            //     if( err )
            //     {
            //         log( "mkdir error", err );
            //         res.writeHead( 404 );
            //         res.end( 'mkdir error' );
            //     }
            //     fs.writeFile( path.join( fdir, filename ), data, 'utf8', function( err )
            //     {
            //         if( err )
            //         {
            //             log( "write error", err );
            //             res.writeHead( 404 );
            //             res.end( 'Mystery error' );
            //         }
            //         else
            //         {
            //             res.writeHead( 200 );
            //             res.end( 'YAY' );
            //         }
            //     } );
            // } );
        } );
        return;


    }
    else
    {
        return finalhandler( req, res )();
    }
}

function runServer()
{
    var p = parseArgs();

    var serveFiles = serveStatic( path.join( dir, 'Source', 'WebCrypto' ),
                                  { 'index': [ 'index.html', 'index.htm' ] } );

    var server = http.createServer(
        function( req, res ) {
            serveFiles( req, res, function() { serveDynamic( req, res ) } );
        } );
    server.listen( p );
    log( "Many Hands Server - Serving directory",dir,"on port",p );
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
