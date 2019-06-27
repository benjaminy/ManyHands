/*
 * This server uses LevelDB to act like a simple cloud server
 */

import assert from "assert";
import http   from "http";
import https  from "https";
import url    from "url";
import P      from "path";
import LDB    from "level";
import GOPT   from "node-getopt";
import C      from "crypto";
import T      from "transit-js";
import PPH    from "parse-prefer-header";
import NC     from "node-cleanup";
import FS     from "fs";

const DEFAULT_PORT = 8080;
const DEFAULT_DB_PATH = P.join( ".", "Testing", "Cloud", "Default" );
const LONGPOLL_MIN_TIMEOUT = 1;
const LONGPOLL_MAX_TIMEOUT = 100;

const CORS_HEADERS =
      [ [ "Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS,DELETE" ],
        [ "Access-Control-Allow-Origin", "*" ],
        [ "Access-Control-Allow-Headers",
          "Origin, X-Requested-With, Content-Type, Accept, Longpoll, Stamp" ] ];

function isDigit( l )
{
    return (!!l) && l >= "0" && l <= "9" && l.length === 1;
}

function allDigits( s )
{
    if( !( typeof(s) === "string" ) )
        return false;
    var any = false;
    for( const letter of s )
    {
        if( !isDigit( letter ) )
            return false;
        any = true;
    }
    return any;
}

function log( ...ps )
{
    console.log( "[SimpleCloud]", ...ps );
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

async function readMeta( db, key )
{
    try {
        return await db.get( "M" + key, { valueEncoding: "json" } );
    }
    catch( err ) {
        if( err.type === "NotFoundError" )
        {
            return undefined;
        }
        throw err;
    }
}

async function readFile( db, key )
{
    try {
        const datap = db.get( "D" + key, { valueEncoding: "binary" } );
        const metap = db.get( "M" + key, { valueEncoding: "json" } );
        const [ data, meta ] = await Promise.all( [ datap, metap ] );
        meta.body = data;
        return meta;
    }
    catch( err ) {
        if( err.type === "NotFoundError" )
        {
            return undefined;
        }
        throw err;
    }
}

async function respondToLongPoll( db, long_poll_requests, request, file, response )
{
    const req_etag = request.headers[ "if-none-match" ];
    // TODO: etag parsing
    if( !( req_etag === file.etag) )
    {
        return true;
    }
    if( !( "prefer" in request.headers ) )
    {
        return true;
    }
    const preferences = PPH( request.headers.prefer );
    if( !( "wait" in preferences ) )
    {
        return true;
    }
    if( !allDigits( preferences.wait ) )
    {
        throw new BasicError( 400 );
    }
    const client_timeout_pref = parseInt( preferences.wait );
    const path = request.url;
    const timeout = Math.max( LONGPOLL_MIN_TIMEOUT,
                              Math.min( LONGPOLL_MAX_TIMEOUT, client_timeout_pref ) );

    var resolve, reject;
    const longPollPromise = new Promise( ( s, j ) => { resolve = s, reject = j } );
    setTimeout( () => reject( new TimeoutError() ), timeout * 1000 );

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
            throw new BasicError( 304 );
        }
        throw err;
    }

    await respondToGet( db, long_poll_requests, request, response, true );
    return false;
}

function triggerLongPolls( long_poll_requests, path )
{
    if( !long_poll_requests.has( path ) )
    {
        return;
    }
    const resolves = long_poll_requests.get( path );
    long_poll_requests.delete( path );
    for( const resolve of resolves )
    {
        resolve();
    }
}

async function respondToGet(
    db, long_poll_requests, request, response, end_of_long_poll )
{
    log( "GET", request.url );
    const file = await readFile( db, request.url );
    if( !( file ) )
    {
        throw new BasicError( 404 );
    }
    if( "if-none-match" in request.headers
        && !end_of_long_poll )
    {
        console.log("entered longpoll");
        const skip = await respondToLongPoll(
            db, long_poll_requests, request, file, response );
        if( !skip )
            return;
    }
    response.setHeader( "Content-Type", "application/octet-stream" );
    response.setHeader( "Content-Length", "" + file.body.byteLength );
    response.setHeader( "Last-Modified", file.timestamp );
    response.setHeader( "ETag", file.etag );
    response.writeHead( 200 );
    response.write( Buffer.from( file.body ) );
}

async function preconditionCheck( db, path, headers )
{
    const meta = await readMeta( db, path );
    if( meta )
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
            && !( headers[ "if-match" ] === meta.etag ) )
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
}

async function respondToPut( db, long_poll_requests, request, response )
{
    log( "PUT", request.url );
    await preconditionCheck( db, request.url, request.headers );
    var resolve, reject;
    const done_promise = new Promise( ( s, j ) => { resolve = s; reject = j } );
    const body_parts = [];
    request.on( "data", ( chunk ) => {
        try {
            body_parts.push( chunk );
        }
        catch( err ) {
            reject( err );
        }
    } ).on( "end", async () => {
        try {
            const body = Buffer.concat( body_parts );
            const hash_fn = C.createHash( "sha256" );
            hash_fn.update( body );
            const hash_val = hash_fn.digest( "hex" );
            const now = new Date( Date.now() ).toGMTString();
            response.setHeader( "Last-Modified", now );
            response.setHeader( "ETag", hash_val );
            const pm = db.put(
                "M" + request.url, { etag: hash_val, timestamp:now },
                { valueEncoding: "json" } );
            const pd = db.put(
                "D" + request.url, body, { valueEncoding: "binary" } );
            await Promise.all( [ pm, pd ] );
            triggerLongPolls( long_poll_requests, request.url );
            resolve();
        }
        catch( err ) {
            reject( err );
        }
    } );
    return await done_promise;
}

async function respondToDelete( db, long_poll_requests, request, response )
{
    log( "DELETE", request.url );
    const meta = await readMeta( db, request.url );
    if( !meta )
    {
        throw new BasicError( 404 );
    }
    await db.del( "M" + request.url );
    await db.del( "D" + request.url );
    triggerLongPolls( long_poll_requests, request.url );
    response.setHeader( "Last-Modified", meta.timestamp );
    response.setHeader( "ETag", meta.etag );
    response.writeHead( 204 );
}

function respondToRequest( db, long_poll_requests )
{
    return async ( request, response ) =>
{
    try
    {
        /* Do we always need CORS headers??? */
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
            default:
            {
                log( "Mysterious HTTP method:", request.method );
                throw new BasicError( 405 );
            }
        }
        await response_fn( db, long_poll_requests, request, response );
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
}

function shutdownCleanup( db, server )
{
    return ( exitCode, signal ) =>
{
    log( "Closing the server", exitCode, signal, "..." );
    server.close( () =>
    {
        log( "Closed the server" );
        log( "Closing the database ..." );
        db.close( ( err ) =>
        {
            log( "Closed the database" );
            if( err )
                console.error( err );
            process.kill( process.pid, signal );
        } );
    } );

    NC.uninstall();
    /* NOTE: This trick to let the close callbacks run doesn't
     * seem to work for process.exit... so don't do that? */
    return false;
}
}

async function main()
{
    const opt = GOPT.create( [
        [ "P", "port=PORT",      "Port to serve on; default is "+DEFAULT_PORT ],
        [ "D", "db=DB_PATH",     " "+DEFAULT_DB_PATH ],
        [ "C", "cert=CERT_FILE", "Certificate file; required for HTTPS" ],
        [ "K", "key=KEY_FILE",   "key file; required for HTTPS" ] ] )
          .bindHelp().parseSystem();

    var db_path = DEFAULT_DB_PATH;
    if( "db" in opt.options )
    {
        db_path = opt.options.db;
    }
    const db = LDB( db_path );
    const long_poll_requests = T.map();

    var port = DEFAULT_PORT;
    if( "port" in opt.options )
    {
        const x = parseInt( opt.options.port );
        if( !isNaN( x ) )
            port = x;
    }

    var protocol = http;
    const server_options = {};
    if( "cert" in opt.options && "key" in opt.options )
    {
        protocol = https;
        server_options.key  = await FS.promises.readFile( opt.options.key );
        server_options.cert = await FS.promises.readFile( opt.options.cert );
    }

    const server = protocol.createServer(
        server_options, respondToRequest( db, long_poll_requests ) );
    server.listen( port );

    NC( shutdownCleanup( db, server ) );

    log( "Listening" );
}

main().then( () => { log( "Init complete" ) } );
