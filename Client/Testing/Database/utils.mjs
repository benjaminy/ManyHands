
/* Top Matter */

import assert from "../../Source/Utilities/assert.mjs";
import * as K from "../../Source/Utilities/keyword.mjs";
import * as A from "../../Source/Database/attribute.mjs";
import * as DT from "../../Source/Database/transaction.mjs";
import SM       from "../../Source/Storage/in_memory.mjs";
import * as SC from "../../Source/Storage/common.mjs";
import * as ST from "../../Source/Storage/tree.mjs";

import * as TW from "../../Source/Database/txn_tree_adaptor.mjs";
import * as Q from "../../Source/Database/query.mjs";
import * as DB from "../../Source/Database/simple_txn_chain.mjs";

import T from "transit-js";

function new_plain_root()
{
    const in_mem_storage = SM();
    const options = T.map();
    options.set( SC.PATH_PREFIX, [ "demo_app2" ] );
    options.set( SC.ENCODE_OBJ, SC.ENCODE_TRANSIT );
    const root = ST.newRoot( [ "root" ], in_mem_storage, options );
    return [root, () => { return ST.openRoot( [ "root" ], in_mem_storage, options ) }];
}

export async function setup(){
    const [root, retrieve_root] = new_plain_root();
    const name_insert = DT.getAttributeInserts(
        A.createAttribute(
            ":name",
            A.vtypeString,
            A.cardinalityOne,
            "A person's single, full name"
        )
    );
    const money_insert = DT.getAttributeInserts(
        A.createAttribute(
            ":money",
            A.vtypeLong,
            A.cardinalityOne,
            "A person's money amount"
        )
    );
    let db = DB.newDB( );
    db = await DB.commitTxn( db, [ ...name_insert, ...money_insert ] );

    ST.setChild( root, "the database", db.node );
    const r2 = await ST.writeTree( root );    
    const r3 = await retrieve_root();
    const retrieved_raw = await ST.getChild( r3, "the database" );
    const retrieved_db = DB.wrapDB( retrieved_raw );
    return [ retrieved_db, retrieve_root ];
}



