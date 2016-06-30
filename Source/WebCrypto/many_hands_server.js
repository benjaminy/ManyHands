/*
 * This is an extremely simple HTTP file server
 */

var DEFAULT_PORT = 8080;
var DEFAULT_DIR  = ".";
var DEFAULT_DB   = "test.sqlite";

var serveStatic  = require( 'serve-static' );
var http         = require( 'http' );
var https        = require( 'https' );
var finalhandler = require( 'finalhandler' );
var url          = require( 'url' );
var fs           = require( 'fs' );
var path         = require( 'path' );
var sql          = require( 'sqlite3' ).verbose();
var multiparty   = require( 'multiparty' );
var opt          = require( 'node-getopt' ).create( [
    [ 'P', 'port=PORT',      'Port to server on; default is '+DEFAULT_PORT ],
    [ 'F', 'front=DIR',      'Root directory to serve the front-end from; default is '+DEFAULT_DIR ],
    [ 'D', 'db=DB',          'Database to use; default is '+DEFAULT_DB ],
    [ 'C', 'cert=CERT_FILE', 'Certificate file; will serve over HTTP if not given' ],
    [ 'K', 'key=KEY_FILE',   'key file; will serve over HTTP if not given' ] ] )
  .bindHelp().parseSystem();

var dir = DEFAULT_DIR;

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
            res.end();
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

function onRegisterReq( req, resp )
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

        var db_path = DEFAULT_DB;
        if( 'db' in opt.options )
            db_path = opt.options.db;
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
                        resp.writeHead( 500 );
                        resp.end( 'DB error' );
                    }
                    else
                    {
                        log( 'DB write succeeded!' );
                        resp.writeHead( 200 );
                        resp.end( 'internal error too many rows' );
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
        //         resp.writeHead( 404 );
        //         resp.end( 'mkdir error' );
        //     }
        //     fs.writeFile( path.join( fdir, filename ), data, 'utf8', function( err )
        //     {
        //         if( err )
        //         {
        //             log( "write error", err );
        //             resp.writeHead( 404 );
        //             resp.end( 'Mystery error' );
        //         }
        //         else
        //         {
        //             resp.writeHead( 200 );
        //             resp.end( 'YAY' );
        //         }
        //     } );
        // } );
    } );
    return;
}

function serveDynamic( req, res )
{
    log( "Dynamic? ", req.url, req.method, req.url.split( '/' ) );
    var url_split = req.url.split( '/' );
    // log( "Dynamic? ", req );
    if( req.method == 'GET' && url_split[ 0 ] === '' && url_split[ 1 ] === "Users" )
    {
        return onLoginReq( req, res );
    }
    else if( req.method == 'POST' && req.url.substring( 0, 10 ) == "/Register/" )
    {
        return onRegisterReq( req, res );
    }
    else
    {
        return finalhandler( req, res )();
    }
}

function runServer()
{
    console.log( opt.options );
    if( 'front' in opt.options )
        root_dir = opt.options.front;
    var port = DEFAULT_PORT;
    if( 'port' in opt.options )
    {
        var x = parseInt( opt.options.port );
        if( !isNaN( x ) )
            port = x;
    }

    var serveFiles = serveStatic( root_dir, { 'index': [ 'index.html', 'index.htm' ] } );

    function handleReq( req, resp ) {
        /* console.log( 'Request arrived.', req.url ); */
        serveFiles( req, resp, function() { serveDynamic( req, resp ) } );
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
    var server = https.createServer( options, handleReq );
    log( "Many Hands Server - Serving directory",dir,"on port",port,"with protocol",protocol );
}

runServer();
