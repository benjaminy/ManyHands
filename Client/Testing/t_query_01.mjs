/* Top Matter */

import assert  from "../Source/Utilities/assert";
import * as UM from "../Source/Utilities/misc";
import * as K  from "../Source/Utilities/keyword";
import * as Q  from "../Source/Database/query";
import {init_simple_dict} from "../Source/Database/Daniel/data_wrapper.mjs"

const age   = K.key( ":age" );
const likes = K.key( ":likes" );
const annoys = K.key(":annoys");
const loves = K.key(":loves");
const sally = 12345;
const fred  = 12346;
const ethel = 12347;

const db = init_simple_dict();

db.add({
    entity: sally,
    attribute: age,
    value: 21
});
db.add({
    entity: fred,
    attribute: age,
    value: 42
});
db.add({
    entity: ethel,
    attribute: age,
    value: 42
});
db.add({
    entity: fred,
    attribute: likes,
    value: "pizza"
});
db.add({
    entity: sally,
    attribute: likes,
    value: "opera"
});
db.add({
    entity: ethel,
    attribute: likes,
    value: "sushi"
});
db.add({
    entity: fred,
    attribute: annoys,
    value: ethel
});
db.add({
    entity: ethel,
    attribute: loves,
    value: sally
});

async function main(){
    return Promise.all([
        /*test_01_single_select(),
        test_02_double_select(),
        test_03_double_where(),
        //test_04_double_condition(),
        test_05_references(),
        test_06_double_reference(),
        test_07_many_hops(),
        test_08_fanout(),
        test_09_fanout_many(),*/
        simpler_fanout(),
        //visualization()
    ]);
}

async function simpler_fanout(){
    const aKey = K.key(":a");
    const bKey = K.key(":b");
    const cKey = K.key(":c");
    const dKey = K.key(":d");

    const db = init_simple_dict();

    db.add({
        entity: "A",
        attribute: aKey,
        value: "B1"
    });
    db.add({
        entity: "A",
        attribute: aKey,
        value: "B2"
    });
    db.add({
        entity: "B1",
        attribute: bKey,
        value: "C11"
    });
    db.add({
        entity: "B1",
        attribute: bKey,
        value: "C12"
    });
    db.add({
        entity: "B2",
        attribute: bKey,
        value: "C21"
    });
    db.add({
        entity: "B2",
        attribute: bKey,
        value: "C22"
    });
    db.add({
        entity: "C11",
        attribute: cKey,
        value: "D111"
    });
    db.add({
        entity: "C22",
        attribute: cKey,
        value: "D222"
    });
    db.add({
        entity: "C22",
        attribute: cKey,
        value: "D221"
    });

    db.add({
        entity: "D222",
        attribute: dKey,
        value: "E2222"
    });

    db.add({
        entity: "D111",
        attribute: dKey,
        value: "E1111"
    });

    db.add({
        entity: "D222",
        attribute: dKey,
        value: "E2221"
    });

    const q = Q.parseQuery(
        [Q.findK, "?a", "?b", "?c", "?d", "?e",
            Q.whereK, ["?a", aKey, "?b"],
            ["?b", bKey, "?c"],
            ["?c", cKey, "?d"],
            ["?d", dKey, "?e"]]
    );

    const r = await Q.runQuery(db, q);

    console.log(r);

}

async function visualization(){

    const aKey = K.key(":a");
    const bKey = K.key(":b");

    const db = init_simple_dict();

    db.add({
        entity: "A",
        attribute: aKey,
        value: "B"
    });

    db.add({
        entity: "B",
        attribute: bKey,
        value: "C1"
    });
    db.add({
        entity: "B",
        attribute: bKey,
        value: "C2"
    });

    const q = Q.parseQuery(
        [Q.findK, "?a", "?b", "?c",
            Q.whereK, ["?a", aKey, "?b"],
            ["?b", bKey, "?c"]]
    );

    const r = await Q.runQuery(db, q);

    console.log(r);

    assert(r.length === 2 && r[0].length === 3 && r[1].length === 3,
        "Result set has incorrect length (expecting 2x3, found ${r.length}x${r[0].length})");
    assert(r[0][0] === "A" && r[0][1] === "B" && r[1][0] === "A" && r[1][1] === "B"
    && r[0][2] !== r[1][2] && ((r[0][2] === "C2" || r[1][2] === "C2") && (r[0][2] === "C1" || r[1][2] === "C1")),
        "Data is malformatted.");

    // Expected: [ [ 'A', 'B', 'C2' ], [ 'A', 'B', 'C1' ] ]

}


async function test_01_single_select()
{

    const q1 = Q.parseQuery( // Find all the entities whose age is 42
        [ Q.findK, "?e",
            Q.whereK, [ "?e", age, 42 ] ] );
    const r1 = await Q.runQuery( db, q1 );

    console.log( "FINI?", JSON.stringify( r1 ) );
    assert(r1.length === 2, "Two results should be returned from this query. Found: " + r1.length);
    assert((ethel === r1[0][0] || ethel === r1[1][0])
        && (fred === r1[0][0] || fred === r1[1][0])
        && r1[0][0] !== r1[1][0]);

    console.log("SUCCESS: test_01_single_select");

}

async function test_02_double_select()
{

    const q2 = Q.parseQuery( // Give me each entity and what they like
        [ Q.findK, "?e", "?age",
            Q.whereK, [ "?e", age, "?age" ] ] );

    const r2 = await Q.runQuery( db, q2 );

    console.log( "3x2 array?", JSON.stringify(r2));
    assert(r2.length === 3, "Three results should be returned from this query. Found: " + r2.length);

    console.log("SUCCESS: test_02_double_select");
}

async function test_03_double_where()
{
    const q3 = Q.parseQuery( // give me pairings of age and likes
        [ Q.findK, "?a", "?l",
            Q.whereK, ["?e", age, "?a"], ["?e", likes, "?l"]]
    );

    const r3 = await Q.runQuery( db, q3 );

    console.log("Ages and likes paired?", JSON.stringify(r3));
    const [[a1, l1], [a2, l2], [a3, l3]] = r3.sort((s, o) => s[1].charCodeAt(0) - o[1].charCodeAt(0));
    assert(
        a1 === 21
        && l1 === "opera"
        && a2 === 42
        && l2 === "pizza"
        && a3 === 42
        && l3 === "sushi"
    );
    console.log("SUCCESS: test_03_double_where");
}

/*
TODO: I am unsure how to use these :in parameters, or if that is unsupported so far
 */
async function test_04_double_condition()
{
    const q4 = Q.parseQuery( // who is 42 and likes pizza? (:in parameters)
        [Q.findK, "?e",
            Q.inK, "$", "?age", "?pizza",
            Q.whereK, ["?e", age, "?age"], ["?e", likes, "?pizza"]]
    );

    const r4 = await Q.runQuery( db, q4, 42, "pizza" );

    console.log("r4:", r4);

    assert(r4.length === 1 && r4[0][0] === fred);

    console.log("SUCCESS: test_04_double_condition");

}

async function test_05_references()
{
    const q5 = Q.parseQuery( // what is the age of people who are annoyed?
        [Q.findK, "?age",
        Q.whereK, ["?a", annoys, "?e"], ["?e", age, "?age"]] // TODO underbar for ?a
    );

    const r5 = await Q.runQuery(db, q5);

    console.log("r5", r5);

    assert(r5.length === 1 && r5[0][0] === 42);

    console.log("SUCCESS: test_05_references");

}

async function test_06_double_reference(){
    const q6 = Q.parseQuery( // who is associated with the annoyed lover?
        [Q.findK, "?annoyer", "?loved",
        Q.whereK, ["?annoyer", annoys, "?e"], ["?e", loves, "?loved"]]
    );

    const r6 = await Q.runQuery(db, q6);
    console.log("r6", r6);

    assert(r6.length === 1 && r6[0][0] === fred && r6[0][1] === sally);

    console.log("SUCCESS: test_06_double_reference");

}

async function test_07_many_hops(){

    const assoc1 = K.key(":a1");
    const assoc2 = K.key(":a2");
    const assoc3 = K.key(":a3");
    const assoc4 = K.key(":a4");
    const assoc5 = K.key(":a5");

    const db7 = init_simple_dict();

    db7.add({
        entity: 1,
        attribute: assoc1,
        value: 2
    });

    db7.add({
        entity: 2,
        attribute: assoc2,
        value: 3
    });

    db7.add({
        entity: 3,
        attribute: assoc3,
        value: 4
    });

    db7.add({
        entity: 5,
        attribute: assoc4,
        value: 4
    });

    db7.add({
        entity: 5,
        attribute: assoc5,
        value: 6
    });

    db7.add({
        entity: 11,
        attribute: assoc1,
        value: 22
    });

    db7.add({
        entity: 22,
        attribute: assoc2,
        value: 33
    });

    db7.add({
        entity: 33,
        attribute: assoc3,
        value: 44
    });

    db7.add({
        entity: 55,
        attribute: assoc4,
        value: 44
    });

    db7.add({
        entity: 55,
        attribute: assoc5,
        value: 66
    });

    /*db7.add({
        entity: 55,
        attribute: assoc5,
        value: 666
    });*/

    const q7 = Q.parseQuery(
        [Q.findK, "?one", "?two", "?three", "?four", "?five", "?six",
        Q.whereK, ["?one", assoc1, "?two"],
        ["?two", assoc2, "?three"],
        ["?three", assoc3, "?four"],
        ["?five", assoc4, "?four"],
        ["?five", assoc5, "?six"]]
    );

    const r7 = await Q.runQuery(db7, q7);

    console.log("r7:", r7);

    let i = 1;
    assert(r7.length === 2 && r7[0].length === 6, `Result set has incorrect length (expecting 2x6, found ${r7.length}x${r7[0].length})`);
    r7[0].forEach((e) => {
        assert(e === i++, `Result set is malformatted or incorrect (expected ${i-1}, found ${e})`);
        // r7 === [[1, 2, 3, 4, 5, 6]]
    });
    i = 1;
    r7[1].forEach((e) => {
        assert(e === (i++ * 11), `Result set is malformatted or incorrect (expected ${(i-1)*11}, found ${e})`);
    });
}

async function test_08_fanout(){

    const assoc1 = K.key(":a1");
    const assoc2 = K.key(":a2");
    const assoc3 = K.key(":a3");

    const db8 = init_simple_dict();

    db8.add({
        entity: 1,
        attribute: assoc1,
        value: 2
    });

    db8.add({
        entity: 2,
        attribute: assoc2,
        value: 3
    });

    db8.add({
        entity: 3,
        attribute: assoc3,
        value: 4
    });

    // TEMPORARY

    db8.add({
        entity: 3,
        attribute: assoc3,
        value: 44
    });

    const q8 = Q.parseQuery(
        [Q.findK, "?one", "?two", "?three", "?four",
            Q.whereK, ["?one", assoc1, "?two"],
            ["?two", assoc2, "?three"],
            ["?three", assoc3, "?four"]]
    );

    const r8 = await Q.runQuery(db8, q8);

    console.log("r8", r8);

    assert(r8.length === 2, `The length of the result set must be 2 (found: ${r8.length})`);
}


async function test_09_fanout_many(){

    const assoc1 = K.key(":a1");
    const assoc2 = K.key(":a2");
    const assoc3 = K.key(":a3");

    const db9 = init_simple_dict();

    db9.add({
        entity: 1,
        attribute: assoc1,
        value: 2
    });

    /*db9.add({
        entity: 1,
        attribute: assoc1,
        value: 22
    });*/

    db9.add({
        entity: 2,
        attribute: assoc2,
        value: 3
    });

    db9.add({
        entity: 3,
        attribute: assoc3,
        value: 4
    });

    // TEMPORARY

    db9.add({
        entity: 3,
        attribute: assoc3,
        value: 44
    });

    db9.add({
        entity: 22,
        attribute: assoc2,
        value: 33
    });

    db9.add({
        entity: 33,
        attribute: assoc3,
        value: 44
    });

    db9.add({
        entity: 33,
        attribute: assoc3,
        value: 444
    });

    db9.add({
        entity: 22,
        attribute: assoc2,
        value: 333
    });

    db9.add({
        entity: 333,
        attribute: assoc3,
        value: 4444
    });


    const q9 = Q.parseQuery(
        [Q.findK, "?one", "?two", "?three", "?four",
            Q.whereK, ["?one", assoc1, "?two"],
            ["?two", assoc2, "?three"],
            ["?three", assoc3, "?four"]]
    );

    const r9 = await Q.runQuery(db9, q9);

    console.log(r9);

}

main().then(() =>{
    console.log( "t_query_01.mjs tests passed." );
}, (err) => {
    console.error(err);
});
