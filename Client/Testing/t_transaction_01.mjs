/* Top Matter */

import Path from "path";
import assert  from "../Source/Utilities/assert";
import * as K  from "../Source/Utilities/keyword";
import * as DA from "../Source/Database/attribute";
import * as DT from "../Source/Database/transaction";
import * as DB from "../Source/Database/simple_txn_chain";
import * as DC from "../Source/Database/common";
import SM      from "../Source/Storage/in_memory";
import * as SW from "../Source/Storage/wrappers";

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

main();

console.log( "Reached end of t_transaction_01.mjs" );
