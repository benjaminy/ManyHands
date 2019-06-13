/* Top Matter */

/*
 * File Comment
 */

import assert  from "assert";
import T       from "transit-js";
import * as L  from "../Utilities/logging.mjs";
import * as UM from "../Utilities/misc.mjs";
import * as UT from "../Utilities/transit.mjs";
import * as SC from "./common.mjs";

const tree_node_tag        = T.symbol( "tree node" );

const plain_data_tag       = T.symbol( "plain data" );
const links_tag            = T.symbol( "links" );
const blank_timestamps_tag = T.symbol( "blank timestamps" );

const mem_cache_tag        = T.symbol( "memory cache" );
const local_cache_tag      = T.symbol( "local store cache" );
const dirty_tag            = T.symbol( "dirty" );
const to_delete_tag        = T.symbol( "to delete" );
const timestamp_tag        = T.symbol( "timestamp" );
const path_tag             = T.symbol( "path" );
const storage_tag          = T.symbol( "storage" );
const storage_options_tag  = T.symbol( "storage options" );
const prev_root_tag        = T.symbol( "previous root" );

const tree_err             = T.symbol( "tree error" );
const missing_key_err      = T.symbol( "missing key" );

// const localPersistentDB = {};


/* private */ function isTreeNode( thing )
{
    return UM.hasProp( thing, tree_node_tag );
}

/* private */ function isRoot( thing )
{
    return UM.hasProp( thing, prev_root_tag );
}

/* private */ function isValidMapKey( thing )
{
    /* TODO: maybe. Not sure if this is easy to judge. */
    return true;
}

/* Nodes are copy-on-first-write-since-last-tree-commit.
 * Make a mutable copy, if necessary. */
/* private */ function touchNode( node )
{
    if( !( dirty_tag in node ) )
    {
        const node_orig = node;
        node = Object.assign( {}, node );
        node[ dirty_tag ]     = T.set();
        node[ to_delete_tag ] = T.set();
        node[ mem_cache_tag ] = node[ mem_cache_tag ].clone();
        node[ links ]         = node[ links ].clone();
        delete node[ timestamp_tag ];
        if( isRoot( node ) )
        {
            node[ prev_root_tag ] = node_orig;
        }
    }
    return node;
}

/* private */ function untouchNode( node )
{
    assert( dirty_tag in node );
    assert( !( timestamp_tag in node ) );
    const dirties = node[ dirty_tag ];
    const to_deletes = node[ to_delete_tag ];
    const untouched = Object.assign( {}, node );
    delete untouched[ dirty_tag ];
    delete untouched[ to_delete_tag ];
    return [ untouched, dirties, to_deletes ];
}

/* Begin plain old data part */

/* Nodes always have all their plain data values.  No laziness here. */

export function getValue( node, key )
{
    assert( isTreeNode( node ) );
    assert( isValidMapKey( key ) );

    return node[ plain_data_tag ].get( key );
}

/* WARNING: Must only be used read-only */
export function getValues( node )
{
    assert( isTreeNode( node ) );

    return node[ plain_data_tag ];
}

/* NOTE: Returns a new node because of copy-on-first-write */
export function setValue( node, key, value )
{
    assert( isTreeNode( node ) );
    assert( isValidMapKey( key ) );
    /* assert( isPlainData( value ) ); */

    node = touchNode( node );
    node[ plain_data_tag ].set( key, value );
    return node;
}

/* NOTE: Returns a new node because of copy-on-first-write */
export function deleteValue( node, key )
{
    assert( isTreeNode( node ) );
    assert( isValidMapKey( key ) );

    node = touchNode( node );
    node[ plain_data_tag ].delete( key );
    return node;
}

/* End plain old data part.  Begin tree children part */

/* private */ function isInMemCache( parent, key )
{
    return parent[ mem_cache_tag ].has( key );
}

/* private */ function getfromMemCache( parent, key )
{
    if( parent[ mem_cache_tag ].has( key ) )
    {
        return parent[ mem_cache_tag ].get( key );
    }
    else
    {
        throw { [tree_err]: missing_key_err, key: key };
    }
}

/* private */ function insertIntoMemCache( parent, key, child )
{
    if( isInMemCache( parent, key ) )
    {
        /* TODO: Does it matter??? */
    }
    parent[ mem_cache_tag ].set( key, child );
}

/* private */ function isInLocalCache( parent, key )
{
    return parent[ local_cache_tag ].has( key );
}

/* private */ function dehydrate( node )
{
    const d = T.map();
    d.set( "p", node[ plain_data_tag ] );
    d.set( "b", node[ blank_timestamps_tag ] );
    const storage = node[ storage_tag ];
    const dehydrated_links = T.map();
    for( [ key, link ] of node[ links_tag ] )
    {
        dehydrated_links.set( key, storage.dehydrateLink( link ) );
    }
    d.set( "l", dehydrated_links );
    return d;
}

/* private */ function pushDownTimestamp( parent, link, child )
{
    /* TODO: if don't care about timestamp ... */
    if( "timestamp" in link )
    {
        child[ timestamp_tag ] = link.timestamp;
    }
    else
    {
        child[ timestamp_tag ] = parent[ timestamp_tag ];
    }

}

/* private */ function rehydrate( parent, link, dehydrated, storage_cb )
{
    const pstorage = parent[ storage_tag ];
    const cstorage = storage_cb ? storage_cb( pstorage ) : pstorage;
    const c = {};
    c[ tree_node_tag ]        = null;
    c[ plain_data_tag ]       = dehydrated.get( "p" );
    c[ blank_timestamps_tag ] = dehydrated.get( "b" );
    c[ mem_cache_tag ]        = T.map();
    const rehydrated_links = T.map();
    for( [ key, child_link ] of dehydrated.get( "l" ) )
    {
        rehydrated_links.set( key, cstorage.rehydrateLink(
            parent, name, link_child ) );
    }
    c[ links_tag ]           = rehydrated_links;
    c[ local_cache_tag ]     = { has: () => false };
    c[ storage_tag ]         = cstorage;

    pushDownTimestamp( parent, link, c );

    c.toString = nodeToString;
    return c;
}

export async function getChild( parent, key )
{
    assert( isTreeNode( parent ) );
    assert( isValidMapKey( key ) );

    if( isInMemCache( parent, key ) )
    {
        /* reminder: update cache timestamp */
        const child = getFromMemCache( parent, key );
        if( ( !( timestamp_tag in child ) ) && parent[ links_tag ].has( key ) )
        {
            pushDownTimestamp( parent, parent[ links_tag ].get( key ), child );
        }
        return child;
    }

    if( !( parent[ links_tag ].has( key ) ) )
    {
        throw { [tree_err]: missing_key_err, key: key };
    }

    const link = parent[ links_tag ].get( key );
    // necessary? exposed outside lib? ... assert( links_tag in link );

    if( await isInLocalCache( parent, link ) )
    {
        /* reminder: update cache timestamp */
        var dehydrated_child = await local_cache.get( link.path );
    }
    else
    {
        const options = T.map(); /* TODO??? */
        const storage = parent[ storage_tag ];
        try {
            var [ dehydrated_child, link_d ] =
                await storage.download( child_link, options  );
        }
        catch( err ) {
            /* maybe throw a different kind of error? */
            throw err;
        }

        // local_cache.insert( link, dehydrated_child );
    }

    const child = rehydrate( parent, link, dehydrated_child );
    insertInMemCache( parent, key, child );
    return child;
}

/* NOTE: It is the client code's responsibility to either save or delete
 * all of child's children.  Otherwise they will become garbage. */
export function deleteChild( parent, key )
{
    assert( isTreeNode( parent ) );
    assert( isValidMapKey( key ) );

    if( !( ( parent[ links_tag ].has( key )
             || isInMemCache( parent, key ) ) ) )
    {
        throw { [tree_err]: missing_key_err, key: key };
    }
    else if( !( parent[ links_tag ].has( key ) ) )
    {
        /* child in memory cache, but no link.
           This means it hasn't been committed yet. */
        /* mem cache kinda complicated ... */
        assert( dirty_tag in parent );
        /* TODO: sanity check deletes? */
        parent[ mem_cache_tag ].delete( key );
        parent[ dirty_tag ].delete( key );
        return parent;
    }
    else
    {
        parent = touchNode( parent );
        /* TODO: much re: caching */
        parent[        mem_cache_tag ].delete( key );
        parent[      local_cache_tag ].delete( key );
        parent[            links_tag ].delete( key );
        parent[            dirty_tag ].delete( key );
        parent[ blank_timestamps_tag ].delete( key );
        const link = parent[ links_tag ].get( key );
        parent[ to_delete_tag ].add( link );
        return parent;
    }
}

export function setChild( parent, key, child )
{
    assert( isTreeNode( parent ) );
    assert( isValidMapKey( key ) );
    assert( isTreeNode( child ) );

    parent = touchNode( parent );
    if( parent[ links_tag ].has( child_name )
        || isInMemCache( parent, key ) )
    {
        deleteChild( parent, key );
    }
    parent[ dirty_tag ].add( key );
    parent[ mem_cache_tag ].set( key, child );
    return parent;
}

export function newChild( parent, key, storage_cb )
{
    assert( isTreeNode( parent ) );
    assert( isValidMapKey( key ) );

    const dehydrated = T.map();
    dehydrated.set( "p", T.map() );
    dehydrated.set( "l", T.map() );
    const child = touchNode( rehydrate( parent, {}, dehydrated ) );
    // const pstorage = parent[ storage_tag ];
    return [ setChild( parent, key, child ), child ];
}

/* private */ async function writeSubtree( subroot, link )
{
    const [ subroot_clean, dirties, to_deletes ] = untouchNode( subroot );

    const storage = subroot_clean[ storage_tag ];
    /* reminder: this set of blanks should be accurate (i.e. not
     * include newly written children) */
    const all_delete = to_deletes.clone();
    const links = subroot_clean[ links_tag ];
    for( const key of dirties )
    {
        const [ child_clean, child_dehydrated, child_deletes ] =
              writeSubtree( getChild( subroot_clean, links.get( key ) ) );
        insertInMemCache( subroot_clean, key, child_clean );
        const child_link = await storage.upload( link, dehydrated, T.map() );
        links.set( key, child_link );
        UT.setUnionModify( all_delete, child_deletes );
    }
    for( const child_key of subroot_clean[ blank_timsetamps_tag ] )
    {
        links.get( child_key ).set( timestamp_tag, subroot_clean.timestamp );
    }
    
    const dehydrated = dehydrate( subroot_clean );
    return [ dehydrated, all_delete ];
 }

export async function writeTree( root )
{
    assert( isRoot( root ) );
    L.debug( "\u21b3 tree.writeTree", root[ path_tag ] );
    if( !( dirty_tag in root ) )
    {
        return root;
    }
    const [ dehydrated_root, to_delete ] = writeSubtree( root, {} );
    
    const storage = root[ storage_tag ];
    const storage_options = root[ storage_options_tag ].clone();
    if( root[ prev_root_tag ] === null )
    {
        storage_options.set( SC.COND_UPLOAD, SC.COND_NO_OVERWRITE );
    }
    else
    {
        storage_options.set( SC.COND_UPLOAD, SC.COND_ATOMIC );
    }
    // TODO: Local storage save
    const link = await storage.upload(
        { path: root[ path_tag ] }, dehydrated_root, storage_options );
//     if( !resp.ok )
//     {
//         throw new Error( "upload failed" );
//     }
//     delete root[ dirty_tag ];
}



export async function openRoot( path, storage, storage_options )
{
    var [ dehydrated_root, link ] = await storage.download( { path: path }, storage_options );

    const root = touchNode( rehydrate(
        { [storage_tag]: storage }, link, dehydrated_root ) );
    return root;
}

export function newRoot( path, storage, storage_options )
{
    const dehydrated = T.map();
    dehydrated.set( "p", T.map() );
    dehydrated.set( "l", T.map() );
    const root = touchNode( rehydrate(
        { [storage_tag]: storage }, {}, dehydrated ) );
    root[ path_tag ] = path;
    root[ storage_options_tag ] = storage_options;
    root[ prev_root_tag ] = null;
    // root[ tree_node_tag ]   = null;
    // root[ plain_data_tag ]  = ;
    // root[ mem_cache_tag ]   = T.map();
    // root[ local_cache_tag ] = { has: () => false };
    // root.toString = nodeToString;
    return root;
// //     const stores = {}
// //     root[ storage_tag ] = stores
// //     stores.plain = plain_storage_stack;
// //     stores.noOverwrite = plain_storage_stack.copy().pushDataBlobPhase( noOverwriteWrapper );
// //     stores.root        = plain_storage_stack.copy().pushDataBlobPhase( atomicUpdateWrapper );
// //     stores.node        = plain_storage_stack.copy().pushDataBlobPhase( randomNameWrapper );
// //     const file_path = {}
// //     const resp = storage.upload( path, { body: {} } )
}

/* public method */ function nodeToString()
{
    assert( isTreeNode( this ) );
    return "plain data: " + this[ plain_data_tag ].toString()
        + " children: " + this[ mem_cache_tag ].toString();
}
