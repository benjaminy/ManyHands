import * as ST from "../../Storage/tree.mjs";
import * as UM from "../../Utilities/misc.mjs";
import * as K from "../../Utilities/keyword.mjs";
import * as TREE from "./tree.mjs"

import T from "transit-js";

const kLeftChild = K.key( "left_child" );
const kRightChild = K.key("right_child" );
const kValue = K.key( "value" );

/**
 * root: the tree
 * is_match: function compare_match(value), checks if value is within
 * the search criteria. if yes, replies with 0, but otherwise,
 * returns -1 or 1 just like a compare(...) function
 *
 */
export async function query( root, compare_match )
{
    const running = [];
    const root_value = ST.getValue( root, kValue );
    if( root_value === undefined )
    {
        // current node, probably root,
        // does not have a value
        return [];
    }
    const comp = compare_match( root_value );
    if( T.equals(comp, TREE.kCompatible) || T.equals(comp, TREE.kGreater) || T.equals(comp, TREE.kUnknown) )
    {
        try {
            const left_child = await ST.getChild( root, kLeftChild );
            running.push( ...( await query( left_child, compare_match ) ) );
        } catch ( ex )
        {
            if(ex.type !== "FileNotFoundError")
            {
                throw ex;
            }
        }
    }
    if( comp === TREE.kCompatible )
    {
        running.push( root_value );
    }
    if( comp === TREE.kCompatible || comp === TREE.kLesser || comp === TREE.kUnknown )
    {
        try {
            const right_child = await ST.getChild( root, kRightChild );
            running.push( ...( await query( right_child, compare_match ) ) );
        } catch ( ex )
        {
            if(ex.type !== "FileNotFoundError")
            {
                throw ex;
            }
        }
    }
    return running;
}

export async function construct( data, ...sorts )
{
    let root = ST.newNode();
    if( data.length === 0 )
    {
        return root; /// ??? ok
    }
    root = ST.setValue(root, kValue, data[0]);
    for( let i = 1; i < data.length; i++ )
    {
        const new_node = ST.newNode();
        ST.setValue( new_node, kValue, data[i] );
        await insertIntoNode( root, new_node, sorts );
    }
    return root;
}

async function insertIntoNode( node, new_node, sorts )
{
    const comp = TREE.compare( node, new_node, ...sorts );
    let left_child;
    if( comp < 0 )
    {
        try {
            left_child = await ST.getChild( node, kLeftChild );
            await insertIntoNode( left_child, new_node, sorts );
            return;
        }
        catch( err )
        {
            if( err.type === "FileNotFoundError" )
            {
                ST.setChild( node, kLeftChild, new_node );
                return;
            }
            throw err;
        }
    } // else, right side
    let right_child;
    try {
        right_child = await ST.getChild( node, kRightChild );
        await insertIntoNode( right_child, new_node, sorts );
        return;
    }
    catch( err )
    {
        if( err.type === "FileNotFoundError" )
        {
            ST.setChild( node, kRightChild, new_node );
            return;
        }
        throw err;
    }
}

