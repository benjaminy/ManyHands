import * as ST from "../../Storage/tree.mjs";
import * as UM from "../../Utilities/misc.mjs";
import * as K from "../../Utilities/keyword.mjs";
import * as TREE from "./tree.mjs"

import T from "transit-js";

const WIDTH = 468;

const kIndex = T.keyword("index");
const kPointer = T.keyword("pointer");
const kLeaf = T.keyword("leaf");
// access at a pointer: 
// const access = T.map();
// access.set(kPointer, 10);
// ST.getChild(access); => child at 10th pointer

// anatomy of a node:
// d: datom for indexing
// c: child
// {kIndex => [d0, d1, d2],
//  {kPointer: 0} => c0,
//  {kPointer: 1} => c1,
//  {kPointer: 2} => c2,
//  {kPointer: 3} => c3.
//  kLeaf => false
// }
// TODO: pointers between siblings!

/**
 * root: the tree
 * is_match: function compare_match(value), checks if value is within
 * the search criteria. returns:
 *
 * kUnknown: no conclusion may be drawn from this comparison,
 * because the index does not match the criteria we passed.
 * To be safe, all lower datoms must be checked for compatibility.
 * This will not occur if you use an index the way it was designed.
 * 
 * kGreater, kLesser: The datom we passed in is "greater" or "lesser"
 * than the datom we are looking for.
 * In the case of greater, we should then search the left side, and
 * in the case of lesser, we should then search the right side.
 * 
 * kCompatible: The datom we're looking matches the index we compared
 * it again.
 *
 */
export async function query( root, compare_match )
{
    const running = [];
    const indices = ST.getValue( root, kIndex );
    if( root_value === undefined )
    {
        // current node, probably root,
        // does not have a value
        return [];
    }

    // walk in from the outsides, until you have bounds for the left and
    // right side

    let left_bound = null;
    let right_bound = null;

    for( let i = 0; i < indices.length; i++ ){
        const comp = compare_match( indices[ i ] );
        if( T.equals( comp, TREE.kGreater ) ){
            break; // we went too far!
        }
        if( T.equals( comp, TREE.kCompatible )
             || T.equals( comp, TREE.kUnknown ) ){
            left_bound = indices[ i ];
            break; // moving over any further is not useful
        }
        // else kLesser
        left_bound = idices[ i ];
        // this might be it, but we keep iterating just in case
        // there is a tighter left boundary.
    }

    // repeat for right side

    for( let i = indices.length; i >= 0; i-- ){
        const comp = compare_match( indices[ i ] );
        if( T.equals( comp, TREE.kLesser ) ){
            break; // we went too far!
        }
        if( T.equals( comp, TREE.kCompatible )
             || T.equals( comp, TREE.kUnknown ) ){
            right_bound = indices[ i ];
            break; // moving over any further is not useful
        }
        // else kGreater
        right_bound = idices[ i ];
        // this might be it, but we keep iterating just in case
        // there is a tighter right boundary.
    }

    // in the case the left or right bound are null, it means
    // the only child we need to check is the item on the left
    // or right edge (respectively).

    for( const idx of indices ){
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

