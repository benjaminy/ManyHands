import * as ST from "../../Storage/tree.mjs";
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

export default function init(storage, data)
{
    const parent = ST.newNode();

    const tree = {}; // "class"-ish object

    const avet = constructBinaryTree(data, kAVET,
        ATTRIBUTE, VALUE, ENTITY, TIMESTAMP);
    const eavt = constructBinaryTree(data, kEAVT,
        ENTITY, ATTRIBUTE, VALUE, TIMESTAMP);
    const aevt = constructBinaryTree(data, kAEVT,
        ATTRIBUTE, ENTITY, VALUE, TIMESTAMP);
    const vaet = constructBinaryTree(data, kVAET,
        VALUE, ATTRIBUTE, ENTITY, TIMESTAMP);

    tree.query = async function( query )
    {
        root = await ST.openRoot( "root", storage, options );
        const avet = ST.getValue( root, "avet" ),
            eavt = ST.getValue( root, "eavt" ),
            aevt = ST.getValue( root, "aevt" ),
            vaet = ST.getValue( root, "vaet" );

        const {entity, attribute, value} = typeof(query) === 'object' ? query : {};
        if(entity === undefined && attribute === undefined && value === undefined){
            // doesn't matter what we use
            return [...data];
        }
        if(entity === undefined && attribute === undefined && value !== undefined){
            // VAET
            return sortedSearch(vaet, VALUE, value);
        }
        if(entity === undefined && attribute !== undefined && value === undefined){
            // AVET or AEVT
            return sortedSearch(aevt, ATTRIBUTE, attribute);
        }
        if(entity === undefined && attribute !== undefined && value !== undefined){
            // AVET or VAET
            const vet = sortedSearch(avet, ATTRIBUTE, attribute);
            return sortedSearch(vet, VALUE, value);
        }
        if(entity !== undefined){
            // EAVT is the only index with an entity in it
            const avt = sortedSearch(eavt, ENTITY, entity);
            if(attribute !== undefined){
                const vt = sortedSearch(avt, ATTRIBUTE, attribute);
                if(value !== undefined){
                    return sortedSearch(vt, VALUE, value);
                }
                return vt;
            }
            if(value !== undefined){ // TODO do we want an index for this particular case?
                return unsortedSearch(avt, VALUE, value);
            }
            return avt;
        }
    };

    tree.node = function()
    {
        return parent;
    };
    return tree;
};


function constructBinaryTree( data, field, ...sorts ){
    let node = ST.newNode();
    for( const datom of data ){
        insertIntoNode( node, datom );
    }
}

const kLeftChild = T.keyword("left_child");
const kRightChild = T.keyword("right_child");


function insertIntoNode( node, datom ){
    if(ST.getValue("")node)
}

/**
 * TODO this could be nicer
 *
 * Compare two datoms across a set of fields
 *
 * @param o1
 * @param o2
 * @param sorts
 * @returns {number}
 */
function compare(o1, o2, ...sorts){
    for( let sort of sorts ){
        if( T.equals( o1[ sort ], o2[ sort ] ) ){
            continue;
        }
        if( typeof( o1[ sort ] ) === 'number'
            && typeof( o2[ sort] ) === 'number'){
            return o2[ sort ] - o1[ sort ];
            // if it is 0, it should have been handled by T.equals
        }
        let ix = o1[ sort ].toString().localeCompare( o2[ sort ].toString() );
        if( ix !== 0 ){
            return ix;
        } // else continue
    }
    return 0;
}