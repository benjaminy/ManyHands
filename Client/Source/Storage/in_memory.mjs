/* Top Matter */

/*
 * Meant for testing and debugging.
 * This module simulates an HTTP file server in local memory
 * (i.e. no network or persistent storage at all).
 */

import T       from "transit-js";
import * as L  from "../Utilities/logging.mjs";
import * as UM from "../Utilities/misc.mjs";
import * as LS from "./local_sim_shared.mjs";
import * as GH from "./generic_http.mjs";

export default function init( options_init )
{
    const mstorage = {};

    const mapWrapper = {}
    mapWrapper.get = async function get( key )
    {
        if( mstorage.files.has( key ) )
        {
            return mstorage.files.get( key )
        }
        else
        {
            throw new UM.NotFoundError();
        }
    }
    mapWrapper.set = async function set( key, value )
    {
        return mstorage.files.set( key, value );
    }
    mapWrapper.deleteFile = async function deleteFile( key )
    {
        return mstorage.files.delete( key );
    }

    async function upload( link, value, options )
    {
        // L.debug( "\u21b3 in_memory.upload", link.toString() );
        const [ response, meta ] =
              await GH.upload( link, value, options, LS.upload( mapWrapper ) );
        return meta;
    }

    function download( link, options )
    {
        return GH.download( link, options, LS.download( mapWrapper ) );
    }

    function watch (link, options)
    {
      //eventually this should be abstracted to GH
      return GH.watch(link, options, LS.watch(mapWrapper));
    }

    function deleteFile( link, options )
    {
        return GH.deleteFile( link, options, LS.deleteFile( mapWrapper ) );
    }

    function dehydrateLink( link, options )
    {
        return GH.dehydrateLink( link, options );
    }

    function rehydrateLink( link, options )
    {
        return GH.rehydrateLink( link, options );
    }

    mstorage.files         = T.map();
    mstorage.upload        = upload;
    mstorage.download      = download;
    mstorage.deleteFile    = deleteFile;
    mstorage.dehydrateLink = dehydrateLink;
    mstorage.rehydrateLink = rehydrateLink;
    return mstorage;
}
