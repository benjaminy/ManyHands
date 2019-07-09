import * as ST from "../../Storage/tree.mjs";
import * as UM from "../../Utilities/misc.mjs";
import * as K from "../../Utilities/keyword.mjs";
import T from "transit-js";

export const ENTITY = 0;
export const ATTRIBUTE = 1;
export const VALUE = 2;
export const TIMESTAMP = 3;
export const REVOKED = 4;

const kAVET = K.key("avet");
const kEAVT = K.key("eavt");
const kAEVT = K.key("aevt");
const kVAET = K.key("vaet");

const kLeftChild = K.key( "left_child" );
const kRightChild = K.key("right_child" );
const kValue = K.key( "value" );


export async function buildTree( data )
{
    const root = ST.newNode();

    const avet = await constructBinaryTree(data,
        ATTRIBUTE, VALUE, ENTITY, TIMESTAMP);
    const eavt = await constructBinaryTree(data,
        ENTITY, ATTRIBUTE, VALUE, TIMESTAMP);
    const aevt = await constructBinaryTree(data,
        ATTRIBUTE, ENTITY, VALUE, TIMESTAMP);
    const vaet = await constructBinaryTree(data,
        VALUE, ATTRIBUTE, ENTITY, TIMESTAMP);

    ST.setChild(root, kAVET, avet);
    ST.setChild(root, kEAVT, eavt);
    ST.setChild(root, kAEVT, aevt);
    ST.setChild(root, kVAET, vaet);
    return root;
}


const kCompatible = K.key("compatible");
const kGreater    = K.key("greater");
const kLesser     = K.key("lesser");
const kUnknown    = K.key("unknown");

export function wrapTree( root )
{
    const tree = {}; // "class" object

    tree.query = async function( query, cardinalityOne )
    {
        query = typeof( query ) === 'object' ? query : {};
        const { entity, attribute, value, timestamp, revoked } = query;
        const search = [ entity, attribute, value, timestamp, revoked ];
        let matcher;
        let db;
        if( entity === undefined
            && attribute === undefined
            && value === undefined )
        {
            // return all records
            matcher = () => kCompatible;
            // who cares which one
            db = await ST.getChild( root, kEAVT );
        }
        else if( entity === undefined
            && attribute === undefined
            && value !== undefined ){
            // VAET
            matcher = compare_match_wrapper( search, 
                VALUE, ATTRIBUTE, ENTITY, TIMESTAMP );
            db = await ST.getChild( root, kVAET );
        }
        else if( entity === undefined
            && attribute !== undefined
            && value === undefined )
        {
            // AVET or AEVT
            matcher = compare_match_wrapper( search, 
                ATTRIBUTE, ENTITY, VALUE, TIMESTAMP );
            db = await ST.getChild( root, kAVET );
        }
        else if( entity === undefined
            && attribute !== undefined
            && value !== undefined ){
            // AVET or VAET
            matcher = compare_match_wrapper( search, 
                ATTRIBUTE, VALUE, ENTITY, TIMESTAMP );
            db = await ST.getChild( root, kAVET );
        }
        else if( entity !== undefined )
        {
            // EAVT is the only index with an entity as the major sort
            matcher = compare_match_wrapper( search, 
                ENTITY, ATTRIBUTE, VALUE, TIMESTAMP );
            db = await ST.getChild( root, kEAVT );
        }
        // return await queryTree( db, matcher );
        const res = await queryTree( db, matcher );
        if( cardinalityOne === true && res.length > 1){
            const cardFiltered = T.map();
            for( let item of res ){
                const current = cardFiltered.get( item[ ENTITY ] );
                if( current === undefined ){
                    cardFiltered.set( item[ ENTITY ], item );
                } else {
                    if( item[ TIMESTAMP ] > current[ TIMESTAMP ] ){
                        cardFiltered.set( item[ ENTITY ], item );
                    }
                }
            }
            return [ ...cardFiltered.values() ];
        }
        return res;
    };

    tree.node = function()
    {
        return root;
    };

    tree.add = async function(...datoms)
    {
        return buildTree(
            [
                ...tree.query(), 
                ...datoms
            ]
        );
    };
    return tree;
}
/**
 * criterion is a datom-like object. for example,
 * [1, undefined, undefined, 3, undefined]
 * for entity 1 with timestamp 3
 *
 */
function compare_match_wrapper( criterion, ...sorts )
{
    function compare_match( item )
    {
        let compatible = true;
        for( let i = 0; i < criterion.length; i++ )
        {
            if( criterion[i] !== undefined )
            {
                compatible = compatible && T.equals(criterion[i], item[i]);
            }
        }
        if( compatible )
        {
            return kCompatible;
        }
        // they are incompatible-- determine which side
        // the item belongs on.
        for( const sort of sorts )
        {
            if( criterion[sort] === undefined )
            {
                return kUnknown;
            }
            if( T.equals( criterion[ sort ], item[ sort ] ) )
            {
                continue; // next field
            }
            let ix;
            if( typeof( criterion[ sort ] ) === 'number'
                && typeof( item[ sort ] ) === 'number')
            {
                ix = item[ sort ] - criterion[ sort ];
            } else {
                const s1 = criterion[ sort ].toString();
                const s2 = item[ sort ].toString();
                console.log("s1111", s1, criterion[ sort ], s2);
                ix = s1.localeCompare( s2 );
            }
            if( ix !== 0 )
            {
                if(ix > 0) return kGreater;
                return kLesser;
            }
            // continue
        }
    }
    return compare_match;
}


/**
 * root: the tree
 * is_match: function compare_match(value), checks if value is within
 * the search criteria. if yes, replies with 0, but otherwise,
 * returns -1 or 1 just like a compare(...) function
 *
 */
async function queryTree( root, compare_match )
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
    if( comp === kCompatible || comp === kGreater || comp === kUnknown )
    {
        try {
            const left_child = await ST.getChild( root, kLeftChild );
            running.push( ...( await queryTree( left_child, compare_match ) ) );
        } catch ( ex )
        {
            if(ex.type != "FileNotFoundError")
            {
                throw ex;
            }
        }
    }
    if( comp === kCompatible )
    {
        running.push( root_value );
    }
    if( comp === kCompatible || comp === kLesser || comp === kUnknown )
    {
        try {
            const right_child = await ST.getChild( root, kRightChild );
            running.push( ...( await queryTree( right_child, compare_match ) ) );
        } catch ( ex )
        {
            if(ex.type != "FileNotFoundError")
            {
                throw ex;
            }
        }
    }
    return running;
}

async function constructBinaryTree( data, ...sorts )
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
    const comp = compare( node, new_node, ...sorts );
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

/**
 * Compare two datoms across a set of fields, in order.
 * starting with sorts[0] and then continuing.
 * i.e. if sorts is [ENTITY, ATTRIBUTE, VALUE],
 * this will compare the entity first.
 *
 * @param o1
 * @param o2
 * @param sorts
 * @returns {number}
 */
function compare( node1, node2, ...sorts )
{
    const o1 = ST.getValue( node1, kValue );
    const o2 = ST.getValue( node2, kValue );
    for( let sort of sorts )
    {
        if( T.equals( o1[ sort ], o2[ sort ] ) )
        {
            continue; // next field
        }
        if( typeof( o1[ sort ] ) === 'number'
            && typeof( o2[ sort ] ) === 'number')
        {
            return o2[ sort ] - o1[ sort ];
            // if it is 0, it should have been
            // handled by T.equals
        }
        // TODO this is a bad catch-all
        if( o1[ sort ] === null )
        {
            return -1;
        }
        if( o2[ sort ] === null )
        {
            return 1;
        }
        const s1 = o1[ sort ].toString();
        const s2 = o2[ sort ].toString();
        let ix = s1.localeCompare( s2 );
        if( ix !== 0 )
        {
            return ix;
        } // else continue
    }
    return 0;
}

