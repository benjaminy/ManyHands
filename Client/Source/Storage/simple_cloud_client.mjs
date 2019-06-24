/* Top Matter */

/*
 * Meant for testing and debugging.
 * This is a client for a very simple HTTP-based cloud storage server with no authentication.
 */

import assert  from "assert";
import fetch   from "isomorphic-fetch";
import * as UM from "../Utilities/misc.mjs";
import * as GH from "./generic_http.mjs"
// import * as SU from "./utilities";

const DEFAULT_SERVER_PORT = 8123;
const in_browser = this && ( this.window === this );

/* Note: Not using class syntax, because it seems to fit awkwardly with async/A */

export default function init( user, options )
{
    //assert( isString( user ) );

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

    async function coreUpload( path, headers, body )
    {
        // assert( M.isPath( path ) );
        /* assert( typeof( content ) is whatever fetch accepts ) */

        const p = host + user + "/" + path;

        const fetch_init =
		      { method : "PUT", headers: headers, body: new Buffer( body ) };
        const response = await fetch( p, fetch_init );
        // A.log( "upload Response", response.status, response.statusText );
        return response;
    }

    async function upload( link, value, options )
    {
        const [ response, meta ] =
              await GH.upload( link, value, options, coreUpload );
        return meta;
    }

    async function coreDownload( path )
    {
        // assert( M.isPath( path ) );

        const p = `${host}${user}/${path}`;
        const response = await fetch( p );
        // L.debug( "download Response", p, response.status, response.statusText );
        return response;
    }

    async function download( link, options )
    {
        return GH.download( link, options, coreDownload );
    }

    async function coreDeleteFile( path )
    {
        // assert( M.isPath( path ) );

        const p = `${host}${user}/${path}`;
        const fetch_init = { method : "DELETE" };
        const response = await fetch( p, fetch_init );
        return response;
    }

    function deleteFile( link, options )
    {
        return GH.deleteFile( link, options, coreDeleteFile );
    }

    function watch( link, options )
    {
        throw new Error( "Unimplemented" );
    }

    function dehydrateLink( link, options )
    {
        return GH.dehydrateLink( link, options );
    }

    function rehydrateLink( link, options )
    {
        return GH.rehydrateLink( link, options );
    }

    return {
        upload: upload,
        download: download,
        deleteFile: deleteFile,
        watch: watch
    };
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
