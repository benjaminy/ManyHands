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

export default function init( user, options_init )
{
    //assert( isString( user ) );

    if( in_browser )
    {
        const loc = window.location;
        var protocol_hostname = loc.protocol + "//" + loc.hostname;
    }
    else
    {
        var protocol = "http";
        if( UM.hasProp( options_init, "TLS" ) )
        {
            /* NOTE: This TLS reject thing should never be deployed for realsies */
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
            protocol = "https";
        }
        const host = UM.hasProp( options_init, "host" )
              ? options_init.host : "localhost";
        var protocol_hostname = protocol + "://" + host;
    }

    const port = UM.hasProp( options_init, "port" )
          ? options_init.port : DEFAULT_SERVER_PORT;

    const dest = protocol_hostname + ":" + port;

    async function coreUpload( path, headers, body )
    {
        // assert( M.isPath( path ) );
        /* assert( typeof( content ) is whatever fetch accepts ) */

        const p = dest + "/" + user + "/" + path;

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

        const p = `${dest}/${user}/${path}`;
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

        const p = `${dest}/${user}/${path}`;
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
        const path = processPath(link.get("path"));
        const p = host + user + "/" + path;
        
        const headers = new Headers();
        headers.set("uws-longpoll");

        const fetch_init =
        { method : "GET", headers: headers};

        const response = await fetch(p, fetch_init);
        if (response.status === 412)
        {
          throw new Error ("Etag is not implemented");
        }
        else if (response.status === 408)
        {
          throw new Error ("Timed Out");
        }
        else {
          console.log("Successful notification");
          doSomethingWithResponse(response.body);
          // i assume im passing the response body into some method that formats it then passes it onto the data side
        }
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

function processPath( path_arrs, options )
{
    const path1 = options.has( SC.PATH_PREFIX ) ?
          options.get( SC.PATH_PREFIX ).concat( path_arrs ) : path_arrs;
    const path2 = UM.nestedArrayFlatten( path1 );
    path2.every( ( p ) => assert( typeof( p ) === "string" ) );
    // assert( path2.every( ( p ) => typeof( p ) === "string" ) );
    const path3 = P.join( ...( path2.map( encodeURIComponent ) ) );
    return path3;
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
