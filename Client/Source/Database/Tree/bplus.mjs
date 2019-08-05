import * as ST from "../../Storage/tree.mjs";
import * as UM from "../../Utilities/misc.mjs";
import * as K from "../../Utilities/keyword.mjs";
import assert from "../../Utilities/assert.mjs";
import * as TREE from "./tree.mjs"

import T from "transit-js";

const WIDTH = 4; // 468;

const kIndex = T.keyword( "index" );
const kPointer = T.keyword( "pointer" );
const kLeaf = T.keyword( "leaf" );
const kDatoms = T.keyword( "datoms" );
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
// OR
// {kLeaf => true,
//  kDatoms => [d0, d1, d2, ...]   
// }
// TODO: pointers between siblings!



async function queryLeaf( root, compare_match )
{
    const results = [];
    const datoms = ST.getValue( root, kDatoms );
    // TODO UM.binarySearch( datoms, compare_match );
    // or some other efficiency on top of this
    for( let i = 0; i < datoms.length; i++ )
    {
        if( compare_match( datoms[ i ] ) === TREE.kCompatible )
        {
            results.push( datoms[ i ] );
        }
    }
    return results;
}

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
    if( ST.getValue( root, kLeaf ) )
    {
        return queryLeaf( root, compare_match );
    }
    const indices = ST.getValue( root, kIndex );
    if( indices.length === 0 )
    {
        // the node we're looking at
        // does not contain any interesting
        // children.
        return [];
    }

    // walk in from the outsides, until you have 
    // bounds for the left and right side

    let left_bound = -1;
    let right_bound = indices.length;

    for( let i = 0; i < indices.length; i++ ){
        const comp = compare_match( indices[ i ] );
        if( T.equals( comp, TREE.kGreater ) ){
            break; // we went too far!
        }
        if( T.equals( comp, TREE.kCompatible )
             || T.equals( comp, TREE.kUnknown ) ){
            left_bound = i;
            break; // moving over any further is not useful
        }
        // else kLesser
        left_bound = i;
        // this might be it, but we keep iterating just in case
        // there is a tighter left boundary.
    }

    // repeat for right side

    for( let i = indices.length - 1; i >= 0; i-- ){
        const comp = compare_match( indices[ i ] );
        if( T.equals( comp, TREE.kLesser ) ){
            break; // we went too far!
        }
        if( T.equals( comp, TREE.kCompatible )
             || T.equals( comp, TREE.kUnknown ) ){
            right_bound = i;
            break; // moving over any further is not useful
        }
        // else kGreater
        right_bound = i;
        // this might be it, but we keep iterating just in case
        // there is a tighter right boundary.
    }

    // in the case the left or right bound are null, it means
    // the only child we need to check is the item on the left
    // or right edge (respectively).

    const running = [];
    for( let i = left_bound; i < right_bound; i++ )
    {
        const fetch = T.map();
        fetch.set( kPointer, lastIdx + 1 );
        // TODO parallelization could be
        // really nice here (to utilize the time
        // it takes to download a file for something
        // useful)
        const look = await ST.getChild( root, fetch );
        running.push( await query( look, compare_match ) );
    }
    return running;
}

export async function construct( root, data, ...sorts )
{
    if( root === null )
    {
        let root = ST.newNode();
        root = ST.setValue( root, kIndex, [] );
        root = ST.setValue( root, kLeaf, true );

        if( data.length === 0 )
        {
            return root; // ??? ok
        }
    }
    for( let datom of data )
    {
        const nodes = await insertIntoNode( root, datom, sorts ); 
        console.log("NODESSSS", nodes);
        assert( nodes.length > 0 );
        if( nodes.length === 1 )
        {
            root = nodes[ 0 ];
        }
        else
        {
            // deal with the case where
            // our root has split
            root = ST.newNode();
            root = ST.setValue( root, kLeaf, false );
            let [left, right] = nodes;
            const indices = [ await getMinimum( right ) ];
            ST.setValue( root, kIndex, indices );
            const zeroth = T.map();
            zeroth.set( kPointer, 0 );
            ST.setChild( root, zeroth, left );
            const first = T.map();
            first.set( kPointer, 1 );
            ST.setChild( root, first, right );
        }
    }
    return root;
}

async function getMinimum( node )
{
    const leaf = ST.getValue( node, kLeaf );
    if( leaf )
    {
        const vals = ST.getValue( node, kDatoms );
        return vals[ 0 ];
    }
    else
    {
        let ident = T.map();
        ident.set( kPointer, 0 );
        const child = await ST.getChild( node, ident );
        return getMinimum( child );
    }
}

async function insertIntoLeaf( node, datom, sorts )
{
    console.log( "PRINTING LEAF" );
    let datoms = ST.getValue( node, kDatoms );
    if( datoms === undefined )
    {
        datoms = [];
    }
    console.log( "DATOMS:", datoms );
    let idx;
    for( idx = 0; idx < datoms.length; idx++ )
    {
        const comp = TREE.compare( datoms[ idx ], datom, ...sorts );
        if( comp === 0 ){
            return [ node ]; // we don't have anything
            // to do if we're inserting a duplicate
            // node (duplicate even in timestamp
            // and revoked status)
        } else if( comp > 0 ){
            continue; // keep going
        } else { // comp < 0
            // we passed what we were looking for
            idx--;
            break;
        }
    }
    const newDatoms = [...datoms.slice( 0, idx ), datom, ...datoms.slice( idx )];
    if( newDatoms.length >= WIDTH )
    {
        // time to split!
        let left = ST.newNode();
        left = ST.setValue( left, kLeaf, true );
        let right = ST.newNode();
        right = ST.setValue( right, kLeaf, true );
        const half = Math.floor( newDatoms.length / 2 );
        left = ST.setValue(
            left, kDatoms, newDatoms.slice( 0, half )
        );
        right = ST.setValue(
            right, kDatoms, newDatoms.slice( half )
        );
        return [ left, right ];
    }
    return [ ST.setValue( node, kDatoms, newDatoms ) ];
}


async function insertIntoNode( node, datom, sorts )
{
    // if it is a leaf
    let leaf = ST.getValue( node, kLeaf );
    if( leaf ){
        return insertIntoLeaf( node, datom, sorts );
        // returns a promise
    }
    console.log("PRINTING NODE (NOT A LEAF)");
    console.log("INDICES:", ST.getValue( node, kIndex ));
    console.log("ALL THE CHILDREN:");
    for( let i = 0; true; i++ ){
        let ident = T.map();
        ident.set( kPointer, i );
        try
        {
            const child = await ST.getChild( node, ident );
            console.log( child );
        }
        catch(ex)
        {
            break;
        }
    }
    // the saved indices of the node
    const indices = ST.getValue( node, kIndex );
    let idx = 0; // init outside for scope
    for( ; idx < indices.length; idx++ )
    {
        // locate an appropriate position
        // for the datom we're inserting
        const curIdx = indices[ idx ];
        console.log("asdFSDAFA", curIdx, datom);
        const comp = TREE.compare( curIdx, datom, ...sorts );
        if( comp === 0 ){
            return [ node ]; // we don't have anything
            // to do if we're inserting a duplicate
            // node (duplicate even in timestamp
            // and revoked status)
        } else if( comp > 0 ){
            continue; // keep going
        } else { // comp < 0
            // we passed what we were looking for
            idx--;
            break;
        }
    }
    let pop;
    let ident = T.map();
    ident.set( kPointer, idx );
    const insert = await ST.getChild( node, ident );
    const nodes = await insertIntoNode( insert, datom, sorts );
    if( nodes.length === 1 )
    {
        ST.setChild( node, ident, nodes[ 0 ] );
        return [ node ];
    }
    else
    {
        console.log("consolidate nodes", nodes);
        throw new Error("unimplmented splitting (not root)");
        // the node split-- update the indices and
        // make more room in the parent. If we return
        // two nodes from this function, it means
        // OUR parent also needs to deal with our splitting,
        // and this may propagate all the way up to the root.
    }
    // TODO dead code???
    const new_indices = indices.splice( 0, idx );
    for( ; idx < indices.length; idx++ )
    {
        let ident = T.map();
        ident.set( kPointer, idx );
        // TODO value/child changes based on leaf status
        let pop2 = ST.getValue( node, ident );
        // try {
        //     let pop2 = ST.getValue( node, ident );
        // }
        // catch( ex )
        // {
        //     if( ex.type !== "FileNotFoundError" )
        //     {
        //         throw ex;
        //     }
        //     assert( idx === ( indices.length - 1 ) );
        // }
        new_indices.push( /* node's largest child? or smallest child? */ );
        ST.setValue( node, ident, pop );
        pop = pop2;
        // all of these items need to be shifted over
        // so that we may insert the new item where
        // it belongs.
    }
    
    // we inserted fine-- but now check if the node is full, and split if necessary
    if( indices.length >= WIDTH )
    {
        const half = Math.floor( WIDTH / 2 );
        let left = ST.newNode();
        left = ST.setValue(
            left,
            kIndex,
            indices.slice( 0, half )
        );
        for( let i = 0; i < half; i++ )
        {
            const ident = T.map();
            ident.set( kPointer, i );
            left = ST.setValue(
                left, 
                ident, 
                await ST.getChild( node, ident )
            );
        }
        let right = ST.newNode();
        right = ST.setValue(
            right,
            kIndex,
            indices.slice( half )
        );
        for( let i = half; i < indices.length; i++ )
        {
            const initial_ident = T.map();
            initial_ident.set( kPointer, i);
            const right_ident = T.map();
            right_ident.set( kPointer, i - half );
            right = ST.setValue(
                right,
                right_ident,
                await ST.getChild( node, initial_ident )
            );
        }
        return [ left, right ];
    }
    return [ node ];
}
//    const comp = TREE.compare( node, new_node, ...sorts );
//    let left_child
//    if( comp < 0 )
//    {
//        try {
//            left_child = await ST.getChild( node, kLeftChild );
//            await insertIntoNode( left_child, new_node, sorts );
//            return;
//        }
//        catch( err )
//        {
//            if( err.type === "FileNotFoundError" )
//            {
//                ST.setChild( node, kLeftChild, new_node );
//                return;
//            }
//            throw err;
//        }
//    } // else, right side
//    let right_child;
//    try {
//        right_child = await ST.getChild( node, kRightChild );
//        await insertIntoNode( right_child, new_node, sorts );
//        return;
//    }
//    catch( err )
//    {
//        if( err.type === "FileNotFoundError" )
//        {
//            ST.setChild( node, kRightChild, new_node );
//            return;
//        }
//        throw err;
//    }


