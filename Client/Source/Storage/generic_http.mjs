/* Top Matter */

/*
 * File comment
 */

import assert  from "assert";
import P       from "path";
import * as L  from "../Utilities/logging.mjs";
import * as UM from "../Utilities/misc.mjs";
import * as UT from "../Utilities/transit.mjs";
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
    const path_start = link_start.get( "path" );
    assert( true /* isPath( path_start ) */ );
    while( ( !retry_limit ) || ( retries < retry_limit ) )
    {
        const bytes = CB.getRandomBytes( DEFAULT_BYTES_PER_NAME );
        const name = UM.toHexString( bytes );
        const path = path_start.concat( name );
        const [ response, link ] = await upload( path );
        if( response.ok )
        {
            // const l = UT.mapFromTuples( [ ...link, [ "path", link_start.get( "path" ) ] ] );
            const l = UT.mapFromTuples( [ ...link, [ "path", path ] ] );
            return [ response, l ];
        }
        else if( response.status === 412 )
        {
            retries += 1;
            L.warn( "Name collision", name, retries );
        }
        else
        {
            return [ response, T.map() ];
        }
    }
    throw { [SC.ERROR_KIND]: SC.ERROR_RETRY_LIMIT };
}

export async function atomicUpdate( headers, link_start, options, upload )
{
    assert( link_start.has( "ETAG" ) );
    overwriteHeader( headers, "If-Match", link_start.get( "ETAG" ) );
    const [ response, link_finish ] = await upload( link_start );
    if( response.status === 412 )
    {
        throw { [SC.ERROR_KIND]: SC.ERROR_ATOMIC_UPDATE_FAILED };
    }
    return [ response, link_finish ];
}

export async function upload( link_start, value, options, coreUpload )
{
    L.debug( "\u21b3 generic_http.upload", link_start.toString(), options.toString() );
    const coded_value = SC.encode( value, options );
    /* TODO: compression */
    const [ cryptoed_value, crypto_link_info ] =
          await SC.encrypto( coded_value, options );
    const cryptoed_link = UT.mapFromTuples( [ ...link_start, ...crypto_link_info ] );

    const headers = new Headers();
    headers.set( "Content-Type", "application/octet-stream" );
    headers.set( "Content-Length", "" + cryptoed_value.byteLength );

    async function uploadThen( path_arr )
    {
        L.debug( "\u21b3 generic_http.uploadThen", path_arr );
        var path = path_arr;
        if( options.has( SC.PATH_PREFIX ) )
        {
            path = options.get( SC.PATH_PREFIX ).concat( path );
        }
        path = UM.nestedArrayFlatten( path );
        path.every( ( p ) => assert( typeof( p ) === "string" ) );
        // assert( path.every( ( p ) => typeof( p ) === "string" ) );
        path = P.join( ...( path.map( encodeURIComponent ) ) );
        const response = await coreUpload( path, headers, cryptoed_value );
        const link_response = UT.mapFromTuples( [ [ "path", path_arr ] ] );
        if( true || options.has( SC.COND_UPLOAD ) && ( options.get( SC.COND_UPLOAD ) === SC.COND_ATOMIC ) )
        {
            link_response.set( "ETAG", response.headers.get( "etag" ) );
            link_response.set( "timestamp", response.headers.get( "Last-Modified" ) );
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
                () => { return uploadThen( cryptoed_link.get( "path" ) ) } );
        }
        else if( cond_upload === SC.COND_NO_OVERWRITE )
        {
            return noOverwrite(
                headers, options, () => { return uploadThen( cryptoed_link.get( "path" ) ); } )
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
        return uploadThen( cryptoed_link.get( "path" ) );
    }
}

export async function download( link, options, coreDownload )
{
    const link_mid = link.clone();
    if( options.has( SC.PATH_PREFIX ) )
    {
        link_mid.set( "path", options.get(
            SC.PATH_PREFIX ).concat( link_mid.get( "path" ) ) );
    }
    link_mid.set( "path", UM.nestedArrayFlatten( link_mid.get( "path" ) ) );
    assert( link_mid.get( "path" ).every( ( p ) => typeof( p ) === "string" ) );
    link_mid.set( "path",  P.join(
        ...( link_mid.get( "path" ).map( encodeURIComponent ) ) ) );

    const response = await coreDownload( link_mid.get( "path" ), options );
    if( !response.ok )
    {
        throw { [SC.ERROR_KIND]: SC.ERROR_NOT_FOUND };
    }
    const value = await SC.decrypto( await response.arrayBuffer(), link, options );
    const value_decoded = SC.decode( value, options );
    return [ value_decoded, {} ];
}
