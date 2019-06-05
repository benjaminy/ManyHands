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

    const upload = async function upload( link_start, value, options )
    {
        const coded_value = SC.encode( value, options );
        /* TODO: compression */
        const ( cryptoed_value, crypto_link_info ) =
              SC.encrypto( coded_value, options );
        const link_mid = Object.assign( {}, link_start, crypto_link_info );
        const headers = new Headers();

        headers.set( "Content-Type", "application/octet-stream" );
        headers.set( "Content-Length", "" + cryptoed_value.byteLength );

        async function coreUpload( path )
        {
            assert( M.isPath( path ) );
            /* assert( typeof( content ) is whatever fetch accepts ) */

            const p = encode_path( user, path );

            const fetch_options = { method : "POST", headers: headers, body: cryptoed_value };
            const response = await fetch( p, fetch_options );
            A.log( "upload Response", response.status, response.statusText );
            return response;
        }

        if( SC.COND_UPLOAD in options )
        {
            const cond_upload = options[ COND_UPLOAD ];
            if( cond_upload === COND_ATOMIC )
            {
                return GH.atomicUpdate(
                    headers, link_mid, options,
                    () => { return coreUpload( link_mid.path ) } );
            }
            else if( cond_upload === COND_
        }
        
        const response =
            await GH.atomicUpload( headers, options, async () => {
                GH.noOverwriteWrapper( headers, options, async () => {
                    GH.randomNameWrapper( headers, options, coreUpload )
                } )
            } );

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
