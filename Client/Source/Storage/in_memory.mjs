/* Top Matter */

/*
 * Meant for testing and debugging.
 * This module simulates in local memory an HTTP file server (i.e. no network comm at all).
 */

import B32     from "hi-base32";
import assert  from "../Utilities/assert";
import * as L  from "../Utilities/logging";
import * as UM from "../Utilities/misc";
import * as SU from "./utilities";
import * as CB from "../Crypto/basics";
import fetch   from "isomorphic-fetch"; /* imported for "Headers" and "Response" */
import P       from "path";

Array.prototype.flatten = function()
{
    return this.reduce( function( accumulator, item )
    {
        const more = [].concat( item ).some( Array.isArray );
        return accumulator.concat( more ? item.flatten() : item);
    }, [] );
};

export default function init( options )
{
    const mstorage = { files: {} };

    mstorage.upload = async function upload( file_ptr, options_u )
    {
        const prefix = UM.multiGetter( "path_prefix", "", options, options_u );
        const path_arr = [].concat( prefix, file_ptr.path ).flatten();
        assert( path_arr.every( ( p ) => typeof( p ) === "string" ) );
        const path = P.join( ...( path_arr.map( encodeURIComponent ) ) );

        const headers = new Headers();
        for( const hook of options_u.header_hooks )
        {
            hook( headers );
        }

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
                return r_fail;
            }
            if( headers.has( "If-Match" ) && !( headers.get( "If-Match" ) === file.etag ) )
            {
                return r_fail;
            }
        }
        else
        {
            if( headers.has( "If-Match" ) )
            {
                return r_fail;
            }
        }
        L.debug( "Finished checking preconditions" );

        const etag = B32.encode( await CB.digest_sha_512( options_u.body ) );
        L.debug( "in-mem \"uploading\"", path, etag );
        mstorage.files[ path ] = { body: options_u.body, etag: etag };

        const r_ok = new Response( null, { status: 200 } );
        r_ok.headers.set( "etag", etag );
        return r_ok;
    };

    mstorage.download = async function download( file_ptr, options_d )
    {
        const prefix = UM.multiGetter( "path_prefix", "", options, options_d );
        const path_arr = [].concat( prefix, file_ptr.path ).flatten();
        assert( path_arr.every( ( p ) => typeof( p ) === "string" ) );
        const path = P.join( ...( path_arr.map( encodeURIComponent ) ) );
        L.debug( "Download path", path );
        if( path in mstorage.files )
        {
            const file = mstorage.files[ path ];
            const r = new Response( null, { status: 200 } );
            r.headers.set( "etag", file.etag );
            r.arrayBuffer = () => Promise.resolve( file.body );
            return r;
        }
        else
        {
            return new Response( null, { status: 404 } );
        }
    };

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
