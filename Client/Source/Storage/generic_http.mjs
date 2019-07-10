/* Top Matter */

/*
 * File comment
 */

import assert  from "assert";
import P       from "path";
import T       from "transit-js";
import * as L  from "../Utilities/logging.mjs";
import * as UM from "../Utilities/misc.mjs";
import * as UT from "../Utilities/transit.mjs";
import * as CB from "../Crypto/basics.mjs";
import * as SC from "./common.mjs";

const DEFAULT_BYTES_PER_NAME = 10;

export function overwriteHeader( headers, name, value )
{
    if( headers.has( name ) )
    {
        L.warn( "Overwriting header", name,
                "WAS:", headers.get( name ),
                "NOW:", value );
        headers.delete( name );
    }
    headers.set( name, value );
}

function processPath( path_arrs, options )
{
    const path1 = options.has( SC.PATH_PREFIX ) ?
          options.get( SC.PATH_PREFIX ).concat( path_arrs ) : path_arrs;
    const path2 = UM.nestedArrayFlatten( path1 );
    path2.every( ( p ) => assert( typeof( p ) === "string" ) );
    // assert( path2.every( ( p ) => typeof( p ) === "string" ) );
    const path3 = P.join( ...( path2.map( encodeURIComponent ) ) );
    return path3;
}

export async function noOverwrite( headers, options, upload )
{
    overwriteHeader( headers, "If-None-Match", "*" );
    const [ response, meta ] = await upload();
    if( response.status === 412 )
    {
        throw new SC.NoOverwriteFailedError();
    }
    return [ response, meta ];
}

export async function newName( headers, link, options, upload )
{
    overwriteHeader( headers, "If-None-Match", "*" );
    const retry_limit = 5;
    var retries = 0;
    const path_start = link.get( "path" );
    assert( true /* isPath( path_start ) */ );
    while( ( !retry_limit ) || ( retries < retry_limit ) )
    {
        const bytes = CB.getRandomBytes( DEFAULT_BYTES_PER_NAME );
        const name = UM.toHexString( bytes );
        const path = path_start.concat( name );
        const [ response, meta ] = await upload( path );
        if( response.ok )
        {
            const m = UT.mapFromTuples(
                [ ...meta, [ "new_name", name ], [ "name_retries", retries ] ] );
            return [ response, m ];
        }
        else if( response.status === 412 )
        {
            retries += 1;
            L.warn( "Name collision", retries, name, path_start );
        }
        else
        {
            return [ response, meta ];
        }
    }
    throw new SC.RetryLimitError;
}

export async function atomicUpdate( headers, link, options, upload )
{
    assert( link.has( "Atomicity" ) );
    overwriteHeader( headers, "If-Match", link.get( "Atomicity" ) );
    const [ response, meta ] = await upload();
    if( response.status === 412 )
    {
        throw new SC.AtomicUpdateFailedError();
    }
    return [ response, meta ];
}

export async function watch(link,options,coreWatch)
{
  const path = link.get("path");
  return coreWatch(path,options);
}

export async function upload( link, value, options, coreUpload )
{
    L.debug( "\u21b3 generic_http.upload", link.toString(), options.toString() );
    const value_encoded = SC.encode( value, options );
    /* TODO: compression */
    const [ value_encryptoed, meta ] =
          await SC.encrypto( value_encoded, options );

    const headers = new Headers();
    headers.set( "Content-Type", "application/octet-stream" );
    headers.set( "Content-Length", "" + value_encryptoed.byteLength );
    // console.log( "LENGTH", value_encryptoed.byteLength );

    async function uploadThen( path_arr )
    {
        // L.debug( "\u21b3 generic_http.uploadThen", path_arr );
        const path = processPath( path_arr, options );
        const response = await coreUpload( path, headers, value_encryptoed );
        if( options.has( SC.COND_UPLOAD ) )
        {
            const cond = options.get( SC.COND_UPLOAD );
            if( cond === SC.COND_ATOMIC || cond === SC.COND_NO_OVERWRITE )
            {
                meta.set( "Atomicity", response.headers.get( "etag" ) );
                meta.set( "timestamp", response.headers.get( "Last-Modified" ) );
            }
        }
        return [ response, meta ];
    }
    const uploadPathThen = () => uploadThen( link.get( "path" ) );

    if( options.has( SC.COND_UPLOAD ) )
    {
        const cond_upload = options.get( SC.COND_UPLOAD );
        if( cond_upload === SC.COND_ATOMIC )
        {
            return atomicUpdate( headers, link, options, uploadPathThen );
        }
        else if( cond_upload === SC.COND_NO_OVERWRITE )
        {
            return noOverwrite( headers, options, uploadPathThen );
        }
        else if( cond_upload === SC.COND_NEW_NAME )
        {
            return newName( headers, link, options, uploadThen );
        }
        else
        {
            throw new UM.UnsupportedOptionError();
        }
    }
    else
    {
        return uploadPathThen();
    }
}

export async function download( link, options, coreDownload )
{
    const path = processPath( link.get( "path" ), options );

    const response = await coreDownload( path, options );
    if( !response.ok )
    {
        throw new SC.FileNotFoundError();
    }
    /* NOTE: I thought response.arrayBuffer was the "right" way... */
    const value = await ( "arrayBuffer" in response ? response.arrayBuffer() : response.buffer() );
    const value_decryptoed = await SC.decrypto( value, link, options );
    // TODO: decompress
    const value_decoded = SC.decode( value_decryptoed, options );
    const meta = T.map();
    // TODO: If atomic
    meta.set( "Atomicity", response.headers.get( "etag" ) );
    return [ value_decoded, meta ];
}

export async function deleteFile( link, options, coreDelete )
{
    const path = processPath( link.get( "path" ), options );

    const response = await coreDelete( path, options );
    if( !response.ok )
    {
        throw new SC.FileNotFoundError();
    }
}

export function dehydrateLink( link, options )
{
}

export function rehydrateLink( link, options )
{
}
