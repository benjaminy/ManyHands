/* Top Matter */

import Path from "path";
import assert  from "../Source/Utilities/assert.mjs";
import * as K  from "../Source/Utilities/keyword.mjs";
import * as A from "../Source/Database/attribute.mjs";
import * as DT from "../Source/Database/transaction.mjs";
import * as DB from "../Source/Database/simple_txn_chain.mjs";
import * as DC from "../Source/Database/common.mjs";
import SM      from "../Source/Storage/in_memory.mjs";
import * as SW from "../Source/Storage/wrappers.mjs";

import {init_simple_dict} from "../Source/Database/Daniel/data_wrapper.mjs";

// // [ DT.addK, "bob", ":age", 42 ]

async function main() {
    return Promise.all([
        //test_01_instantiate(),
        //test_02_add_datom(),
        test_03_get_attribute()
    ]);
}

async function test_01_instantiate(){
    const raw_storage = SM( { path_prefix: [ "bob", "misc" ] } );
    const storage = SW.authedPrivateWrapper( {}, raw_storage );
    const db = DB.newDB( storage );
    console.log( db );
// //     ageAttr = DA.makeAttribute(
// //         ":age", DA.vtypeLong, DA.cardinalityOne,
// //         "doc doc doc" );
// //     likesAttr = DA.makeAttribute(
// //         ":likes", DA.vtypeLong, DA.cardinalityOne,
// //         "doc doc doc" );

// //     const ageAddStmt   = DA.makeAddTxnStmt( ageAttr );
// //     const likesAddStmt = DA.makeAddTxnStmt( likesAttr );
// //     //db.add
}

async function test_02_add_datom(){
    const raw_storage = init_simple_dict();

    const db = DB.newDB(raw_storage);

    const statement = [ DT.addK, "bob", ":age", 42 ];

    const res = await db.commitTxn(db, [statement]);

    console.log(res);
}

async function test_03_get_attribute(){
    const raw_storage = init_simple_dict();
    raw_storage.add({ // don't try this at home kids
        entity: 100,
        attribute: A.dbSymbolMap.get(A.identK),
        value: K.key(":likes")
    });
    raw_storage.add({
        entity: 100,
        attribute: A.dbSymbolMap.get(A.valueTypeK),
        value: A.dbSymbolMap.get(A.vtypeString)
    });
    raw_storage.add({
        entity: 100,
        attribute: A.dbSymbolMap.get(A.cardinalityK),
        value: A.dbSymbolMap.get(A.cardinalityMany)
    });
    raw_storage.add({
        entity: 100,
        attribute: A.dbSymbolMap.get(A.docK),
        value: "hor de door"
    });
    raw_storage.add({
        entity: 100,
        attribute: A.dbSymbolMap.get(A.uniqueK),
        value: null
    });
    raw_storage.add({
        entity: 100,
        attribute: A.dbSymbolMap.get(A.indexK),
        value: false
    });
    raw_storage.add({
        entity: 100,
        attribute: A.dbSymbolMap.get(A.fulltextK),
        value: false
    });
    raw_storage.add({
        entity: 100,
        attribute: A.dbSymbolMap.get(A.isComponentK),
        value: false
    });
    raw_storage.add({
        entity: 100,
        attribute: A.dbSymbolMap.get(A.noHistoryK),
        value: false
    });
    const db = DB.newDB(raw_storage);

    console.log(db.find());

    const statement = [ DT.addK, "bob", ":likes", 42 ];

    const res = await db.commitTxn(db, [statement]);
    
    assert(res && db.find({attribute: 100}).length === 1, "Attribute was not filled in correctly.");
}

main().then(() => {
    console.log("Reached end of t_transaction_01.mjs");
}, err => {
    console.error(err);
});
