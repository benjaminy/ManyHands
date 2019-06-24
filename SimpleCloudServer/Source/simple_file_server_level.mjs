/*
 * This server uses LevelDB to act like a simple file server
 */

import assert       from "assert";
import http         from "http";
import https        from "https";
import finalhandler from "finalhandler";
import url          from "url";
import P            from "path";
import LDB          from "level";
import GOPT         from "node-getopt";
import C            from "crypto";
import T            from "transit-js";

const DEFAULT_PORT = 8080;
const DEFAULT_DB_PATH = P.join( ".", "Testing", "Cloud", "Default" );

const opt = GOPT.create( [
    [ "P", "port=PORT",      "Port to serve on; default is "+DEFAULT_PORT ],
    [ "D", "db=DB_PATH",     " "+DEFAULT_DB_PATH ],
    [ "C", "cert=CERT_FILE", "Certificate file; will serve over HTTP if not given" ],
    [ "K", "key=KEY_FILE",   "key file; will serve over HTTP if not given" ] ] )
  .bindHelp().parseSystem();

const LONGPOLL_TIMEOUT = 4000;
const LONGPOLL_MEMORY_TIMEOUT = 8000;

const CORS_HEADERS =
      [ [ "Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS,DELETE" ],
        [ "Access-Control-Allow-Origin", "*" ],
        [ "Access-Control-Allow-Headers",
          "Origin, X-Requested-With, Content-Type, Accept, Longpoll, Stamp" ] ];

var the_world;
var transit_writer, transit_reader;

function sleepPromise( ms )
{
    return new Promise(
        ( resolve, reject ) =>
            {
                setTimeout( () => resolve(),
                            ms );
            } );
}

function lazyWr()
{
    if( ( !transit_writer ) )
    {
        const w = T.writer( "json" );
        transit_writer = w.write.bind( w );
    }
    return transit_writer;
}

function lazyRd()
{
    if( ( !transit_reader ) )
    {
        const r = T.reader( "json" );
        transit_reader = r.read.bind( r );
    }
    return transit_reader;
}

function log( ...ps )
{
    console.log( "[SimpleFileServer]", ...ps );
}

class BasicError extends Error
{
    constructor( status )
    {
        super();
        this.type = "BasicError";
        this.status = status;
    }
}

class TimeoutError extends Error
{
    constructor()
    {
        super();
        this.type = "TimeoutError";
    }
}

async function readTheWorld( key )
{
    try {
        const reader = lazyRd();
        const val = await the_world.get( key );
        return reader( val );
    }
    catch( err ) {
        if( !( err.type === "NotFoundError" ) )
        {
            throw err;
        }
        return undefined;
    }
}

const long_poll_requests = T.map();

async function respondToLongPoll( request, file, response )
{
    const path = request.url; // maybe parse ? # ...
    const options = request.headers[ "uws-longpoll" ];

    if( "if-match" in request.headers
        && !( request.headers[ "if-match" ] === file.get( "etag" ) ) )
    {
        log( "Longpoll etag mismatch", request.headers[ "if-match" ] );
        throw new BasicError( 412 );
    }
    var resolve, reject;
    const longPollPromise = new Promise( ( s, j ) => { resolve = s, reject = j } );
    setTimeout( () => reject( new TimeoutError() ), 6000 );

    const reqs = long_poll_requests.has( path )
          ? long_poll_requests.get( path ) : T.set();
    long_poll_requests.set( path, reqs );
    reqs.add( resolve );

    try {
        await longPollPromise;
    }
    catch( err ) {
        if( err.type === "TimeoutError" )
        {
            throw new BasicError( 408 );
        }
        throw err;
    }

    // .headers is supposed to be read-only, but this hack might work
    delete request.headers[ "uws-longpoll" ];
    return respondToGet( request, response );
}

function triggerLongPolls( path )
{
    if( !( long_poll_requests.has( path ) ) )
    {
        return;
    }
    const resolves = long_poll_requests.has( path );
    long_poll_requests.delete( path );
    for( const resolve of resolves )
    {
        resolve();
    }
}

async function respondToGet( request, response )
{
    log( "GET" );
    const file = await readTheWorld( request.url );
    if( file )
    {
        if( "uws-longpoll" in request.headers )
        {
            return respondToLongPoll( request, file, response );
        }
        const body = file.get( "body" );
        response.setHeader( "Content-Type", "application/octet-stream" );
        response.setHeader( "Content-Length", "" + body.byteLength );
        response.setHeader( "Last-Modified", file.get( "timestamp" ) );
        response.setHeader( "ETag", file.get( "etag" ) );
        response.write( Buffer.from( body ) );
    }
    else
    {
        throw new BasicError( 404 );
    }
}

async function preconditionCheck( path, headers )
{
    const file = await readTheWorld( path );
    if( file )
    {
        if( "if-none-match" in headers )
        {
            log( "preconditionCheck: If-None-Match", headers[ "if-none-match" ] );
            if( !( headers[ "if-none-match" ] === "*" ) )
            {
                throw new Error( "Unimplemented" );
            }
            /* Client wants an unused path; 'path' already taken */
            throw new BasicError( 412 );
        }
        if( "if-match" in headers
            && !( headers[ "if-match" ] === file.get( "etag" ) ) )
        {
            log( "preconditionCheck: Atomicity failure", headers[ "if-match" ] );
            throw new BasicError( 412 );
        }
    }
    else
    {
        if( "if-match" in headers )
        {
            log( "preconditionCheck: Mystery failure", headers[ "if-match" ] );
            throw new BasicError( 412 );
        }
    }
    return null;
}

async function respondToPut( request, response )
{
    log( "PUT" );
    await preconditionCheck( request.url, request.headers );
    var resolve, reject;
    const done_promise = new Promise( ( s, j ) => { resolve = s; reject = j } );
    const body_parts = [];
    request.on( "data", ( chunk ) => {
        try {
            // console.log( "DATA", typeof( chunk ), new Uint8Array( chunk ), chunk.toString() );
            body_parts.push( chunk );
        }
        catch( err ) {
            reject( err );
        }
    } ).on( "end", () => {
        try {
            const body = Buffer.concat( body_parts );
            const hash_fn = C.createHash( "sha256" );
            hash_fn.update( body );
            const hash_val = hash_fn.digest( "hex" );
            const now = new Date( Date.now() ).toGMTString();
            response.setHeader( "Last-Modified", now );
            response.setHeader( "ETag", hash_val );
            const bundle = T.map();
            bundle.set( "body", body );
            bundle.set( "etag", hash_val );
            bundle.set( "timestamp", now );
            the_world.put( request.url, lazyWr()( bundle ) ).then(
                () => resolve() );
            triggerLongPolls( request.url );
        }
        catch( err ) {
            reject( err );
        }
    } );
    return done_promise;
}

async function respondToDelete( request, response )
{
    log( "DELETE" );
    const file = await readTheWorld( request.url );
    if( !file )
    {
        throw new BasicError( 404 );
    }
    await the_world.del( request.url );
    triggerLongPolls( request.url );
    response.setHeader( "Last-Modified", file.get( "timestamp" ) );
    response.setHeader( "ETag", file.get( "etag" ) );
    response.writeHead( 204 );
}

async function respondToRequest( request, response )
{
    try
    {
        log( "Request received", request.url );
        for( const [ key, value ] of CORS_HEADERS )
        {
            response.setHeader( key, value );
        }
        var response_fn;
        switch( request.method )
        {
            case     "GET": response_fn = respondToGet; break;
            case     "PUT": response_fn = respondToPut; break;
            case  "DELETE": response_fn = respondToDelete; break;
            case "OPTIONS": response_fn = respondToOptions; break;
            default: throw new BasicError( 405 );
        }
        await response_fn( request, response );
        response.end();
    }
    catch( err )
    {
        if( err.type === "BasicError" )
        {
            response.writeHead( err.status ).end();
        }
        else
        {
            console.error( err );
            response.writeHead( 500 ).end();
        }
    }
}

async function main()
{
    const server_options = {};
    var db_path = DEFAULT_DB_PATH;
    if( "db" in opt.options )
        db_path = opt.options.db;
    var port = DEFAULT_PORT;
    if( "port" in opt.options )
    {
        const x = parseInt( opt.options.port );
        if( !isNaN( x ) )
            port = x;
    }

    the_world = LDB( db_path );

    const server = http.createServer( server_options, respondToRequest );
    server.listen( port );
    log( "Listening" );
}

main().then( () => { log( "Simple File Server: init complete" ) } );
