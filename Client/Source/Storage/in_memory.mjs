/* Top Matter */

/*
 * Meant for testing and debugging.
 * This module simulates an HTTP file server in local memory
 * (i.e. no network or persistent storage at all).
 */

import assert  from "assert";
import B32     from "hi-base32";
import fetch   from "isomorphic-fetch"; /* imported for "Headers" and "Response" */
import * as L  from "../Utilities/logging.mjs";
import * as UM from "../Utilities/misc.mjs";
import * as CB from "../Crypto/basics.mjs";
import * as GH from "./generic_http.mjs";

export default function init( options_init )
{
    const mstorage = {};

    function preconditionCheck( path, headers )
    {
        const resp_fail = new Response( null, { status: 412 } );

        if( path in mstorage.files )
        {
            const file = mstorage.files[ path ];
            if( headers.has( "If-None-Match" ) )
            {
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
                /* Atomicity failure */
                return resp_fail;
            }
        }
        else
        {
            if( headers.has( "If-Match" ) )
            {
                /* Not sure what this failure is about */
                return resp_fail;
            }
        }
        return null;
    }

    async function coreUpload( path, headers, body )
    {
        /* assert mstorage.files is ok */
        const response_precond = preconditionCheck( path, headers );
        if( response_precond )
        {
            L.debug( "in-mem: Precond check failed" );
            return response_precond;
        }
        const etag = B32.encode( await CB.digest_sha_512( body ) );
        const now = Date.now();
        mstorage.files[ path ] = { body: body, etag: etag, timestamp: now };

        const response_ok = new Response( null, { status: 200 } );
        response_ok.headers.set( "etag", etag );
        /* NOTE: The HTTP spec mandates GMT */
        response_ok.headers.set( "Last-Modified", new Date( now ).toGMTString() );
        L.debug( "in-mem: Uploaded", path, now, etag );
        return response_ok;
    }

    async function upload( linkA, value, options )
    {
        const [ response, linkB ] =
              await GH.upload( linkA, value, options, coreUpload );
        return linkB;
    }

    async function coreDownload( path )
    {
        if( path in mstorage.files )
        {
            const r = new Response( null, { status: 200 } );
            const file = mstorage.files[ path ];
            const last_modified = new Date( file.timestamp ).toGMTString();
            r.headers.set( "etag", file.etag );
            r.headers.set( "Last-Modified", last_modified );
            r.arrayBuffer = () => Promise.resolve( file.body );
            L.debug( "in-mem: Download succeeded", path, file.timestamp, file.etag );
            return r;
        }
        else
        {
            L.debug( "in-mem: Download failed", path );
            return new Response( null, { status: 404 } );
        }
    }

    async function download( link, options )
    {
        return GH.download( link, options, coreDownload );
    }
    

//     mstorage.fpFromPlainData = async function fpFromPlainData( fp )
//     {
//         return { path: fp.path };
//     }

//     mstorage.fpToPlainData = async function fpToPlainData( fp )
//     {
//         return { path: fp.path };
//     }

    mstorage.files    = {};
    mstorage.upload   = upload;
    mstorage.download = download;
    return mstorage;
}
