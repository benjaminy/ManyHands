import * as ST from "../../Storage/tree.mjs";
import * as UM from "../../Utilities/misc.mjs";
import T from "transit-js";

export const ENTITY = 0;
export const ATTRIBUTE = 1;
export const VALUE = 2;
export const TIMESTAMP = 3;
export const REVOKED = 4;

const kAVET = T.keyword("avet");
const kEAVT = T.keyword("eavt");
const kAEVT = T.keyword("aevt");
const kVAET = T.keyword("vaet");

const kLeftChild = T.keyword( "left_child" );
const kRightChild = T.keyword("right_child" );
const kValue = T.keyword( "value" );


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

export function wrapTree( root )
{
    const tree = {}; // "class" object

    tree.query = async function( query )
    {
        query = typeof( query ) === 'object' ? query : {};
        const { entity, attribute, value } = query;

        if( entity === undefined
            && attribute === undefined
            && value === undefined )
        {
            // return all records
            throw new UM.UnimplementedError( "Query for all records" );
        }
        if( entity === undefined
            && attribute === undefined
            && value !== undefined ){
            // VAET
            return sortedSearch( vaet, VALUE, value );
        }
        if( entity === undefined
            && attribute !== undefined
            && value === undefined )
        {
            // AVET or AEVT
            return sortedSearch( aevt, ATTRIBUTE, attribute );
        }
        if( entity === undefined
            && attribute !== undefined
            && value !== undefined ){
            // AVET or VAET
            const vet = sortedSearch( avet, ATTRIBUTE, attribute );
            return sortedSearch( vet, VALUE, value );
        }
        if( entity !== undefined )
        {
            // EAVT is the only index with an entity in it
            const avt = sortedSearch( eavt, ENTITY, entity );
            if( attribute !== undefined )
            {
                const vt = sortedSearch( avt, ATTRIBUTE, attribute );
                if( value !== undefined )
                {
                    return sortedSearch( vt, VALUE, value );
                }
                return vt;
            }
            if( value !== undefined ){
                // TODO do we want an index for this particular case?
                return unsortedSearch( avt, VALUE, value );
            }
            return avt;
        }
    };

    tree.node = function()
    {
        return root;
    };
    return tree;
}

async function constructBinaryTree( data, ...sorts )
{
    let root = ST.newNode();
    if( data.length === 0 )
    {
        return root; /// ??? ok
    }
    ST.setValue(root, kValue, data[0]);
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

