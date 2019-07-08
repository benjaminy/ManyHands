/* Top Matter */

/* For testing purposes there are a few different ways to locally
 * simulate a cloud file server.  This file contains some shared
 * utilities for such simulations. */

import B32     from "hi-base32";
import T       from "transit-js";
import fetch   from "isomorphic-fetch"; /* imported for "Headers" and "Response" */
import * as L  from "../Utilities/logging.mjs";
import * as CB from "../Crypto/basics.mjs";

const TIMEOUT = 10;

var transit_writer, transit_reader;
let watch_requests = T.map();

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

function triggerLongPolls(path)
{
  if( !watch_requests.has( path ) )
  {
      return;
  }
  const resolves = watch_requests.get( path );
  watch_requests.delete( path );
  for( const resolve of resolves )
  {
      resolve();
  }
}

async function tryGet( filesMap, key )
{
    try
    {
        const file = JSON.parse( await filesMap.get( key ) );
        const reader = lazyRd();
        return Object.assign(
            {}, file, { body: reader( file.body ), etag: reader( file.etag ) } );
    }
    catch( err )
    {
        if( !( err.type === "NotFoundError" ) )
        {
            throw err;
        }
        return undefined;
    }
}

async function preconditionCheck( path, headers, filesMap )
{
    const resp_fail = new Response( null, { status: 412 } );

    const file = await tryGet( filesMap, path );
    if( file )
    {
        if( headers.has( "If-None-Match" ) )
        {
            L.debug( "in_memory.preconditionCheck: If-None-Match",
                     headers.get( "If-None-Match" ) );
            if( !( headers.get( "If-None-Match" ) === "*" ) )
            {
                throw new Error( "Unimplemented" );
            }
            /* Client wants an unused path; 'path' already taken */
            return resp_fail;
        }
        if( headers.has( "If-Match" )
            && !( headers.get( "If-Match" ) === file.etag ) )
        {
            L.debug( "in_memory.preconditionCheck: Atomicity failure",
                     headers.get( "If-Match" ) );
            return resp_fail;
        }
    }
    else
    {
        if( headers.has( "If-Match" ) )
        {
            L.debug( "in_memory.preconditionCheck: Not sure what this failure is about",
                     headers.get( "If-Match" ) );
            return resp_fail;
        }
    }
    return null;
}

export function upload( filesMap )
{
    return async function upload( path, headers, body )
    {
        /* assert mstorage.files is ok */
        L.debug( "\u21b3 local_sim.upload", path );
        const response_precond = await preconditionCheck( path, headers, filesMap );
        if( response_precond )
        {
            return response_precond;
        }
        const etag = B32.encode( await CB.digest_sha_512( body ) );
        const now = new Date( Date.now() ).toGMTString();
        const writer = lazyWr();
        /* all the encoding here seems redundant (and maybe is), but
         * LevelDB is dumb vis a vis objects. */
        const to_upload = JSON.stringify( {
            body: writer( body ), etag: writer( etag ), timestamp: now } );
        await filesMap.set( path, to_upload );

        const response_ok = new Response( null, { status: 200 } );
        response_ok.headers.set( "etag", etag );
        /* NOTE: The HTTP spec mandates GMT */
        response_ok.headers.set( "Last-Modified", now );
        L.debug( "local-sim: Uploaded", path, now, etag );
        await triggerLongPolls(path);
        return response_ok;
    }
}

export function download( filesMap )
{
    return async function download( path )
    {
        L.debug( "\u21b3 local_sim.download", path );
        // console.log( mstorage.files.toString() );
        const file = await tryGet( filesMap, path );
        if( file )
        {
            const r = new Response( null, { status: 200 } );
            r.headers.set( "etag", file.etag );
            r.headers.set( "Last-Modified", file.timestamp );
            r.arrayBuffer = () => Promise.resolve( file.body );
            L.debug( "local-sim: Download succeeded",
                     path, file.timestamp, file.etag );
            return r;
        }
        else
        {
            L.debug( "local-sim: Download failed", path );
            return new Response( null, { status: 404 } );
        }
    }
}

export function deleteFile( filesMap )
{
    return async function deleteFile( path )
    {
        L.debug( "\u21b3 local_sim.deleteFile", path );
        const file = await tryGet( filesMap, path );
        if( file )
        {
            const resp = new Response( null, { status: 204 } );
            const last_modified = new Date( file.timestamp ).toGMTString();
            resp.headers.set( "etag", file.etag );
            resp.headers.set( "Last-Modified", last_modified );
            filesMap.deleteFile( path );
            return resp;
        }
        else
        {
            return new Response( null, { status: 404 } );
        }
    }
}

export function watch(filesMap)
{
  return async function watch(path){
    L.debug( "\u21b3 local_sim.watch", path );
    let watchResponseMeta;

    const file = await tryGet( filesMap, path);
    if (file)
    {
      var resolve, reject;
      const watch_promise = new Promise( ( s, j ) => { resolve = s, reject = j } );
      setTimeout( () => reject( new TimeoutError() ), TIMEOUT * 1000 );

      const reqs = watch_requests.has(path) ? watch_requests.get(path): T.set();
      watch_requests.set(path, reqs);
      reqs.add(resolve);

      try {
          await watch_promise;
          watchResponseMeta = 'file-changed';
      }
      catch( err ) {
        watchResponseMeta = 'timeout';
      }
    }
    else
    {
        watchResponseMeta = 'path-format-error';
    }
    return watchResponseMeta;
  }
}
