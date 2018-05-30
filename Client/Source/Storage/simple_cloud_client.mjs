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

    const upload = A( function* upload( path, options )
    {
        // XXX content, content_type, headersHook
        assert( M.isPath( path ) );
        /* assert( typeof( content ) is whatever fetch accepts ) */

        const pu = encode_path( user, path );

        const headers = new Headers();
        if( !( "header_hooks" in opts ) )
            return;
        for( const hook of opts.header_hooks )
            hook( headers );

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
        const response = yield fetch( host+pu.u+"/"+pu.p, fetch_options );
        A.log( "upload Response", response.status, response.statusText );
        return response;
    } );

    const download = A( function* download( path, options )
    {
        assert( M.isPath( path ) );

        const pu = encode_path( user, path );
        const response = yield fetch( host+pu.u+"/"+pu.p );
        L.debug( "download Response", pu.p, response.status, response.statusText );
        // A.log( "Response", pu.p, typeof( r.headers ), r.headers );
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
