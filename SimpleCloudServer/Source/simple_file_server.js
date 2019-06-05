/*
 * This is an extremely simple HTTP file server
 */

/* Imports */

const U            = require( "util" );
const serveStatic  = require( "serve-static" );
const http         = require( "http" );
const https        = require( "https" );
const finalhandler = require( "finalhandler" );
const url          = require( "url" );
const fs           = require( "fs" );
const path         = require( "path" );
const mkdirp       = require( "async-mkdirp" );
const nodeCleanup  = require( "node-cleanup" );

const DEFAULT_PORT = 8080;
const DEFAULT_DIR  = ".";

const opt          = require( "node-getopt" ).create( [
    [ "P", "port=PORT",      "Port to serve on; default is "+DEFAULT_PORT ],
    [ "D", "dir=DIR",        "Root directory to serve from; default is "+DEFAULT_DIR ],
    [ "C", "cert=CERT_FILE", "Certificate file; will serve over HTTP if not given" ],
    [ "K", "key=KEY_FILE",   "key file; will serve over HTTP if not given" ] ] )
  .bindHelp().parseSystem();

const fs_exists    = U.promisify( fs.exists );
const fs_readFile  = U.promisify( fs.readFile );
const fs_writeFile = U.promisify( fs.writeFile );
const fs_unlink    = U.promisify( fs.unlink );

/* Constants and Globals */

const LONGPOLL_DATA_FILE = "pastRequestedFiles.json";
const LONGPOLL_TIMEOUT = 4000;
const LONGPOLL_MEMORY_TIMEOUT = 8000;

var root_dir = DEFAULT_DIR;
var cloud_dir = DEFAULT_DIR;

var file_versions = {};

const CORS_HEADERS = [ [ "Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS,DELETE" ],
                     [ "Access-Control-Allow-Origin", "*" ],
                     [ "Access-Control-Allow-Headers",
                       "Origin, X-Requested-With, Content-Type, Accept, Longpoll, Stamp" ] ];

/* Utilities */

function log( ...ps )
{
    console.log( "[SimpleFileServer]", ...ps );
}

function assert( property, msg, resp )
{
    if( property )
        return;
    log( "Internal error", msg );
    resp.writeHead( 500 );
    resp.end();
}

function pathSanity( path, resp )
{
    assert( path.length >= 2, "Path too short", resp );
    assert( path[0] === "", "Text before first slash", resp )
}

function incrFileVersion( path )
{
    var version = 0;
    try {
        version = file_versions[ path ];
    }
    catch( err ) {}
    file_versions[ path ] = version + 1;
}

/* Server */

/* nodeCleanup registers this function to be called just before the process exits */
nodeCleanup( ( exitCode, signal ) =>
    {
        fs.writeFileSync( path.join( root_dir, "file_versions.json" ),
                          JSON.stringify( file_versions ) );
    } );

function checkMatch( pathname, req )
{
    try {
        var req_tag_str = req.getHeader( "If-Match" );
    }
    catch( err ) {
        log( "Request doesn't contain If-Match header???", err );
        return;
    }
    try {
        var req_tag = parseInt( req_tag_str );
    }
    catch( err ) {
        log( "Failed to parse If-Match tag???", err );
        return;
    }
    var matched = true;
    try {
        var file_tag = file_versions[ pathname ];
        matched = file_tag === req_tag;
    }
    catch( err ) {
        log( "No version for", pathname, err );
        file_versions[ pathname ] = req_tag + 1;
        matched = false;
    }
    if( !matched )
        throw new Error( 412 );
}

async function putFile( pathname, contents ) {
    const dirs = pathname.split( "/" );
    const filename = dirs[ dirs.length - 1 ];
    const fdir = path.join( cloud_dir, dirs.slice( 1, dirs.length - 1 ).join( path.sep ) );
    try {
        await mkdirp( fdir );
    }
    catch( err ) {
        log( "mkdir error", err );
        throw new Error( 500 );
    }
    try {
        incrFileVersion( pathname );
        await fs_writeFile( path.join( fdir, filename ), contents );
    }
    catch( err ) {
        log( "write error", err );
        throw new Error(500);
    }
    log( "Wrote file", pathname );
}

async function writeFile( pathname, contents, resp )
{
    const dirs = pathname.split( "/" );
    pathSanity( dirs, resp );
    const filename = dirs[ dirs.length - 1 ];
    const fdir = path.join( cloud_dir, dirs.slice( 1, dirs.length - 1 ).join( path.sep ) );
    try {
        await mkdirp( fdir );
    }
    catch( err ) {
        log( "mkdir error", err );
        resp.writeHead( 500 );
        resp.end();
        return;
    }
    try {
        incrFileVersion( pathname );
        await fs_writeFile( path.join( fdir, filename ), contents );
    }
    catch( err ) {
        log( "write error", err );
        resp.writeHead( 500 );
        resp.end();
        return;
    }
    log( "Wrote file", pathname );
    LongPollReq.updateReqsWithFileChange( path.join( fdir, filename ) );
    resp.writeHead( 200 );
    resp.end();
}

function LongPollReq( resp, path, stamp )
{
    this.finishLongpoll = function() {
        if (!this.finished) {
            const index = LongPollReq.pastRequestedFiles.findIndex(function(e){ return e.path == path; });
            if (index != -1) {
                const newStamp = LongPollReq.pastRequestedFiles[index].changedCount;
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

    const index = LongPollReq.pastRequestedFiles.findIndex(function(e){ return e.path == path; });
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
    const index = LongPollReq.pastRequestedFiles.findIndex(function(e){ return e.path == path; });
    if (index == -1)
        LongPollReq.pastRequestedFiles.push( { path: path, changedCount: 1 } );
    else {
        LongPollReq.pastRequestedFiles[index].changedCount++;
    }
    putFile(LONGPOLL_DATA_FILE, JSON.stringify(LongPollReq.pastRequestedFiles));

    for ( const i = LongPollReq.currentReqs.length - 1; i >= 0; --i )
    {
        const req = LongPollReq.currentReqs[ i ];
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

function handlePost( req, resp )
{
    log( "Post", req.url );
    checkMatch( pathname );
    const pathname = url.parse( req.url ).pathname;
    const body = [];
    req.addListener( "data", function( chunk ) { body.push( chunk ); } );
    req.addListener( "end", function()
    {
        writeFile( pathname, Buffer.concat( body ), resp );
    } );
}

async function handleDelete( req, resp )
{
    log( "Delete", req.url );
    const parsedUrl = url.parse( req.url );
    const file_path = parsedUrl.pathname;
    const dirs = file_path.split( "/" );
    pathSanity( dirs, resp );
    const filename = dirs[ dirs.length - 1 ];
    const fdir = path.join( cloud_dir, dirs.slice( 1, dirs.length - 1 ).join( path.sep ) );
    try {
        await fs_unlink( path.join( fdir, filename ) );
        if( !( await fs_exists( path.join( fdir, filename ) ) ) )
        {
            delete file_versions[ file_path ];
        }
    }
    catch( err ) {
        log( "Error during delete", err );
        resp.writeHead( 404 );
        resp.end();
        return;
    }
    log( "Deleted", path.join( fdir, filename ) );
    resp.writeHead( 200 );
    resp.end();
}

function handleOptions( req, resp ) {
    if( req.headers[ "access-control-request-method" ] == "DELETE" )
    {
        log( "Accepted a preflight DELETE request" );
        resp.writeHead( 200 );
        resp.end();
    }
    else
    {
        if( req.headers[ "access-control-request-method" ] == "GET" && req.headers[ "access-control-request-headers" ]
                .toLowerCase().split( ", ").indexOf( "longpoll" ) != -1 )
        {
            log( "Accepted a preflight Longpoll request" );
            resp.writeHead( 200 );
            resp.end();
        }
        else
        {
            return finalhandler( req, resp )();
        }
    }
}

function handleLongpoll( req, resp ) {
    log( "Long-Poll received", req.url );
    const parsedUrl = url.parse( req.url );
    const file_path = parsedUrl.pathname;
    const dirs = file_path.split( "/" );
    pathSanity( dirs, resp );
    const filename = dirs[ dirs.length - 1 ];
    const fdir = path.join( cloud_dir, dirs.slice( 1, dirs.length - 1 ).join( path.sep ) );
    const end_path = path.join( fdir, filename );

    const longPollReq = new LongPollReq( resp, end_path, req.headers["stamp"] );
    setTimeout( function() { longPollTimeout(longPollReq); }, LONGPOLL_TIMEOUT );
}

function handleDynamic( req, resp, next )
{
    // throw new Error( req.url );
    log(req.headers);
    if(      req.method == "POST" )    return handlePost( req, resp );
    else if( req.method == "DELETE" )  return handleDelete( req, resp );
    else if( req.method == "OPTIONS" ) return handleOptions( req, resp );
    else if( req.method == "GET" && req.headers["longpoll"] == "1")
        return handleLongpoll( req, resp );
    log( "Not POST or DELETE or OPTIONS or long poll", req.url, req.method );

    if ( !next ) return finalhandler( req, resp )();
    else {
        next();
    }
}

async function main()
{
    log( opt.options );
    if( "dir" in opt.options )
        root_dir = opt.options.dir;
    cloud_dir = path.join( root_dir, "Cloud" )
    var port = DEFAULT_PORT;
    if( "port" in opt.options )
    {
        const x = parseInt( opt.options.port );
        if( !isNaN( x ) )
            port = x;
    }

    if( await fs_exists( LONGPOLL_DATA_FILE ) )
    {
        const json = await fs_readFile( LONGPOLL_DATA_FILE );
        LongPollReq.pastRequestedFiles = JSON.parse(json);
    }

    var protocol = "HTTP";
    var options = {};

    if( "cert" in opt.options && "key" in opt.options )
    {
        options = {
            key:  await fs_readFile( opt.options.key ),
            cert: await fs_readFileSync( opt.options.cert )
        };
        protocol = "HTTPS"
    }

    try {
        const text = await fs_readFile( path.join( root_dir, "file_versions.json" ) )
        file_versions = JSON.parse( text );
    }
    catch( err ) {
        log( "Failed to read file_versions.json ", err );
    }

    function setHeadersHook( response, path, stat )
    {
        try {
            var version = file_versions[ path ];
        }
        catch( err ) {
            var version = 1;
            file_versions[ path ] = version;
        }
        response.setHeader( "etag", version );
    }

    const serveFiles = serveStatic( cloud_dir, { "setHeaders" : setHeadersHook } );
    const server = https.createServer( options,
        ( req, resp ) => {
            log( "Request received", req.url );
            // throw new Error( "Request received", req.url );
            for( i = 0; i < CORS_HEADERS.length; i++ )
            {
                resp.setHeader( CORS_HEADERS[i][0], CORS_HEADERS[i][1] );
            }
            serveFiles( req, resp, () => { handleDynamic( req, resp ) } );
        } );
    server.listen( port );
    log( "Serving directory", cloud_dir, "on port", port, "with protocol", protocol );
}

main().then( function() { console.log( "Simple File Server finished" ) } );
