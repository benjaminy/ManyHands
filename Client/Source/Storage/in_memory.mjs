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

    async function coreUpload( path, headers, body )
    {
        /* assert mstorage.files is ok */
        L.debug( "\u21b3 in_memory.coreUpload", path, path in mstorage.files );
        const response_precond = preconditionCheck( path, headers );
        if( response_precond )
        {
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
        L.debug( "\u21b3 in_memory.upload", linkA.toString() );
        const [ response, linkB ] =
              await GH.upload( linkA, value, options, coreUpload );
        return linkB;
    }

    async function coreDownload( path )
    {
        L.debug( "\u21b3 in_memory.coreDownload", path in mstorage.files, path );
        // console.log( mstorage.files );
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

    function download( link, options )
    {
        return GH.download( link, options, coreDownload );
    }

    async function coreDelete( path )
    {
        L.debug( "\u21b3 in_memory.coreDelete", path in mstorage.files, path );
        if( path in mstorage.files )
        {
            const resp = new Response( null, { status: 204 } );
            const file = mstorage.files[ path ];
            const last_modified = new Date( file.timestamp ).toGMTString();
            resp.headers.set( "etag", file.etag );
            resp.headers.set( "Last-Modified", last_modified );
            delete mstorage.files[ path ];
            return resp;
        }
        else
        {
            return new Response( null, { status: 404 } );
        }
    }

    function deleteFile( link, options )
    {
        return GH.deleteFile( link, options, coreDelete );
    }

    function dehydrateLink( link, options )
    {
        return GH.dehydrateLink( link, options );
    }

    function rehydrateLink( link, options )
    {
        return GH.rehydrateLink( link, options );
    }

    mstorage.files         = {};
    mstorage.upload        = upload;
    mstorage.download      = download;
    mstorage.deleteFile    = deleteFile;
    mstorage.dehydrateLink = dehydrateLink;
    mstorage.rehydrateLink = rehydrateLink;
    return mstorage;
}
