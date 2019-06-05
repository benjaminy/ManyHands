/* Top Matter */

/*
 * File comment
 */

import assert from "assert";

export const ETAG = Symbol( "ETag" );

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

export async function randomName( headers, path, options, upload )
{
    overwriteHeader( headers, "If-None-Match", "*" );
    const retry_limit = 5;
    var retries = 0;
    while( ( !retry_limit ) || ( retries < retry_limit ) )
    {
        const bytes = CB.getRandomBytes( BYTES_PER_NAME );
        const name = UM.toHexString( bytes );
        const full_path = path.append( name );
        const [ response, link ] = await upload( full_path );
        if( response.status === 412 )
        {
            retries += 1;
            L.warn( "Name collision", name, retries );
        }
        else if( response.ok )
        {
            return [ response, Object.assign( {}, link, { path: full_path } ) ]
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
    const [ response, link_finish ] = await upload();
    if( response.status === 412 )
    {
        throw { [SC.ERROR_KIND]: SC.ERROR_ATOMIC_UPDATE_FAILED };
    }
    return [ response, link_finish ];
}

export async function upload( link_start, value, headers, options, coreUpload )
{
    const coded_value = SC.encode( value, options );
    /* TODO: compression */
    const ( cryptoed_value, crypto_link_info ) =
          SC.encrypto( coded_value, options );
    const link_mid = Object.assign( {}, link_start, crypto_link_info );
    const headers = new Headers();

    headers.set( "Content-Type", "application/octet-stream" );
    headers.set( "Content-Length", "" + cryptoed_value.byteLength );

    if( SC.COND_UPLOAD in options )
    {
        const cond_upload = options[ COND_UPLOAD ];
        if( cond_upload === COND_ATOMIC )
        {
            return atomicUpdate(
                headers, link_mid, options,
                () => { return coreUpload( link_mid.path ) } );
        }
        else if( cond_upload === COND_RAND )
        {
                GH.noOverwriteWrapper( headers, options, async () => {
                    GH.randomNameWrapper( headers, options, coreUpload )
                } )
        }

    }
}
