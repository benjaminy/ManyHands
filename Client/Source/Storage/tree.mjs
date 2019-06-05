/* Top Matter */

/*
 * File Comment
 */

import assert from "assert";
import * as UM from "../Utilities/misc";

const plain_data_tag = Symbol ...;
const mem_cache_tag = Symbol ...;
const links_tag = Symbol ...;

const tree_node_tag = Symbol ...;
const dirty_tag = Symbol ...;
const timestamp_tag = Symbol ...;
const storage_tag = Symbol ...;

const localPersistentDB = {};

/* stored node fields:
 * - p - plain data
 * - c - children
 * - b - set of children with blank timestamps
 * - ??? something about garbage??? */

/* is there any reason for nodes to "know" their own location? */

/* Should a node have a timestamp if it's dirty? */


/* Nodes are copy-on-first-write-since-last-tree-commit.
 * Make a mutable copy, if necessary. */
/* private */ function touchNode( node )
{
    if( !( dirty_tag in node ) )
    {
        node = Object.assign( {}, node );
        node[ dirty_tag ] = new Set();
    }
    return node;
}

/* public */ function isTreeNode( n )
{
    return tree_node_tag in node;
}


/* Begin plain old data part */

/* Nodes always have all their plain data values.  No laziness here. */

/* public */ function getValue( node, name )
{
    assert( isTreeNode( node ) );
    assert( UM.isString( name ) );

    return node[ plain_data_tag ][ name ];
}

/* WARNING: Must only be used read-only */
/* public */ function getValues( node )
{
    assert( isTreeNode( node ) );

    return node[ plain_data_tag ];
}

/* NOTE: Returns a new node because of copy-on-first-write */
/* public */ function setValue( node, name, value )
{
    assert( isTreeNode( node ) );
    assert( UM.isString( name ) );
    /* assert( isPlainData( value ) ); */

    node = touchNode( node );
    node[ plain_data_tag ][ name ] = value;
    return node;
}

/* NOTE: Returns a new node because of copy-on-first-write */
/* public */ function deleteValue( node, name )
{
    assert( isTreeNode( node ) );
    assert( UM.isString( name ) );

    node = touchNode( node );
    delete node[ plain_data_tag ][ name ]
    return node;
}

/* End plain old data part.  Begin tree children part */

/* public */ function isChildInMemCache( node, name )
{
    assert( isTreeNode( node ) );
    assert( UM.isString( name ) );

    return node[ mem_cache_tag ].has( name );
}

/* public */ function isChildInLocalCache( node, name )
{
    assert( isTreeNode( node ) );
    assert( UM.isString( name ) );

    return node[ local_cache_tag ].has( name );
}

/* private */ function dehydrate( node )
{
    d = {};
    d.p = node[ plain_data_tag ];
    d.b = node[ blank_timestamp_tag ];
    d.c = {}
    const links = node[ links_tag ];
    const storage = node[ storage ];
    for( name in links )
    {
        d.c[ name ] = storage.dehydrateLink( links[ name ] );
    }
    return d;
}

/* private */ function rehydrate( parent, link, dehydrated, storage_cb )
{
    const pstorage = parent[ storage_tag ];
    const cstorage = storage_cb ? storage_cb( pstorage ) : pstorage;
    const c = {};
    c[ tree_node_tag ]       = null;
    c[ plain_data_tag ]      = dehydrated.p;
    c[ blank_timestamp_tag ] = dehydrated.b;
    const links = {};
    for( name in dehydrated.c )
    {
        links[ name ] = cstorage.rehydrateLink(
            parent, name, dehydrated.c[ name ] );
    }
    c[ links_tag ]        = links;
    c[ mem_cache_tag ]   = { has: () => false };
    c[ local_cache_tag ] = { has: () => false };
    c[ storage_tag ]     = cstorage;

    if( "timestamp" in link )
    {
        c[ timestamp_tag ] = link.timestamp;
    }
    else
    {
        c[ timestamp_tag ] = parent[ timestamp_tag ];
    }

    return c;
}

/* public */ async function getChild( parent, child_name )
{
    assert( isTreeNode( parent ) );
    assert( isString( child_name ) );

    const mem_cache = parent[ mem_cache_tag ];
    if( mem_cache.has( child_name ) )
    {
        /* reminder: update cache timestamp */
        return mem_cache.get( child_name )
    }

    if( !( child_name in parent[ links_tag ] ) )
    {
        throw new Error( "No child in node with name: " + child_name );
    }

    const link = parent[ links_tag ][ child_name ];
    // necessary? exposed outside lib? ... assert( links_tag in link );

    const local_cache = parent[ local_cache_tag ];
    if( await local_cache_cache.has( link.path ) )
    {
        /* reminder: update cache timestamp */
        var dehydrated_child = await local_cache.get( link.path );
    }
    else
    {
        /* The Promise returned by download will reject, if network error */
        const resp = await parent[ storage_tag ].download( child_link );
        if( !resp.ok )
        {
            throw new Error( [ "Download failed", resp ] );
        }

        var dehydrated_child = await resp.transit();
        local_cache.insert( link, dehydrated_child );
    }

    const child = rehydrate( parent, dehydrated_child, link );
    mem_cache.insert( child_name, child );
    return child;
}

function addToSet( obj, field, item )
{
    if( !( field in obj ) )
    {
        obj[ field ] = new Set();
    }
    obj[ field ].add( item );
}

/* public */ function removeChild( parent, child_name )
{
    assert( isTreeNode( parent ) );
    assert( isString( child_name ) );

    if( !( ( child_name in parent[ links_tag ] ||
             parent[ mem_cache_tag ].has( child_name ) ) ) )
    {
        throw new Error( "No child with name " + child_name );
    }
    else if( !( child_name in parent[ links_tag ] ) )
    {
        /* mem cache kinda complicated ... */
        assert( dirty_tag in parent );
        parent[ mem_cache_tag ].delete( child_name );
        if( parent[ dirty_tag ].has( child_name ) )
        {
        }
        return parent;
    }
    else
    {
        parent = touchNode( parent );
        if( parent[ mem_cache_tag ].has( child_name ) )
        {
            parent[ mem_cache_tag ].delete( child_name );
        }
        if( parent[ local_cache_tag ].has( child_name ) )
        {
            parent[ local_cache_tag ].delete( child_name );
        }
        addToSet( parent, garbage_tag, parent[ links_tag ][ child_name ] );
        delete parent[ links_tag ][ child_name ];
        return parent;
    }
}

/* public */ function setChild( parent, child_name, child )
{
    assert( isTreeNode( parent ) );
    assert( isTreeNode( child ) );
    assert( isString( child_name ) );

    parent = touchNode( parent );
    if( parent[ links_tag ].has( child_name )
        || parent[ mem_cache_tag ].has( child_name ) )
    {
        parent = removeChild( parent, child_name );
    }
    parent[ dirty_tag ].add( child_name );
    parent[ mem_cache_tag ].set( child_name, child );
    return parent;
}

/* public */ function newChild( parent, child_name, storage_cb )
{
    assert( isTreeNode( parent ) );
    assert( isString( child_name ) );

    const child = rehydrate( parent, {}, {} );
    const pstorage = parent[ storage_tag ];
    const child = touchNode( {} );
    child[ plain_data_tag ] = {};
    child[ links_tag ] = {};
    return [ setChild( node, child_name, child, storage_options ), child ];
}

/* private */ async function writeNode( node )
{
    if( !( dirty_tag in node ) )
    {
        return node;
    }
    const old_blanks = node[ blank_timsetamps_tag ];
    const links = node[ links_tag ];
    for( const child_name in node[ dirty_tag ] )
    {
        const [ child_link, garbage_nodes ] =
              writeNode( getChild( node, child_name ) );
        blank_timestamps.delete( child_name );
    }
    for( const child_name in blank_timestamps )
    {
        links[ child_name ].timestamp = node.timestamp;
    }
    const new_node = object.assign( {}, node );
    const node_to_write = {};
    node_to_write.p = node[ plain_data_tag ];
    node_to_write.c = ;
    
}

async function writeTree( root )
{
    if( !( dirty_tag in root ) )
    {
        return;
    }
    const dirty_children = root[ dirty_tag ];
    const timetamps_to_update = root[ blank_timsetamps_tag ];
    for( child_name in dirty_children )
    {
        const child_fp = writeChild( root, child_name );
        root[ child_name ] = child_fp;
        timestamps_to_update.delete( child_name );
    }
    root[ blank_timsetamps_tag ] = dirty_children;
    for( child_name in timestamps_to_update )
    {
        root[ child_name ].timestamp = 
    }
    const root_ser = serialzeRoot( root );
    // TODO: Local storage save
    const resp = root.upload( "ROOT", root_ser );
    if( !resp.ok )
    {
        throw new Error( "upload failed" );
    }
    delete root[ dirty_tag ];
}



async function openRoot( storage, path )
{
}

// /* The plain storage stack should have at least a network phase and an object encoding phase. */
// async function newRoot( plain_storage_stack, path )
// {
//     const root = {};
//     const stores = {}
//     root[ storage_tag ] = stores
//     stores.plain = plain_storage_stack;
//     stores.noOverwrite = plain_storage_stack.copy().pushDataBlobPhase( noOverwriteWrapper );
//     stores.root        = plain_storage_stack.copy().pushDataBlobPhase( atomicUpdateWrapper );
//     stores.node        = plain_storage_stack.copy().pushDataBlobPhase( randomNameWrapper );
//     const file_path = {}
//     const resp = storage.upload( path, { body: {} } )
// }
