/* Top Matter */

/*
 * Meant for testing and debugging.
 * This module simulates an HTTP file server with a local database
 * (i.e. no network or persistent storage at all).
 */

import LDB     from "level";
import P       from "path";
import * as L  from "../Utilities/logging.mjs";
import * as LS from "./local_sim_shared.mjs";
import * as GH from "./generic_http.mjs";

const DEFAULT_DB_DIR = [ ".", "Database" ];
const DEFAULT_DB_NAME = "DefaultDB"

export default function init( options_init )
{
    const mstorage = {};

    const mapWrapper = {}
    mapWrapper.get = function get( key )
    {
        return mstorage.files.get( key )
    }
    mapWrapper.set = function set( key, value )
    {
        return mstorage.files.put( key, value );
    }
    mapWrapper.deleteFile = function deleteFile( key )
    {
        return mstorage.files.del( key );
    }

    async function upload( linkA, value, options )
    {
        // L.debug( "\u21b3 leveldb_sim.upload", linkA.toString() );
        const [ response, linkB ] =
              await GH.upload( linkA, value, options, LS.upload( mapWrapper ) );
        return linkB;
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

    const db_dir = !(options_init.DB_DIR===undefined) ? options_init.DB_DIR
          : DEFAULT_DB_DIR;
    const db_name = !(options_init.DB_NAME===undefined) ? options_init.DB_NAME
          : DEFAULT_DB_NAME;

    mstorage.files         = LDB( P.join( ...db_dir.concat( db_name ) ) );
    mstorage.upload        = upload;
    mstorage.download      = download;
    mstorage.watch         = watch;
    mstorage.deleteFile    = deleteFile;
    mstorage.dehydrateLink = dehydrateLink;
    mstorage.rehydrateLink = rehydrateLink;
    return mstorage;
}
