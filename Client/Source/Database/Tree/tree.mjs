import * as ST from "../../Storage/tree.mjs";
import * as UM from "../../Utilities/misc.mjs";
import * as K from "../../Utilities/keyword.mjs";
import * as BIN from "./binary.mjs";
import assert from "../../Utilities/assert.mjs";
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

const STORAGE = BIN;

export async function buildTree( data=[], prev=null )
{
    const root = ST.newNode();

    let avet, eavt, aevt, vaet;

    if( prev === null )
    {
        avet = await STORAGE.construct( null, data,
            ATTRIBUTE, VALUE, ENTITY, TIMESTAMP);
        eavt = await STORAGE.construct( null, data,
            ENTITY, ATTRIBUTE, VALUE, TIMESTAMP);
        aevt = await STORAGE.construct( null, data,
            ATTRIBUTE, ENTITY, VALUE, TIMESTAMP);
        vaet = await STORAGE.construct( null, data,
            VALUE, ATTRIBUTE, ENTITY, TIMESTAMP);
    } else {
        const node = prev.node;
        avet = await STORAGE.construct(
            await ST.getChild( node, kAVET ),
            data,
            ATTRIBUTE, VALUE, ENTITY, TIMESTAMP );
        eavt = await STORAGE.construct(
            await ST.getChild( node, kEAVT ),
            data,
            ENTITY, ATTRIBUTE, VALUE, TIMESTAMP);
        aevt = await STORAGE.construct(
            await ST.getChild( node, kAEVT ),
            data,
            ATTRIBUTE, ENTITY, VALUE, TIMESTAMP);
        vaet = await STORAGE.construct(
            await ST.getChild( node, kVAET ),
            data,
            VALUE, ATTRIBUTE, ENTITY, TIMESTAMP);
    }

    ST.setChild(root, kAVET, avet);
    ST.setChild(root, kEAVT, eavt);
    ST.setChild(root, kAEVT, aevt);
    ST.setChild(root, kVAET, vaet);
    console.log( "i built root", root.toString() );
    return root;
}


export const kCompatible = K.key("compatible");
export const kGreater    = K.key("greater");
export const kLesser     = K.key("lesser");
export const kUnknown    = K.key("unknown");

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
            console.log("root is", root.toString());
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
            console.log("root i im I'n goona throw ups", root.toString());
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
        const res = await STORAGE.query( db, matcher );
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

    tree.node = root;

    tree.add = async function(...datoms)
    {
        const t_datoms = [];
        for (let i = 0; i < datoms.length; i++) {
            const datom = datoms[i];
            assert('entity' in datom
                && 'attribute' in datom
                && 'value' in datom);
            const t_datom = [
                datom["entity"],
                datom["attribute"],
                datom["value"],
                (new Date).getTime(),
                false
            ];
            t_datoms.push(t_datom);
        }
        return wrapTree(
            await buildTree(
                [ ...t_datoms ], tree
            )
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
export function compare( o1, o2, ...sorts )
{
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

