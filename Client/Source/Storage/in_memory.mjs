/* Top Matter */

/*
 * Meant for testing and debugging.
 * This module simulates in local memory an HTTP file server (i.e. no network comm at all).
 */

import assert  from "../Utilities/assert";
import A       from "../Utilities/activities";
import * as UM from "../Utilities/misc";
import * as SU from "./utilities";
import * as CB from "../Crypto/basics";
const P = Promise;

export default function init( user, options )
{
    assert( typeof( user ) === "string" );

    if( options )
    {
        throw new Error( "Unimplemented" );
    }

    const mstorage = { files: {} };

    mstorage.upload = A( function* upload( path, options_u )
    {
        assert( M.isPath( path ) );

        const p = SU.encode_path( user, path );
        const headers = new Headers();
        for( const hook of options_u.header_hooks )
        {
            hook( headers );
        }

        const r = Response();
        r.ok = false;
        r.status = 412;
        r.statusText = "Precondition Failed";

        if( p in mstorage.files )
        {
            const file = mstorage.files[ p ];
            if( headers.has( "If-None-Match" ) )
            {
                if( !( headers.get( "If-None-Match" ) === "*" ) )
                {
                    throw new Error( "Unimplemented" );
                }
                return r;
            }
            if( headers.has( "If-Match" ) && !( headers.get( "If-Match" ) === file.etag ) )
            {
                return r;
            }
        }
        else
        {
            if( headers.has( "If-Match" ) )
            {
                return r;
            }
        }
        L.debug( "Finished checking preconditions" );

        const etag = CB.digest_sha_512( options_u.body );
        const file = { body: options_u.body, etag: etag };
        files[ p ] = file;
        r.ok = true;
        r.status = 200;
        r.statusText = "OK";
        r.headers.set( "etag", etag );
        return r;
    } );

    mstorage.download = A( function* download( path, options_d )
    {
        assert( M.isPath( path ) );

        const p = SU.encode_path( user, path );
        const r = Response();
        if( p in mstorage.files )
        {
            const file = mstorage.files[ p ];
            r.ok = true;
            r.status = 200;
            r.statusText = "OK";
            r.headers.set( "etag", file.etag );
            r.arrayBuffer = () => P.resolve( file.body );
            return r;
        }
        else
        {
            r.ok = false;
            r.status = 404;
            r.statusText = "Not Found";
            return r;
        }
    } );

    return mstorage;
}
