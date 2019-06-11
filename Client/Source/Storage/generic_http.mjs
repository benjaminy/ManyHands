/* Top Matter */

/*
 * File comment
 */

import assert  from "assert";
import P       from "path";
import * as L  from "../Utilities/logging.mjs";
import * as UM from "../Utilities/misc.mjs";
import * as CB from "../Crypto/basics.mjs";
import * as SC from "./common.mjs";

export const ETAG = Symbol( "ETag" );

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

export async function noOverwrite( headers, options, upload )
{
    overwriteHeader( headers, "If-None-Match", "*" );
    const response = await upload();
    if( response.status === 412 )
    {
        throw { [SC.ERROR_KIND]: SC.ERROR_OVERWRITE_FAILED }
    }
    return response;
}

export async function newName( headers, link_start, options, upload )
{
    overwriteHeader( headers, "If-None-Match", "*" );
    const retry_limit = 5;
    var retries = 0;
    while( ( !retry_limit ) || ( retries < retry_limit ) )
    {
        const bytes = CB.getRandomBytes( DEFAULT_BYTES_PER_NAME );
        const name = UM.toHexString( bytes );
        console.log( "FOO", link_start.path, typeof( link_start.path ) );
        link_start.path = link_start.path.concat( name );
        const [ response, link ] = await upload( link_start.path );
        if( response.ok )
        {
            return [ response, Object.assign( {}, link, { path: link_start.path } ) ]
        }
        else if( response.status === 412 )
        {
            retries += 1;
            L.warn( "Name collision", name, retries );
        }
        else
        {
            return [ response, {} ];
        }
    }
    throw { [SC.ERROR_KIND]: SC.ERROR_RETRY_LIMIT };
}

export async function atomicUpdate( headers, link_start, options, upload )
{
    assert( ETAG in link_start );
    overwriteHeader( headers, "If-Match", link_start[ ETAG ] );
    const [ response, link_finish ] = await upload( link_start );
    if( response.status === 412 )
    {
        throw { [SC.ERROR_KIND]: SC.ERROR_ATOMIC_UPDATE_FAILED };
    }
    return [ response, link_finish ];
}

export async function upload( link_start, value, options, coreUpload )
{
    const coded_value = SC.encode( value, options );
    /* TODO: compression */
    const [ cryptoed_value, crypto_link_info ] =
          await SC.encrypto( coded_value, options );
    const cryptoed_link = Object.assign( {}, link_start, crypto_link_info );

    const headers = new Headers();
    headers.set( "Content-Type", "application/octet-stream" );
    headers.set( "Content-Length", "" + cryptoed_value.byteLength );

    async function uploadThen( path_arr )
    {
        L.debug( "\u21aa generic_http.uploadThen", path_arr );
        var path = path_arr;
        if( options.has( SC.PATH_PREFIX ) )
        {
            path = options.get( SC.PATH_PREFIX ).concat( path );
        }
        path = UM.nestedArrayFlatten( path );
        assert( path.every( ( p ) => typeof( p ) === "string" ) );
        path = P.join( ...( path.map( encodeURIComponent ) ) );
        const response = await coreUpload( path, headers, cryptoed_value );
        const link_response = { path: path_arr };
        if( true || options.has( SC.COND_UPLOAD ) && ( options.get( SC.COND_UPLOAD ) === SC.COND_ATOMIC ) )
        {
            link_response[ ETAG ] = response.headers.get( "etag" );
            link_response.timestamp = response.headers.get( "Last-Modified" );
        }
        return [ response, link_response ];
    }

    if( options.has( SC.COND_UPLOAD ) )
    {
        const cond_upload = options.get( SC.COND_UPLOAD );
        if( cond_upload === SC.COND_ATOMIC )
        {
            return atomicUpdate(
                headers, cryptoed_link, options,
                () => { return uploadThen( cryptoed_link.path ) } );
        }
        else if( cond_upload === SC.COND_NO_OVERWRITE )
        {
            return noOverwrite(
                headers, options, () => { return uploadThen( cryptoed_link.path ); } )
        }
        else if( cond_upload === SC.COND_NEW_NAME )
        {
            return newName( headers, cryptoed_link, options, uploadThen );
        }
        else
        {
            throw new Error( "Unsupported option" );
        }
    }
    else
    {
        return uploadThen( cryptoed_link.path );
    }
}

export async function download( link, options, coreDownload )
{
    const link_mid = Object.assign( {}, link );
    if( options.has( SC.PATH_PREFIX ) )
    {
        link_mid.path = options.get( SC.PATH_PREFIX ).concat( link_mid.path );
    }
    link_mid.path = UM.nestedArrayFlatten( link_mid.path );
    assert( link_mid.path.every( ( p ) => typeof( p ) === "string" ) );
    link_mid.path = P.join( ...( link_mid.path.map( encodeURIComponent ) ) );

    const response = await coreDownload( link_mid.path, options );
    if( !response.ok )
    {
        throw { [SC.ERROR_KIND]: SC.ERROR_NOT_FOUND };
    }
    const value = await SC.decrypto( await response.arrayBuffer(), link, options );
    const value_decoded = SC.decode( value, options );
    return [ value_decoded, {} ];
}
