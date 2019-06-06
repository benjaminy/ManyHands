/* Top Matter */

/*
 * Meant for testing and debugging.
 * This is a client for a very simple HTTP-based cloud storage server with no authentication.
 */

import assert  from "../Utilities/assert";
import fetch   from "isomorphic-fetch";
import * as UM from "../Utilities/misc";
import * as SU from "./utilities";

const DEFAULT_SERVER_PORT = 8123;
const in_browser = this && ( this.window === this );

/* Note: Not using class syntax, because it seems to fit awkwardly with async/A */

export default function init( user, options )
{
    assert( isString( user ) );

    if( options )
    {
        throw new Error( "Unimplemented" );
    }
    else
    {
        if( in_browser )
        {
            const loc = window.location;
            var protocol_hostname = loc.protocol + "//" + loc.hostname;
        }
        else
        {
            var protocol_hostname = "http://localhost";
        }
    }

    const host = protocol_hostname + ":" + DEFAULT_SERVER_PORT + "/";

    const upload = async function upload( link, value, options )
    {
        async function coreUpload( path, headers, body )
        {
            assert( M.isPath( path ) );
            /* assert( typeof( content ) is whatever fetch accepts ) */

            const p = encode_path( user, path );

            const fetch_init =
		  { method : "POST", headers: headers, body: body };
            const response = await fetch( p, fetch_init );
            A.log( "upload Response", response.status, response.statusText );
            return response;
        }

	return GH.upload( link, value, options )
    };

    const download = async function download( path, options )
    {
        assert( M.isPath( path ) );

        const p = encode_path( user, path );
        const response = await fetch( p );
        L.debug( "download Response", p, response.status, response.statusText );
        // A.log( "Response", p, typeof( r.headers ), r.headers );
        if( !response.ok )
            return response;
        const r = Object.assign( {}, response );

        if( response.headers.has( "etag" ) )
        {
            r.etag = response.headers.get( "etag" );
        }
        else
        {
            throw new Error( "NO ETAG" );
        }

        return r;
    };

    return { upload: upload, download: download };
}

/* graveyard: */

function uploadToTeam( cloud, team, scp )
{
    return ( [ path, content, type ] ) =>
        { return uploadFile( scp,
                             cloud,
                             [ "Teams", team ].concat( path ),
                             content,
                             type ); }
}

function downloadFromTeam( cloud, team, scp )
{
    return ( [ path, type ] ) =>
        { return downloadFile( scp,
                               cloud,
                               [ "Teams", team ].concat( path ),
                               type ); }
}
