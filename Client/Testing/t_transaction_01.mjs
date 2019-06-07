/* Top Matter */

import Path from "path";
import assert  from "../Source/Utilities/assert.mjs";
import * as K  from "../Source/Utilities/keyword.mjs";
import * as DA from "../Source/Database/attribute.mjs";
import * as DT from "../Source/Database/transaction.mjs";
import * as DB from "../Source/Database/simple_txn_chain.mjs";
import * as DC from "../Source/Database/common.mjs";
import SM      from "../Source/Storage/in_memory.mjs";
import * as SW from "../Source/Storage/wrappers.mjs";

// // [ DT.addK, "bob", ":age", 42 ]

async function main()
{
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

main().then(() => {

    console.log("Reached end of t_transaction_01.mjs");
}, err => {
    console.error(err);
});