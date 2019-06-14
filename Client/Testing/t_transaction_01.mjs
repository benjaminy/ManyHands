/* Top Matter */

import assert from "../Source/Utilities/assert.mjs";
import * as K from "../Source/Utilities/keyword.mjs";
import * as A from "../Source/Database/attribute.mjs";
import * as DT from "../Source/Database/transaction.mjs";

import {init_simple_dict} from "../Source/Database/Daniel/data_wrapper.mjs";
import * as Q from "../Source/Database/query.mjs";
import * as DB from "../Source/Database/simple_txn_chain.mjs";

// // [ DT.addK, "bob", ":age", 42 ]

async function main() {
    return Promise.all([
        //test_01_instantiate(),
        //test_02_add_datom(),
        test_03_get_attribute(),
        test_04_many_statements()
    ]);
}

/*
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

*/

async function setup(){
    const raw_storage = init_simple_dict();
    // :likes
    raw_storage.add({ // don't try this at home kids
        entity: 100,
        attribute: A.dbSymbolMap.get(A.identK),
        value: K.key(":likes")
    });
    raw_storage.add({
        entity: 100,
        attribute: A.dbSymbolMap.get(A.valueTypeK),
        value: A.dbSymbolMap.get(A.vtypeRef)
    });
    raw_storage.add({
        entity: 100,
        attribute: A.dbSymbolMap.get(A.cardinalityK),
        value: A.dbSymbolMap.get(A.cardinalityMany)
    });
    raw_storage.add({
        entity: 100,
        attribute: A.dbSymbolMap.get(A.docK),
        value: "Contains references to other entities this entity likes."
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
    // :name
    raw_storage.add({
        entity: 101,
        attribute: A.dbSymbolMap.get(A.identK),
        value: K.key(":name")
    });
    raw_storage.add({
        entity: 101,
        attribute: A.dbSymbolMap.get(A.valueTypeK),
        value: A.dbSymbolMap.get(A.vtypeString)
    });
    raw_storage.add({
        entity: 101,
        attribute: A.dbSymbolMap.get(A.cardinalityK),
        value: A.dbSymbolMap.get(A.cardinalityOne)
    });
    raw_storage.add({
        entity: 101,
        attribute: A.dbSymbolMap.get(A.docK),
        value: "A person's single, full name"
    });
    raw_storage.add({
        entity: 101,
        attribute: A.dbSymbolMap.get(A.uniqueK),
        value: null
    });
    raw_storage.add({
        entity: 101,
        attribute: A.dbSymbolMap.get(A.indexK),
        value: false
    });
    raw_storage.add({
        entity: 101,
        attribute: A.dbSymbolMap.get(A.fulltextK),
        value: false
    });
    raw_storage.add({
        entity: 101,
        attribute: A.dbSymbolMap.get(A.isComponentK),
        value: false
    });
    raw_storage.add({
        entity: 101,
        attribute: A.dbSymbolMap.get(A.noHistoryK),
        value: false
    });
    return DB.newDB(raw_storage);
}

async function test_03_get_attribute(){
    const db = await setup();
    const statement = [ DT.addK, "bob", K.key(":name"), "Bobethy" ];
    const res = await db.commitTxn(db, [statement]);
    assert(res && db.find({attribute: 101}).length === 1, "Attribute was not filled in correctly.");
}

async function test_04_many_statements(){
    const db = await setup();
    const likes = K.key(":likes");
    const name = K.key(":name");
    const statements = [
        [ DT.addK, "mary", name, "Marticia"],
        [ DT.addK, "susan", name, "Suzard"],
        [ DT.addK, "mary", likes, "susan" ] ];
    const res = await db.commitTxn(db, statements);
    const checkQuery = Q.parseQuery(
        [Q.findK, "?a", "?name",
            Q.whereK, ["?a", likes, "?b"],
            ["?a", name, "?name"],
            ["?b", name, "Suzard"]]
    );

    const r = await Q.runQuery(db, checkQuery);

    assert(r.length === 1, `Query failed to retrieve a record (found: ${r}).`);
    assert(r[0][1] === "Marticia", "Query returned invalid or incorrect result.");
}

main().then(() => {
    console.log("Reached end of t_transaction_01.mjs");
}, err => {
    console.error(err);
});
