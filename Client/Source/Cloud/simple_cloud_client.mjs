/* Top Matter */

/*
 * Meant for testing and debugging.
 * This is a client for a very simple HTTP-based cloud storage server with no authentication.
 */

import { actFn, Scheduler } from "../Utilities/act-thread";
import fetch from "isomorphic-fetch";

const DEFAULT_SERVER_PORT = 8123;

function encode_path( user, path )
{
    /* assert( Array.isArray( path ) || typeof( path ) == "string" ) */
    /* assert( Array.isArray( path ) => forall i. typeof( path[i] ) == "string" ) */
    /* assert( typeof( user ) == "string" ) */
    if( !Array.isArray( path ) )
    {
        path = [ path ];
    }
    return { p: path.map( encodeURIComponent ).join( "/" ),
             u: encodeURIComponent( user ) };
}

export function init( options )
{
    if( options )
    {
        throw new Error( "Unimplemented" );
    }
    else
    {
        let port = DEFAULT_SERVER_PORT;
        if( this.window === this )
        {
            let loc = window.location;
            var FILE_SERVER_ADDR = loc.protocol + "//" + loc.hostname + ":" + port + "/";
        }
        else
        {
            var FILE_SERVER_ADDR = "http://localhost:" + port + "/";
        }
    }

    const upload = actFn( function* upload( actx, user, path, content, content_type )
    {
        /* assert( Array.isArray( path ) || typeof( path ) == "string" ) */
        /* assert( Array.isArray( path ) => forall i. typeof( path[i] ) == "string" ) */
        /* assert( typeof( user ) == "string" ) */
        /* assert( typeof( content ) is whatever fetch accepts ) */
        const pu = encode_path( user, path );
        const headers = new Headers( { "Content-Length": "" + content.length } );
        if( content_type )
        {
            headers[ "Content-Type" ] = content_type;
        }

        const responbse =
              yield fetch( FILE_SERVER_ADDR+pu.u+"/"+pu.p,
                           { method  : "POST",
                             body    : content,
                             headers : headers } );
        actx.log( "Response", response.status, response.statusText );
        if( response.ok )
            return P.resolve( response );
        else
            return handleServerError( actx, pu.p, response );
    } );

    const download = actFn( function* download( actx, user, path, isText )
    {
        /* assert( Array.isArray( path ) || typeof( path ) == "string" ) */
        /* assert( Array.isArray( path ) => forall i. typeof( path[i] ) == "string" ) */
        /* assert( typeof( user ) == "string" ) */
        const pu = encode_path( user, path );
        const response = yield fetch( FILE_SERVER_ADDR+pu.u+"/"+pu.p );
        actx.log( pu.p, response.status, response.statusText );
        if( response.ok )
        {
            if( isText )
                return response.text();
            else
                return response.arrayBuffer();
        }
        else
            return handleServerError( actx, pu.p, response );
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
