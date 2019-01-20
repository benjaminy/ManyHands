/* Top Matter */

/*
 * Meant for testing and debugging.
 * This module simulates in local memory an HTTP file server (i.e. no network comm at all).
 */

import B32     from "hi-base32";
import P       from "path";
import fetch   from "isomorphic-fetch"; /* imported for "Headers" and "Response" */
import assert  from "../Utilities/assert";
import * as L  from "../Utilities/logging";
import * as UM from "../Utilities/misc";
import * as CB from "../Crypto/basics";

function nestedArrayFlatten( arr )
{
    return arr.reduce( function( accumulator, item )
    {
        const more = [].concat( item ).some( Array.isArray );
        return accumulator.concat( more ? nestedArrayFlatten( item ) : item );
    }, [] );
}

function preconditionCheck( path, mstorage )
{
    const r_fail = new Response( null, { status: 412 } );

    if( path in mstorage.files )
    {
        const file = mstorage.files[ path ];
        if( headers.has( "If-None-Match" ) )
        {
            if( !( headers.get( "If-None-Match" ) === "*" ) )
            {
                throw new Error( "Unimplemented" );
            }
            /* Client wants a fresh path; 'path' already taken */
            return r_fail;
        }
        if( headers.has( "If-Match" ) && !( headers.get( "If-Match" ) === file.etag ) )
        {
            /* Atomicity failure */
            return r_fail;
        }
    }
    else
    {
        if( headers.has( "If-Match" ) )
        {
            /* Not sure what this failure is about */
            return r_fail;
        }
    }
    L.debug( "Finished checking preconditions" );
    return null;
}

async function uploadInMem( mstorage, file_ptr, options_u )
{
    const prefix = UM.multiGetter( "path_prefix", "", options, options_u );
    const path_arr = nestedArrayFlatten( [].concat( prefix, file_ptr.path ) );
    assert( path_arr.every( ( p ) => typeof( p ) === "string" ) );
    const path = P.join( ...( path_arr.map( encodeURIComponent ) ) );

    const headers = new Headers();
    for( const hook of options_u.header_hooks )
    {
        hook( headers );
    }

    const r = preconditionCheck();
    if( r )
        return r;

    const etag = B32.encode( await CB.digest_sha_512( options_u.body ) );
    /* Note: The HTTP spec mandates GMT */
    const now = Date.now();
    L.debug( "in-mem 'uploading'", path, etag, now );
    mstorage.files[ path ] = { body: options_u.body, etag: etag, timestamp: now };

    const r_ok = new Response( null, { status: 200 } );
    r_ok.headers.set( "etag", etag );
    return r_ok;
}

async function downloadInMem( mstorage, file_ptr, options_d )
{
    const prefix = UM.multiGetter( "path_prefix", "", options, options_d );
    const path_arr = nestedArrayFlatten( [].concat( prefix, file_ptr.path ) );
    assert( path_arr.every( ( p ) => typeof( p ) === "string" ) );
    const path = P.join( ...( path_arr.map( encodeURIComponent ) ) );
    L.debug( "Download path", path );
    if( path in mstorage.files )
    {
        const file = mstorage.files[ path ];
        const r = new Response( null, { status: 200 } );
        r.headers.set( "etag", file.etag );
        const last_modified = new Date( file.timestamp ).toGMTString();
        r.headers.set( "Last-Modified", last_modified );
        r.arrayBuffer = () => Promise.resolve( file.body );
        return r;
    }
    else
    {
        return new Response( null, { status: 404 } );
    }
}

export default function init( options )
{
    const mstorage = { files: {} };
    mstorage.upload   = ( ...ps ) =>   uploadInMem( mstorage, ...ps );
    mstorage.download = ( ...ps ) => downloadInMem( mstorage, ...ps );

    mstorage.fpFromPlainData = async function fpFromPlainData( fp )
    {
        return { path: fp.path };
    }

    mstorage.fpToPlainData = async function fpToPlainData( fp )
    {
        return { path: fp.path };
    }

    return mstorage;
}
