/* Top Matter */

/*
 * Meant for testing and debugging.
 * This is a client for a very simple HTTP-based cloud storage server with no authentication.
 */

import assert  from "../Utilities/assert";
import A       from "../Utilities/act-thread";
import fetch   from "isomorphic-fetch";
import * as UM from "../Utilities/misc";

const DEFAULT_SERVER_PORT = 8123;
const in_browser = this && ( this.window === this );

function encode_path( user, path )
{
    assert( typeof( user ) === "string" );
    assert( ( typeof( path ) === "string" ) ||
            ( path.every( ( p ) => typeof( p ) === "string" ) ) );

    if( !Array.isArray( path ) )
    {
        path = [ path ];
    }
    return { p: path.map( encodeURIComponent ).join( "/" ),
             u: encodeURIComponent( user ) };
}

/* Note: Not using class syntax, because it seems to fit awkwardly with async/A */

export default function init( user, options )
{
    assert( typeof( user ) === "string" );

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

    const upload = A( async function upload( actx, path, options )
    {
        assert( A.isContext( actx ) );
        assert( M.isPath( path ) );
        /* assert( typeof( content ) is whatever fetch accepts ) */

        const pu = encode_path( user, path );

        const headers = new Headers();
        if( "headersHook" in options )
            options.headersHook( headers );

        if( "body" in options && !( headers.has( "Content-Length" ) ) )
        {
            try {
                headers.set( "Content-Length", options.body.length );
            }
            catch( err ) {
                actx.log( "Failed to set content length" );
            }
        }

        if( ( !( headers.has( "Content-Type" ) ) ) && "body" in options
            && typeof( options.body ) === "string" )
        {
            headers.set( "Content-Type", "text/plain" );
        }

        const fetch_options = { method  : "POST", headers: headers };
        if( "body" in options )
        {
            fetch_options.body = options.body;
        }

        const response = await fetch( host+pu.u+"/"+pu.p, fetch_options );
        actx.log( "Response", response.status, response.statusText );
        return response;
    } );

    const download = A( async function download( actx, path, options )
    {
        assert( A.isContext( actx ) );
        assert( M.isPath( path ) );

        const pu = encode_path( user, path );
        const response = await fetch( host+pu.u+"/"+pu.p );
        actx.log( "Response", pu.p, response.status, response.statusText );
        const r = Object.assign( {}, response );
        // actx.log( "Response", pu.p, typeof( r.headers ), r.headers );

        if( !r.ok )
            await UM.handleServerError( actx, pu.p, response );

        if( response.headers.has( "etag" ) )
        {
            r.etag = response.headers.get( "etag" );
        }
        else
        {
            throw new Error( "NO ETAG" );
        }

        if( "bodyDataKind" in options )
        {
            if( options.bodyDataKind === "arrayBuffer" )
                r.full_body = await r.arrayBuffer();
            else if( options.bodyDataKind === "blob" )
                r.full_body = await r.blob();
            else if( options.bodyDataKind === "formData" )
                r.full_body = await r.formData();
            else if( options.bodyDataKind === "json" )
                r.full_body = await r.json();
            else if( options.bodyDataKind === "text" )
                r.full_body = await r.text();
            else
                throw new Error( "unknown stream kind " + options.bodyDataKind );
        }
        return r;
    } );

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
