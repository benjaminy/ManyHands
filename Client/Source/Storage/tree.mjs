/* Top Matter */

/*
 * File Comment
 */

const in_mem_cache_tag = Symbol ...;
const dirty_tag = Symbol ...;
const timestamp_tag = Symbol ...;
const tree_node_tag = Symbol ...;
const cache_miss_err = {};
const localPersistentDB = {};

async function openRoot( storage, path )
{
}

async function cacheLookup( node, fieldName )
{
    /* is fieldName a child in node's in-mem cache? */
    const nodeCache = node[ in_mem_cache_tag ];
    if( fieldName in nodeCache )
    {
        return nodeCache[ fieldName ];
    }

    /* is node.fieldName a plain value? */
    const value = node[ fieldName ];
    if( !( file_path_tag in value ) )
    {
        return value;
    }

    /* is fieldName a child in node's local persistent cache? */
    if( value in localPersistentDB )
    {
        // XXX work out the details
        const child = rehydrate( localPersistentDB[ value ] );
        nodeCache[ fieldName ] = child;
        return child;
    }

    /* Nope.  Either an error or downloading from a server is required. */
    throw cache_miss_err;
}

async function getField( node, fieldName )
{
    try {
        return await cacheLookup( node, fieldName );
    }
    catch( err ) {
        if( !( err === cache_miss_err ) )
            throw err;
    }

    const child_path = node[ fieldName ];
    const resp = node.storage.download( childPath );
    if( !resp.ok )
    {
        throw new Error( "Download failed" );
    }

    const dehydrated_child = await resp.body();
    const child = rehydrate( dehydrated_child );

    if( "timestamp" in child_path )
    {
        child[ timestamp_tag ] = childPath.timestamp;
    }
    else
    {
        child[ timestamp_tag ] = node[ timestamp_tag ];
    }

    /* localPersistentDB[ child_path ] = dehydrated_child */
    node[ in_mem_cache_tag ][ field_name ] = child;
    return child;
}

function setField( node, fieldName, value )
{
    if( !( dirty_tag in node ) )
    {
        node = Object.assign( {}, node );
        node[ dirty_tag ] = new Set();
    }

    if( tree_node_tag in value )
    {
        node[ in_mem_cache_tag ][ fieldName ] = value;
        node[ dirty_tag ].add( fieldName );
    }
    else /* must be plain data */
    {
        node[ fieldName ] = value;
    }
    return node;
}

async function writeChild( node, child_name )
{
    if( !( dirty_tag in node ) )
    {
        return;
    }
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

/*
 * Timestamp stuff.  Still not 100% sure how all this should shake out
 */

export function timestampWrapper( options, storage )
{
    async function download( file_ptr, options_d )
    {
        if( !( "lacking_timestamps" in body ) )
        {
            return response;
        }
        for( fp_name in body.lacking_timestamps )
        {
            assert( fp_name in body );
            fp = body[ fp_name ];
            assert( !( "timestamp" in fp ) );
            fp.timestamp = ts;
        }
        delete body.lacking_timestamps;
        /* XXX where does body go?  How to mark dirty??? */
    }
}

/*
 * Tree stuff.  Still not 100% sure how all this should shake out
 */

export function treeWrapper( options, storage )
{
    async function download( parent, fp_name, options_d )
    {
        assert( fp_name in parent );
        const file_ptr = parent[ fp_name ];
    }
}

async function treeNodeGetChild( parent, name, idx )
{
    const is_array = !( idx === undefined );
    const local_cache_name = "uws_tree_child_" + name;
    if( local_cache_name in parent )
    {
        const temp = parent[ local_cache_name ];
        return is_array ? temp[ idx ] : temp;
        /* XXX lazy array!!! */
    }
    const child_ptr = is_array ? parent[ name ][ idx ] : parent[ name ];
    const storage = parent.uws_storage;
    const response = await storage.download( child_ptr );
    if( !response.ok )
    {
        throw new Error( "Download failed" );
    }
    if( !( "timestamp" in child_ptr ) )
    {
        assert( "uws_timestamp" in parent );
        child_ptr.timestamp = parent.uws_timestamp;

    }
    const child = await response.json();
    child.uws_parent = parent;
}

function treeNodeSetChild( parent, name, child, idx )
{
    child.uws_parent = parent
}

export function blahStorageTreeNode()
{
}
