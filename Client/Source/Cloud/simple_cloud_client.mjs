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

    const upload = A( async function upload( actx, path, content, content_type )
    {
        assert( ( typeof( path ) === "string" ) ||
                ( path.every( ( p ) => typeof( p ) === "string" ) ) );
        /* assert( typeof( content ) is whatever fetch accepts ) */

        const pu = encode_path( user, path );
        const headers = new Headers( { "Content-Length": "" + content.length } );
        if( content_type )
        {
            headers[ "Content-Type" ] = content_type;
        }

        const response =
              await fetch( host+pu.u+"/"+pu.p,
                           { method  : "POST",
                             body    : content,
                             headers : headers } );
        actx.log( "Response", response.status, response.statusText );
        if( response.ok )
            return response;
        else
            await UM.handleServerError( actx, pu.p, response );
    } );

    const download = A( async function download( actx, path, isText )
    {
        assert( ( typeof( path ) === "string" ) ||
                ( path.every( ( p ) => typeof( p ) === "string" ) ) );
        assert( isText === undefined || isText === true || isText === false );

        const pu = encode_path( user, path );
        const response = await fetch( host+pu.u+"/"+pu.p );
        actx.log( "Response", pu.p, response.status, response.statusText );
        // actx.log( "Response", pu.p, typeof( response.headers ), response.headers );
        if( response.ok )
        {
            try {
                var etag = response.headers.get( "etag" );
            }
            catch( err ) {
                throw new Error( "NO ETAG" );
            }
            const result = { meta: etag };
            if( isText )
                result.data = await response.text();
            else
                result.data = await response.arrayBuffer();
            return result;
        }
        else
            await UM.handleServerError( actx, pu.p, response );
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
